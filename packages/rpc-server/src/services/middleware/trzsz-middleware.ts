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
import process from 'node:process';
import { FileTransferEventType } from '@termlnk/rpc';
import { BehaviorSubject } from 'rxjs';
import { TrzszFilter } from './trzsz-shim';

export interface ITrzszCallbacks {
  onUploadRequest(directory: boolean): Promise<string[] | undefined>;
  onDownloadRequest(directory: boolean): Promise<string | undefined>;
  onProgress(event: FileTransferEvent): void;
}

/** Progress event throttle interval (ms) */
const PROGRESS_THROTTLE_MS = 200;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Electron's fs module treats .asar files as directories, preventing trzsz from reading them.
 * Disable this during transfer and restore afterward.
 */
function setNoAsar(value: boolean): void {
  if (typeof process !== 'undefined') {
    (process as any).noAsar = value;
  }
}

export function createTrzszMiddleware(
  callbacks: ITrzszCallbacks,
  writeToChannel: (data: Uint8Array) => void,
  writeToTerminal: (data: Uint8Array) => void,
  terminalColumns: () => number
): ITerminalMiddleware {
  const _state$ = new BehaviorSubject<TerminalMiddlewareState>('idle');
  let _disposed = false;
  let _isScanning = false;
  let _isScanningInput = false;
  let _transferDirection: 'upload' | 'download' = 'upload';
  let _wasTransferring = false;

  const filter = new TrzszFilter({
    writeToTerminal: (data: string | ArrayBuffer | Uint8Array | Blob) => {
      if (_disposed || _isScanning) {
        return;
      }
      if (typeof data === 'string') {
        writeToTerminal(encoder.encode(data));
      } else if (data instanceof Uint8Array) {
        writeToTerminal(data);
      } else if (data instanceof ArrayBuffer) {
        writeToTerminal(new Uint8Array(data));
      }
    },
    sendToServer: (data: string | Uint8Array) => {
      // _isScanning: scanning server output (feedFromSession idle path) —
      //   ZMODEM binary data also passes through processServerOutput here,
      //   must suppress to prevent injecting data into the SSH channel and breaking ZMODEM.
      // _isScanningInput: scanning terminal input (feedFromTerminal idle path).
      if (_disposed || _isScanning || _isScanningInput) {
        return;
      }
      writeToChannel(typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data));
    },
    chooseSendFiles: async (directory?: boolean) => {
      _state$.next('active');
      _transferDirection = 'upload';
      try {
        const result = await callbacks.onUploadRequest(directory ?? false);
        if (!result || result.length === 0) {
          _state$.next('idle');
          return undefined;
        }
        // Disable Electron ASAR handling so .asar files are read as plain files
        setNoAsar(true);
        callbacks.onProgress({
          type: FileTransferEventType.STARTED,
          protocol: 'trzsz',
          direction: 'upload',
          sessionId: '',
        });
        return result;
      } catch {
        _state$.next('idle');
        return undefined;
      }
    },
    chooseSaveDirectory: async () => {
      _state$.next('active');
      _transferDirection = 'download';
      try {
        const result = await callbacks.onDownloadRequest(false);
        if (!result) {
          _state$.next('idle');
          return undefined;
        }
        setNoAsar(true);
        callbacks.onProgress({
          type: FileTransferEventType.STARTED,
          protocol: 'trzsz',
          direction: 'download',
          sessionId: '',
        });
        return result;
      } catch {
        _state$.next('idle');
        return undefined;
      }
    },
    terminalColumns: terminalColumns(),
  });

  // Intercept TrzszFilter's internal TextProgressBar to capture structured progress data.
  // TrzszFilter.createProgressBar() creates a TextProgressBar at transfer start;
  // TextProgressBar implements ProgressCallback (onNum/onName/onSize/onStep/onDone).
  // We wrap these callbacks to emit FileTransferEvent.
  const _progress = { fileCount: 0, fileIdx: 0, fileName: '', fileSize: 0, lastTime: 0 };

  const filterAny = filter as any;
  const origCreateProgressBar = filterAny.createProgressBar;
  filterAny.createProgressBar = function (this: any, noProgress: boolean, tmuxPaneColumns?: number) {
    origCreateProgressBar.call(this, noProgress, tmuxPaneColumns);

    const progressBar = this.textProgressBar;
    if (!progressBar) {
      return;
    }

    _progress.fileCount = 0;
    _progress.fileIdx = 0;
    _progress.fileName = '';
    _progress.fileSize = 0;
    _progress.lastTime = 0;

    const origOnNum = progressBar.onNum.bind(progressBar);
    const origOnName = progressBar.onName.bind(progressBar);
    const origOnSize = progressBar.onSize.bind(progressBar);
    const origOnStep = progressBar.onStep.bind(progressBar);
    const origOnDone = progressBar.onDone.bind(progressBar);

    progressBar.onNum = (num: number) => {
      _progress.fileCount = num;
      _progress.fileIdx = 0;
      origOnNum(num);
    };

    progressBar.onName = (name: string) => {
      _progress.fileName = name;
      _progress.fileIdx++;
      origOnName(name);
    };

    progressBar.onSize = (size: number) => {
      _progress.fileSize = size;
      origOnSize(size);
    };

    progressBar.onStep = (step: number) => {
      const now = Date.now();
      // Throttle: emit at most once per 200ms, but always emit at 100%
      if (now - _progress.lastTime >= PROGRESS_THROTTLE_MS || step >= _progress.fileSize) {
        _progress.lastTime = now;
        callbacks.onProgress({
          type: FileTransferEventType.PROGRESS,
          protocol: 'trzsz',
          direction: _transferDirection,
          fileName: _progress.fileName,
          bytesTransferred: step,
          totalBytes: _progress.fileSize,
          fileIndex: _progress.fileIdx,
          fileCount: _progress.fileCount,
        });
      }
      origOnStep(step);
    };

    progressBar.onDone = () => {
      origOnDone();
    };
  };

  /**
   * Reset transfer state and restore Electron ASAR handling.
   */
  function resetTransferState(): void {
    setNoAsar(false);
    _wasTransferring = false;
    _state$.next('idle');
  }

  /**
   * Detect transfer completion: TrzszFilter sets its internal trzszTransfer to null
   * after transfer ends, causing isTransferringFiles() to flip from true to false.
   */
  function checkTransferCompletion(): void {
    const isTransferring = filter.isTransferringFiles();
    if (_wasTransferring && !isTransferring) {
      resetTransferState();
      callbacks.onProgress({
        type: FileTransferEventType.COMPLETE,
        protocol: 'trzsz',
        direction: _transferDirection,
        fileName: _progress.fileName,
        bytesTransferred: _progress.fileSize,
        totalBytes: _progress.fileSize,
      });
    }
    _wasTransferring = isTransferring;
  }

  /**
   * Detect early failure: transfer was initiated (state='active', 'started' event emitted)
   * but failed before any data exchange (e.g. unreadable file).
   * _wasTransferring was never set to true, so checkTransferCompletion cannot detect this.
   *
   * Called in feedFromSession/feedFromTerminal after the scanning logic.
   * No false positives: between chooseSendFiles returning and transfer setup completing,
   * TrzszFilter's trzszTransfer is already created (isTransferringFiles=true),
   * so feedFromSession enters the first branch and never reaches this check.
   */
  function checkTransferFailure(): void {
    if (_state$.getValue() === 'active' && !filter.isTransferringFiles() && !_wasTransferring) {
      resetTransferState();
      callbacks.onProgress({
        type: FileTransferEventType.ERROR,
        protocol: 'trzsz',
        message: 'Transfer failed',
      });
    }
  }

  return {
    name: 'trzsz',

    get state() {
      return _state$.getValue();
    },
    state$: _state$.asObservable(),

    feedFromSession(data: Uint8Array): Uint8Array | null {
      if (_disposed) {
        return data;
      }

      // Active transfer: TrzszFilter consumes all data via callbacks
      if (filter.isTransferringFiles()) {
        _wasTransferring = true;
        try {
          filter.processServerOutput(decoder.decode(data));
        } catch {}
        checkTransferCompletion();
        return null;
      }

      // Transfer just ended (completed between the last feedFromSession and now)
      checkTransferCompletion();

      // Idle: scan for trzsz magic bytes, but suppress writeToTerminal callback
      // so raw binary data flows to downstream middleware (zmodem)
      _isScanning = true;
      try {
        filter.processServerOutput(decoder.decode(data));
      } catch {}
      _isScanning = false;

      // If trzsz activated during this call, consume data
      if (filter.isTransferringFiles()) {
        return null;
      }

      // Detect early failure (transfer failed before protocol exchange)
      checkTransferFailure();

      // Pass raw binary data through (preserving ZMODEM magic bytes)
      return data;
    },

    feedFromTerminal(data: Uint8Array): Uint8Array | null {
      if (_disposed) {
        return data;
      }

      // Active transfer: TrzszFilter consumes all input via callbacks
      if (filter.isTransferringFiles()) {
        _wasTransferring = true;
        try {
          filter.processTerminalInput(decoder.decode(data));
        } catch {}
        checkTransferCompletion();
        return null;
      }

      checkTransferCompletion();

      // Idle: scan state tracking, suppress sendToServer callback
      _isScanningInput = true;
      try {
        filter.processTerminalInput(decoder.decode(data));
      } catch {}
      _isScanningInput = false;

      // Detect early failure
      checkTransferFailure();

      // Pass data to downstream middleware
      return data;
    },

    dispose() {
      _disposed = true;
      setNoAsar(false);
      _state$.complete();
    },
  };
}
