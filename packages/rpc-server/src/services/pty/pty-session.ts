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

import type { IDisposable, Nullable } from '@termlnk/core';
import type { IPTYProcess } from './pty-process';
import { Buffer } from 'node:buffer';
import { Disposable, IConfigService, ILogService } from '@termlnk/core';
import { resolveConfigPath } from '@termlnk/rpc';
import { PTYSessionStatus } from '@termlnk/terminal';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import { createPTYProcess } from './pty-process';

export interface IPTYSessionOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  shell?: string;
  restored?: boolean;
}

const PTY_OUTPUT_CHUNK_MAX_BYTES = 64 * 1024;
const PTY_REPLAY_BUFFER_BYTES = 256 * 1024;
const PTY_REPLAY_BUFFER_LIMIT = PTY_REPLAY_BUFFER_BYTES / PTY_OUTPUT_CHUNK_MAX_BYTES;

export class PTYSession extends Disposable implements IDisposable {
  private readonly _status$ = new BehaviorSubject<PTYSessionStatus>(PTYSessionStatus.IDLE);
  readonly status$ = this._status$.asObservable();
  get status(): PTYSessionStatus {
    return this._status$.getValue();
  }

  // Replay recent output to late-attaching consumers (a restored session's
  // renderer subscribes after spawn). Eviction is bounded by bytes only — a
  // wall-clock deadline would reintroduce the spawn-vs-subscribe race this
  // buffer exists to absorb.
  private readonly _data$ = new ReplaySubject<Buffer>(PTY_REPLAY_BUFFER_LIMIT);
  readonly data$ = this._data$.asObservable();

  private readonly _resize$ = new Subject<{ cols: number; rows: number }>();
  readonly resize$ = this._resize$.asObservable();

  private _process: Nullable<IPTYProcess>;
  private _shellPath: string = '';
  private _cols: number;
  private _rows: number;
  private _isClosing = false;

  constructor(
    private readonly _sessionId: string,
    private readonly _options: IPTYSessionOptions,
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
    this._cols = _options.cols ?? 80;
    this._rows = _options.rows ?? 24;
    this._createProcess(_options);
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get shellPath(): string {
    return this._shellPath;
  }

  get cols(): number {
    return this._cols;
  }

  get rows(): number {
    return this._rows;
  }

  write(data: string): void {
    if (!this._process) {
      return;
    }
    this._process.write(data);
  }

  resize(rows: number, cols: number): void {
    if (!this._process) {
      return;
    }
    this._cols = cols;
    this._rows = rows;
    this._resize$.next({ cols, rows });
    this._process.resize(cols, rows);
  }

  pauseOutput(): void {
    this._process?.pause();
  }

  resumeOutput(): void {
    this._process?.resume();
  }

  async close(): Promise<void> {
    if (!this._process || this._isClosing || this.status === PTYSessionStatus.CLOSED) {
      return;
    }

    this._isClosing = true;
    const process = this._process;
    this._process = null;

    try {
      if (process.pid > 0) {
        process.kill();
      }

      process.dispose();
      this._markClosed();
    } finally {
      this._isClosing = false;
    }
  }

  private _createProcess(options: IPTYSessionOptions): void {
    try {
      const result = createPTYProcess({
        cols: this._cols,
        rows: this._rows,
        cwd: options.cwd,
        shell: options.shell,
        sessionId: this._sessionId,
        configPath: resolveConfigPath(this._configService),
        restored: options.restored,
      });

      this._process = result.process;
      this._shellPath = result.shellPath;

      this.disposeWithMe(
        this._process.data$.subscribe((data) => {
          for (let offset = 0; offset < data.byteLength; offset += PTY_OUTPUT_CHUNK_MAX_BYTES) {
            const end = Math.min(offset + PTY_OUTPUT_CHUNK_MAX_BYTES, data.byteLength);
            this._data$.next(data.byteLength <= PTY_OUTPUT_CHUNK_MAX_BYTES ? data : Buffer.from(data.subarray(offset, end)));
          }
        })
      );

      this.disposeWithMe(
        this._process.exit$.subscribe((event) => {
          this._logService.log(`[PTYSession] ${this._sessionId} exited with code ${event.exitCode}`);
          this._process = null;
          this._markClosed();
        })
      );

      this._status$.next(PTYSessionStatus.READY);
    } catch (err) {
      this._logService.error('[PTYSession] Failed to create PTY process:', err);
      this._status$.next(PTYSessionStatus.ERROR);
    }
  }

  override dispose(): void {
    super.dispose();
    this.close().catch(() => {});
    this._status$.complete();
    this._data$.complete();
    this._resize$.complete();
  }

  private _markClosed(): void {
    if (this.status !== PTYSessionStatus.CLOSED) {
      this._status$.next(PTYSessionStatus.CLOSED);
    }
  }
}
