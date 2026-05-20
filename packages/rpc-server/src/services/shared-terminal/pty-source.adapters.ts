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

import type { IPtySource } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import type { PTYSession } from '../pty/pty-session';
import type { SSHSession } from '../ssh-session/ssh-session';
import { Disposable } from '@termlnk/core';
import { map, Subject, takeUntil } from 'rxjs';

/**
 * IPtySource adapter for a live SSH session. Bridges SSHSession.data$ / write / resize
 * into the multiplexer contract so PtyMultiplexerService can fan it out to remote
 * participants without taking a direct dependency on the SSH session graph.
 *
 * `write` is fire-and-forget — SSHSession.write returns a Promise but logs errors
 * internally; we do not surface them to the multiplexer call site.
 */
export class SSHPtySource extends Disposable implements IPtySource {
  readonly id: string;
  readonly title: string;
  readonly output$: Observable<Uint8Array>;

  private readonly _stop$ = new Subject<void>();

  constructor(private readonly _session: SSHSession) {
    super();
    this.id = _session.sessionId;
    this.title = _session.host.label || `ssh:${_session.sessionId.slice(0, 8)}`;
    this.output$ = _session.data$.pipe(takeUntil(this._stop$));
  }

  get cols(): number {
    return this._session.cols;
  }

  get rows(): number {
    return this._session.rows;
  }

  write(data: Uint8Array): void {
    void this._session.write(data);
  }

  resize(cols: number, rows: number): void {
    void this._session.resize(rows, cols);
  }

  override dispose(): void {
    super.dispose();
    this._stop$.next();
    this._stop$.complete();
  }
}

/**
 * IPtySource adapter for a local PTY session.
 *
 * Local PTYSession exposes `write(string)` only — we decode the incoming Uint8Array
 * frame back to UTF-8 because that is the byte shape every node-pty consumer
 * expects. If a participant ever needs to deliver a binary payload (rare in shell
 * traffic), we will need a binary write path; today the contract is text.
 */
export class LocalPtySource extends Disposable implements IPtySource {
  readonly id: string;
  readonly title: string;
  readonly output$: Observable<Uint8Array>;

  private readonly _stop$ = new Subject<void>();
  private readonly _decoder = new TextDecoder();

  constructor(private readonly _session: PTYSession, title?: string) {
    super();
    this.id = _session.sessionId;
    this.title = title ?? `pty:${_session.sessionId.slice(0, 8)}`;
    // PTYSession.data$ emits Buffer (a Uint8Array subclass); narrow it explicitly so the
    // multiplexer contract sees a plain Uint8Array regardless of platform.
    this.output$ = _session.data$.pipe(
      map((buf) => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)),
      takeUntil(this._stop$)
    );
  }

  get cols(): number {
    return this._session.cols;
  }

  get rows(): number {
    return this._session.rows;
  }

  write(data: Uint8Array): void {
    this._session.write(this._decoder.decode(data));
  }

  resize(cols: number, rows: number): void {
    this._session.resize(rows, cols);
  }

  override dispose(): void {
    super.dispose();
    this._stop$.next();
    this._stop$.complete();
  }
}
