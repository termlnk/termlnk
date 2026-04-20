/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { FileTransferEvent } from '@termlnk/rpc';
import type { ITerminalMiddleware, TerminalMiddlewareState } from './terminal-middleware';
import { Buffer } from 'node:buffer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { FileTransferEventType } from '@termlnk/rpc';
import { BehaviorSubject } from 'rxjs';
import { Receiver, ReceiverEvent, Sender, SenderEvent } from 'zmodem2';

export interface IZModemCallbacks {
  onDownloadRequest(offer: { name: string; size: number }): Promise<string | null>;
  onUploadRequest(): Promise<string[]>;
  onProgress(event: FileTransferEvent): void;
}

/**
 * Temporarily disable Electron's ASAR interception for fs operations.
 *
 * Electron patches `node:fs` to treat `.asar` files as virtual directories.
 * This causes ENOENT when trying to read/stat an `.asar` file as a regular
 * binary.  Setting `process.noAsar = true` bypasses the interception.
 * In non-Electron environments the property is harmless.
 */
function withNoAsar<T>(fn: () => T): T {
  const prev = (process as any).noAsar;
  (process as any).noAsar = true;
  try {
    return fn();
  } finally {
    (process as any).noAsar = prev;
  }
}

/** Ctrl+C key code, used to cancel active ZMODEM transfers */
const CTRL_C = 0x03;

/** ZMODEM header: ** + ZDLE(0x18) + 'B'(0x42) */
const ZMODEM_HEADER = [0x2A, 0x2A, 0x18, 0x42] as const;
/** ZRQINIT "00" — remote wants to send files (we receive) */
const ZRQINIT_TYPE = [0x30, 0x30] as const;
/** ZRINIT "01" — remote ready to receive (we send) */
const ZRINIT_TYPE = [0x30, 0x31] as const;
/** ZMODEM cancel sequence: 6x CAN(0x18) + 'B'(0x42) */
const CANCEL_SEQUENCE = new Uint8Array([0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x42]);

/** Max pump iterations to prevent runaway loops */
const MAX_PUMP_LOOPS = 1000;

/** Minimum interval (ms) between progress callbacks to avoid IPC flooding */
const PROGRESS_THROTTLE_MS = 200;

/**
 * Override Sender internal limits for better throughput.
 *
 * zmodem2 defaults to 1 KB subpackets with a 10-subpacket ACK window,
 * yielding only ~10 KB per round-trip.  By widening both the subpacket
 * size and the window we push up to ~256 KB per ACK cycle, which is
 * comparable to classic lrzsz implementations.
 *
 * Must be called after every `feedIncoming` because `updateReceiverCaps`
 * (triggered by the remote ZRINIT) resets the values.
 */
const TUNED_SUBPACKET_SIZE = 8192;
const TUNED_SUBPACKETS_PER_ACK = 32;
const TUNED_OUTGOING_CAPACITY = 32768;

function tuneSender(sender: Sender): void {
  const s = sender as any;
  if (s.maxSubpacketSize < TUNED_SUBPACKET_SIZE) {
    s.maxSubpacketSize = TUNED_SUBPACKET_SIZE;
  }
  if (s.maxSubpacketsPerAck < TUNED_SUBPACKETS_PER_ACK) {
    s.maxSubpacketsPerAck = TUNED_SUBPACKETS_PER_ACK;
  }
  // Resize internal buffers so the larger subpackets fit after ZDLE encoding
  if (s.buf && s.buf.capacity < TUNED_SUBPACKET_SIZE) {
    s.buf.capacity = TUNED_SUBPACKET_SIZE;
  }
  if (s.outgoing && s.outgoing.capacity < TUNED_OUTGOING_CAPACITY) {
    s.outgoing.capacity = TUNED_OUTGOING_CAPACITY;
  }
}

/**
 * Encode a Unicode filename into a Latin-1 string whose charCodeAt() bytes
 * are the UTF-8 encoding of the original name.
 *
 * zmodem2's Sender.startFile() internally uses charCodeAt(i) to emit each
 * character as a single byte, which truncates codepoints > 0xFF.  By pre-
 * encoding into UTF-8 bytes and wrapping them in a Latin-1 string, each
 * charCodeAt() call yields the correct UTF-8 byte.
 */
