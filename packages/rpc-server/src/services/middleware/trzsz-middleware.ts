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

/** 进度事件节流间隔（毫秒） */
const PROGRESS_THROTTLE_MS = 200;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Electron 的 fs 模块会将 .asar 文件当作目录处理，导致 trzsz 无法读取。
 * 传输期间禁用此行为，传输结束后恢复。
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
      if (_disposed || _isScanning) return;
      if (typeof data === 'string') {
        writeToTerminal(encoder.encode(data));
      } else if (data instanceof Uint8Array) {
        writeToTerminal(data);
      } else if (data instanceof ArrayBuffer) {
        writeToTerminal(new Uint8Array(data));
      }
    },
    sendToServer: (data: string | Uint8Array) => {
      // _isScanning: 正在扫描服务端输出（feedFromSession 空闲路径），
      //   此时 ZMODEM 二进制数据也会经过 processServerOutput，
      //   必须抑制以防止向 SSH 通道注入数据破坏 ZMODEM 协议。
      // _isScanningInput: 正在扫描终端输入（feedFromTerminal 空闲路径）。
      if (_disposed || _isScanning || _isScanningInput) return;
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
        // 禁用 Electron ASAR 处理，让 .asar 文件作为普通文件被读取
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

  // 拦截 TrzszFilter 内部的 TextProgressBar 以获取结构化进度数据。
  // TrzszFilter.createProgressBar() 在传输开始时创建 TextProgressBar，
  // TextProgressBar 实现 ProgressCallback 接口 (onNum/onName/onSize/onStep/onDone)。
  // 我们 wrap 这些回调来发射 FileTransferEvent。
  const _progress = { fileCount: 0, fileIdx: 0, fileName: '', fileSize: 0, lastTime: 0 };

  const filterAny = filter as any;
  const origCreateProgressBar = filterAny.createProgressBar;
  filterAny.createProgressBar = function (this: any, noProgress: boolean, tmuxPaneColumns?: number) {
    origCreateProgressBar.call(this, noProgress, tmuxPaneColumns);

    const progressBar = this.textProgressBar;
    if (!progressBar) return;

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
      // 节流：最多每 200ms 发射一次进度事件，但 100% 时总是发射
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
   * 重置传输状态并恢复 Electron ASAR 处理。
   */
  function resetTransferState(): void {
    setNoAsar(false);
    _wasTransferring = false;
    _state$.next('idle');
  }

  /**
   * 检测传输完成：TrzszFilter 在传输结束后将内部 trzszTransfer 设为 null，
   * 导致 isTransferringFiles() 从 true 变为 false。
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
   * 检测快速失败：传输已发起（state='active'、'started' 事件已发射）
   * 但在任何数据交换之前就失败了（例如文件不可读）。
   * 此时 _wasTransferring 从未被设为 true，checkTransferCompletion 无法检测。
   *
   * 此检测在 feedFromSession/feedFromTerminal 中、扫描逻辑之后调用。
   * 不会误判：在 chooseSendFiles 返回和传输设置完成之间，
   * TrzszFilter 的 trzszTransfer 已经被创建（isTransferringFiles=true），
   * feedFromSession 会进入第一个分支而不会到达此检测点。
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
      if (_disposed) return data;

      // 活跃传输：TrzszFilter 通过回调消费所有数据
      if (filter.isTransferringFiles()) {
        _wasTransferring = true;
        try {
          filter.processServerOutput(decoder.decode(data));
        } catch {}
        checkTransferCompletion();
        return null;
      }

      // 传输刚结束（从上一次 feedFromSession 到现在之间完成）
      checkTransferCompletion();

      // 空闲：扫描 trzsz 魔术字节，但抑制 writeToTerminal 回调
      // 让原始二进制数据流向下游中间件（zmodem）
      _isScanning = true;
      try {
        filter.processServerOutput(decoder.decode(data));
      } catch {}
      _isScanning = false;

      // 如果 trzsz 在此调用期间激活，消费数据
      if (filter.isTransferringFiles()) {
        return null;
      }

      // 检测快速失败（传输在协议交换前就失败）
      checkTransferFailure();

      // 传递原始二进制数据（保留 ZMODEM 魔术字节）
      return data;
    },

    feedFromTerminal(data: Uint8Array): Uint8Array | null {
      if (_disposed) return data;

      // 活跃传输：TrzszFilter 通过回调消费所有输入
      if (filter.isTransferringFiles()) {
        _wasTransferring = true;
        try {
          filter.processTerminalInput(decoder.decode(data));
        } catch {}
        checkTransferCompletion();
        return null;
      }

      checkTransferCompletion();

      // 空闲：扫描状态跟踪，抑制 sendToServer 回调
      _isScanningInput = true;
      try {
        filter.processTerminalInput(decoder.decode(data));
      } catch {}
      _isScanningInput = false;

      // 检测快速失败
      checkTransferFailure();

      // 传递数据给下游中间件
      return data;
    },

    dispose() {
      _disposed = true;
      setNoAsar(false);
      _state$.complete();
    },
  };
}