function encodeFileNameForZmodem(name: string): string {
  const bytes = new TextEncoder().encode(name);
  return String.fromCharCode(...bytes);
}

/**
 * Decode a Latin-1 filename (raw UTF-8 bytes stored as charCodes) back into
 * a proper Unicode string.
 *
 * zmodem2's Receiver.getFileName() returns String.fromCharCode(...rawBytes),
 * treating UTF-8 payload as Latin-1.  This reverses that encoding.
 */
function decodeZmodemFileName(name: string): string {
  const bytes = new Uint8Array(name.length);
  for (let i = 0; i < name.length; i++) {
    bytes[i] = name.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Scan data for a 6-byte ZMODEM signature: HEADER(4) + frame-type(2).
 * Returns the detection type and offset, or null if not found.
 */
function detectZmodemStart(data: Uint8Array): { type: 'receive' | 'send'; offset: number } | null {
  for (let i = 0; i <= data.length - 6; i++) {
    if (
      data[i] === ZMODEM_HEADER[0]
      && data[i + 1] === ZMODEM_HEADER[1]
      && data[i + 2] === ZMODEM_HEADER[2]
      && data[i + 3] === ZMODEM_HEADER[3]
    ) {
      if (data[i + 4] === ZRQINIT_TYPE[0] && data[i + 5] === ZRQINIT_TYPE[1]) {
        return { type: 'receive', offset: i };
      }
      if (data[i + 4] === ZRINIT_TYPE[0] && data[i + 5] === ZRINIT_TYPE[1]) {
        return { type: 'send', offset: i };
      }
    }
  }
  return null;
}

// eslint-disable-next-line max-lines-per-function
export function createZModemMiddleware(callbacks: IZModemCallbacks, writeToChannel: (data: Uint8Array) => void): ITerminalMiddleware {
  const _state$ = new BehaviorSubject<TerminalMiddlewareState>('idle');
  let _disposed = false;

  // State machine
  let _receiver: Receiver | null = null;
  let _sender: Sender | null = null;
  let _mode: 'idle' | 'receiving' | 'sending' = 'idle';
  let _waitingForUserInput = false;
  let _pendingData: Uint8Array[] = [];

  // Receiving state
  let _writeStream: fs.WriteStream | null = null;
  let _recvFileName = '';
  let _recvFileSize = 0;
  let _recvBytesTransferred = 0;

  // Sending state
  let _filesToSend: string[] = [];
  let _sendFileIndex = 0;
  let _sendFileFd: number | null = null;
  let _sendFileName = '';
  let _sendFileSize = 0;
  let _sendBytesTransferred = 0;

  // Progress throttle
  let _lastProgressTime = 0;

  /** Safely close the current send file descriptor, ignoring errors. */
  const closeSendFileFd = () => {
    if (_sendFileFd !== null) {
      try {
        withNoAsar(() => fs.closeSync(_sendFileFd!));
      } catch { /* ignore */ }
      _sendFileFd = null;
    }
  };

  /** Close and flush the current write stream. */
  const closeWriteStream = () => {
    if (_writeStream) {
      _writeStream.end();
      _writeStream = null;
    }
  };

  const setIdle = () => {
    _receiver = null;
    _sender = null;
    _mode = 'idle';
    _waitingForUserInput = false;
    _pendingData = [];
    closeWriteStream();
    _recvFileName = '';
    _recvFileSize = 0;
    _recvBytesTransferred = 0;
    _filesToSend = [];
    _sendFileIndex = 0;
    closeSendFileFd();
    _sendFileName = '';
    _sendFileSize = 0;
    _sendBytesTransferred = 0;
    _lastProgressTime = 0;
    _state$.next('idle');
  };

  const handleError = (err: unknown) => {
    callbacks.onProgress({
      type: FileTransferEventType.ERROR,
      protocol: 'zmodem',
      message: String(err),
    });
    setIdle();
  };

  /** Drain outgoing protocol bytes and send them to the SSH channel. */
  const drainAndSend = (machine: Receiver | Sender) => {
    const outgoing = machine.drainOutgoing();
    if (outgoing.length > 0) {
      writeToChannel(outgoing);
    }
  };

  /** Emit a throttled progress event (at most once per PROGRESS_THROTTLE_MS). */
  const emitThrottledProgress = (event: FileTransferEvent) => {
    const now = Date.now();
    if (now - _lastProgressTime >= PROGRESS_THROTTLE_MS) {
      _lastProgressTime = now;
      callbacks.onProgress(event);
    }
  };

  /** Merge and write accumulated wire data chunks in a single write. */
  const flushChunks = (chunks: Uint8Array[]) => {
    if (chunks.length === 0) return;
    if (chunks.length === 1) {
      writeToChannel(chunks[0]);
      return;
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
      merged.set(c, pos);
      pos += c.length;
    }
    writeToChannel(merged);
  };

  // Receiver pump (download)
  function pumpReceiver() {
    if (!_receiver) return;

    let loopCount = 0;
    while (loopCount++ < MAX_PUMP_LOOPS) {
      let didWork = false;

      // 1. Drain outgoing protocol responses
      const outgoing = _receiver.drainOutgoing();
      if (outgoing.length > 0) {
        writeToChannel(outgoing);
        didWork = true;
      }

      // 2. Poll events
      const event = _receiver.pollEvent();
      if (event !== null) {
        didWork = true;

        if (event === ReceiverEvent.FileStart) {
          _recvFileName = decodeZmodemFileName(_receiver.getFileName());
          _recvFileSize = _receiver.getFileSize();
          _recvBytesTransferred = 0;
          _waitingForUserInput = true;

          // Async: ask user for save path
          callbacks.onDownloadRequest({ name: _recvFileName, size: _recvFileSize })
            .then((savePath) => {
              if (_mode !== 'receiving' || !_receiver) return;

              if (!savePath) {
                // User cancelled download
                writeToChannel(CANCEL_SEQUENCE);
                callbacks.onProgress({ type: FileTransferEventType.CANCELLED, protocol: 'zmodem' });
                setIdle();
                return;
              }

              _writeStream = fs.createWriteStream(savePath);
              _waitingForUserInput = false;

              callbacks.onProgress({
                type: FileTransferEventType.PROGRESS,
                protocol: 'zmodem',
                direction: 'download',
                fileName: _recvFileName,
                bytesTransferred: 0,
                totalBytes: _recvFileSize,
              });

              // Replay buffered data
              const pending = _pendingData;
              _pendingData = [];
              for (let i = 0; i < pending.length; i++) {
                if (_mode !== 'receiving' || !_receiver || _waitingForUserInput) {
                  // Re-buffer remaining chunks
                  _pendingData = [...pending.slice(i), ..._pendingData];
                  break;
                }
                feedReceiverFully(pending[i]);
              }
            })
            .catch(handleError);

          // Stop pump — will resume after user responds
          return;
        }

        if (event === ReceiverEvent.FileComplete) {
          closeWriteStream();
        }

        if (event === ReceiverEvent.SessionComplete) {
          callbacks.onProgress({
            type: FileTransferEventType.COMPLETE,
            protocol: 'zmodem',
            direction: 'download',
            fileName: _recvFileName,
            bytesTransferred: _recvBytesTransferred,
            totalBytes: _recvFileSize,
          });
          setIdle();
          return;
        }
      }

      // 3. Drain file data into the write stream
      if (_writeStream && _receiver) {
        const fileData = _receiver.drainFile();
        if (fileData.length > 0) {
          _writeStream.write(Buffer.from(fileData));
          _recvBytesTransferred += fileData.length;
          didWork = true;

          emitThrottledProgress({
            type: FileTransferEventType.PROGRESS,
            protocol: 'zmodem',
            direction: 'download',
            fileName: _recvFileName,
            bytesTransferred: _recvBytesTransferred,
            totalBytes: _recvFileSize,
          });
        }
      }

      if (!didWork) break;
    }
  }

  /**
   * Feed data into the Receiver, looping until all bytes are consumed.
   *
   * `feedIncoming` may consume only a portion of the input when internal
   * buffers are full (e.g. file data ready to drain).  We must pump after
   * each partial feed to clear the buffers, then continue feeding the
   * remaining bytes.  Dropping unconsumed bytes causes subsequent CRC
   * mismatches.
   */
  function feedReceiverFully(data: Uint8Array) {
    let remaining = data;
    for (let i = 0; i < MAX_PUMP_LOOPS && remaining.length > 0; i++) {
      if (!_receiver || _mode !== 'receiving' || _waitingForUserInput) break;
      const consumed = _receiver.feedIncoming(remaining);
      pumpReceiver();
      if (consumed === 0) break;
      remaining = remaining.subarray(consumed);
    }
  }

  // Sender pump (upload)
  // Begin transmitting the next file in the queue.
  const startNextFile = () => {
    if (!_sender || _sendFileIndex >= _filesToSend.length) {
      // All files sent — finish the session
      if (_sender) {
        _sender.finishSession();
        drainAndSend(_sender);
      }
      return;
    }

    const filePath = _filesToSend[_sendFileIndex];
    const stat = withNoAsar(() => fs.statSync(filePath));
    const fileName = path.basename(filePath);
    const fileSize = stat.size;

    // Open file descriptor for on-demand reading instead of loading
    // the entire file into memory (avoids OOM on large files).
    _sendFileFd = withNoAsar(() => fs.openSync(filePath, 'r'));
    _sendFileName = fileName;
    _sendFileSize = fileSize;
    _sendBytesTransferred = 0;

    _sender.startFile(encodeFileNameForZmodem(fileName), fileSize);
    drainAndSend(_sender);

    callbacks.onProgress({
      type: FileTransferEventType.PROGRESS,
      protocol: 'zmodem',
      direction: 'upload',
      fileName,
      bytesTransferred: 0,
      totalBytes: fileSize,
    });
  };

  const pumpSender = () => {
    if (!_sender) return;

    let loopCount = 0;
    while (loopCount++ < MAX_PUMP_LOOPS) {
      let didWork = false;

      // 1. Service file-data requests.
      //    feedFile() requires the outgoing buffer to be empty, so we must
      //    drain after each call.  We accumulate all drained chunks locally
      //    and flush them in a single writeToChannel at the end.
      const chunks: Uint8Array[] = [];
      if (_sendFileFd !== null && _sender) {
        for (let i = 0; i < MAX_PUMP_LOOPS; i++) {
          const request = _sender.pollFile();
          if (!request) break;
          const { offset, len } = request;
          const chunk = Buffer.alloc(len);
          withNoAsar(() => fs.readSync(_sendFileFd!, chunk, 0, len, offset));
          _sender.feedFile(new Uint8Array(chunk));
          // Must drain immediately — feedFile throws if outgoing is not empty
          const encoded = _sender.drainOutgoing();
          if (encoded.length > 0) chunks.push(encoded);
          _sendBytesTransferred = offset + len;
          didWork = true;
        }
      }

      // 2. Drain any remaining protocol data (headers, EOF, FIN, etc.)
      const trailing = _sender.drainOutgoing();
      if (trailing.length > 0) {
        chunks.push(trailing);
        didWork = true;
      }

      // 3. Flush all accumulated wire data in a single write
      flushChunks(chunks);

      // 4. Poll events
      const event = _sender.pollEvent();
      if (event !== null) {
        didWork = true;

        if (event === SenderEvent.FileComplete) {
          // Ensure final progress for this file is emitted
          callbacks.onProgress({
            type: FileTransferEventType.PROGRESS,
            protocol: 'zmodem',
            direction: 'upload',
            fileName: _sendFileName,
            bytesTransferred: _sendFileSize,
            totalBytes: _sendFileSize,
          });

          _sendFileIndex++;
          closeSendFileFd();

          if (_sendFileIndex < _filesToSend.length) {
            startNextFile();
          } else {
            _sender.finishSession();
            drainAndSend(_sender);
          }
          continue;
        }

        if (event === SenderEvent.SessionComplete) {
          callbacks.onProgress({
            type: FileTransferEventType.COMPLETE,
            protocol: 'zmodem',
            direction: 'upload',
            fileName: _sendFileName,
            bytesTransferred: _sendBytesTransferred,
            totalBytes: _sendFileSize,
          });
          setIdle();
          return;
        }
      }

      // 5. Throttled progress update
      if (didWork && _sendFileName) {
        emitThrottledProgress({
          type: FileTransferEventType.PROGRESS,
          protocol: 'zmodem',
          direction: 'upload',
          fileName: _sendFileName,
          bytesTransferred: _sendBytesTransferred,
          totalBytes: _sendFileSize,
        });
      }

      if (!didWork) {
        break;
      }
    }
  };

  return {
    name: 'zmodem',

    get state() {
      return _state$.getValue();
    },
    state$: _state$.asObservable(),

    feedFromSession(data: Uint8Array): Uint8Array | null {
      if (_disposed) return data;

      // --- Active transfer ---
      if (_mode !== 'idle') {
        if (_waitingForUserInput) {
          _pendingData.push(new Uint8Array(data));
          return null;
        }

        try {
          if (_mode === 'receiving' && _receiver) {
            feedReceiverFully(data);
          } else if (_mode === 'sending' && _sender) {
            _sender.feedIncoming(data);
            tuneSender(_sender);
            pumpSender();
          }
        } catch (err) {
          handleError(err);
        }
        return null;
      }

      // --- Idle: scan for ZMODEM header ---
      const detection = detectZmodemStart(data);
      if (!detection) {
        return data;
      }

      const protocolData = data.subarray(detection.offset);
      const terminalData = detection.offset > 0 ? data.subarray(0, detection.offset) : null;

      try {
        if (detection.type === 'receive') {
          // Remote wants to send files → we receive (sz command)
          _mode = 'receiving';
          _receiver = new Receiver();
          _state$.next('active');

          callbacks.onProgress({
            type: FileTransferEventType.STARTED,
            protocol: 'zmodem',
            direction: 'download',
            sessionId: '',
          });

          feedReceiverFully(protocolData);
        } else {
          // Remote ready to receive → we send (rz command)
          _mode = 'sending';
          _sender = new Sender(false);
          _state$.next('active');

          _sender.feedIncoming(protocolData);
          tuneSender(_sender);
          drainAndSend(_sender);

          _waitingForUserInput = true;

          callbacks.onUploadRequest()
            .then((files) => {
              if (_mode !== 'sending' || !_sender) return;

              if (!files || files.length === 0) {
                writeToChannel(CANCEL_SEQUENCE);
                setIdle();
                return;
              }

              callbacks.onProgress({
                type: FileTransferEventType.STARTED,
                protocol: 'zmodem',
                direction: 'upload',
                sessionId: '',
              });

              _filesToSend = files;
              _sendFileIndex = 0;
              _waitingForUserInput = false;

              // Replay buffered data
              const pending = _pendingData;
              _pendingData = [];
              for (let i = 0; i < pending.length; i++) {
                if (_mode !== 'sending' || !_sender) break;
                _sender.feedIncoming(pending[i]);
                tuneSender(_sender);
              }

              startNextFile();
              pumpSender();
            })
            .catch(handleError);
        }
      } catch (err) {
        handleError(err);
      }

      return terminalData;
    },

    feedFromTerminal(data: Uint8Array): Uint8Array | null {
      if (_state$.getValue() === 'active') {
        // During active ZMODEM session, intercept Ctrl+C to cancel
        if (data.length === 1 && data[0] === CTRL_C) {
          writeToChannel(CANCEL_SEQUENCE);
          callbacks.onProgress({ type: FileTransferEventType.CANCELLED, protocol: 'zmodem' });
          setIdle();
        }
        return null;
      }
      return data;
    },

    dispose() {
      _disposed = true;
      closeWriteStream();
      closeSendFileFd();
      _receiver = null;
      _sender = null;
      _state$.complete();
    },
  };
}
