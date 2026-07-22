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

import type { IDisposable } from '@termlnk/core';
import type { ISSHSessionService } from '@termlnk/rpc';
import type { IPTYSessionService, TerminalOutputSourceType } from '@termlnk/terminal';
import type { Observable, Subscription } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { ISSHSessionService as ISSHSessionServiceIdentifier, ITerminalSessionNotifyService } from '@termlnk/rpc';
import { IPTYSessionService as IPTYSessionServiceIdentifier, TERMINAL_OUTPUT_CREDIT_BYTES, TERMINAL_OUTPUT_CREDIT_FRAMES, TERMINAL_OUTPUT_FRAME_INTERVAL_MS, TERMINAL_OUTPUT_MAX_FRAME_BYTES } from '@termlnk/terminal';
import { catchError, filter, firstValueFrom, take, throwError, timeout } from 'rxjs';

export interface ITerminalOutputFrame {
  readonly sequence: number;
  readonly data: Uint8Array;
}

export interface ITerminalOutputSink {
  send(frame: ITerminalOutputFrame): void;
  complete(): void;
  error(error: Error): void;
}

export interface ITerminalOutputStreamHandle extends IDisposable {
  acknowledge(sequence: number): void;
}

export interface ITerminalOutputStreamService extends IDisposable {
  /**
   * Attach a sink to a session's output stream. When the session is not
   * registered yet — the renderer may open the stream before the backend
   * finishes recreating a restored session — waits for its creation event
   * and rejects with "not found" only if it never appears.
   */
  open(source: TerminalOutputSourceType, sessionId: string, sink: ITerminalOutputSink): Promise<ITerminalOutputStreamHandle>;
}

export const ITerminalOutputStreamService = createIdentifier<ITerminalOutputStreamService>('rpc-server.terminal-output-stream-service');

export interface ITerminalOutputSource {
  readonly data$: Observable<Uint8Array>;
  pauseOutput(): void;
  resumeOutput(): void;
}

interface IClientState {
  readonly sink: ITerminalOutputSink;
  readonly pendingFrames: ITerminalOutputFrame[];
  readonly inFlightFrames: ITerminalOutputFrame[];
  pendingFrameIndex: number;
  availableCreditBytes: number;
}

export class TerminalOutputFlow extends Disposable {
  private readonly _clients = new Set<IClientState>();
  private _sourceSubscription: Subscription | null = null;
  private _frameBuffer = new Uint8Array(TERMINAL_OUTPUT_MAX_FRAME_BYTES);
  private _frameBufferLength = 0;
  private _frameTimer: ReturnType<typeof setTimeout> | null = null;
  private _nextSequence = 0;
  private _isSourcePaused = false;
  private _isSourceCompleted = false;
  private _sourceError: Error | null = null;

  get clientCount(): number {
    return this._clients.size;
  }

  constructor(
    private readonly _source: ITerminalOutputSource,
    private readonly _onDidTerminate: (flow: TerminalOutputFlow) => void = () => {}
  ) {
    super();
  }

  attach(sink: ITerminalOutputSink): ITerminalOutputStreamHandle {
    this.ensureNotDisposed();
    if (this._isSourceCompleted) {
      if (this._sourceError) {
        this._notifyError(sink, this._sourceError);
      } else {
        this._notifyComplete(sink);
      }
      return {
        acknowledge: () => {},
        dispose: () => {},
      };
    }

    const client: IClientState = {
      sink,
      pendingFrames: [],
      inFlightFrames: [],
      pendingFrameIndex: 0,
      availableCreditBytes: TERMINAL_OUTPUT_CREDIT_BYTES,
    };
    this._clients.add(client);
    this._ensureSourceSubscription();

    let isDisposed = false;
    return {
      acknowledge: (sequence) => {
        if (!isDisposed) {
          this._acknowledge(client, sequence);
        }
      },
      dispose: () => {
        if (isDisposed) {
          return;
        }
        isDisposed = true;
        this._removeClient(client);
      },
    };
  }

  override dispose(): void {
    if (this._disposed) {
      return;
    }
    super.dispose();
    this._sourceSubscription?.unsubscribe();
    this._sourceSubscription = null;
    this._clearFrameTimer();
    this._frameBufferLength = 0;
    this._releaseSourcePause();
    for (const client of this._clients) {
      client.pendingFrames.length = 0;
      client.inFlightFrames.length = 0;
    }
    this._clients.clear();
    this._onDidTerminate(this);
  }

  private _ensureSourceSubscription(): void {
    if (this._sourceSubscription || this._isSourceCompleted) {
      return;
    }
    const subscription = this._source.data$.subscribe({
      next: (data) => this._enqueue(data),
      error: (error) => this._fail(error instanceof Error ? error : new Error(String(error))),
      complete: () => this._complete(),
    });
    if (!subscription.closed && !this._disposed && !this._isSourceCompleted) {
      this._sourceSubscription = subscription;
    }
  }

  private _enqueue(data: Uint8Array): void {
    if (this._isSourceCompleted || this._disposed || data.byteLength === 0) {
      return;
    }

    let offset = 0;
    while (offset < data.byteLength) {
      const availableBytes = TERMINAL_OUTPUT_MAX_FRAME_BYTES - this._frameBufferLength;
      const copiedBytes = Math.min(availableBytes, data.byteLength - offset);
      this._frameBuffer.set(data.subarray(offset, offset + copiedBytes), this._frameBufferLength);
      this._frameBufferLength += copiedBytes;
      offset += copiedBytes;

      if (this._frameBufferLength === TERMINAL_OUTPUT_MAX_FRAME_BYTES) {
        this._flushFrameBuffer();
      }
    }

    if (this._frameBufferLength > 0 && !this._frameTimer) {
      this._frameTimer = setTimeout(() => {
        this._frameTimer = null;
        this._flushFrameBuffer();
        this._drain();
      }, TERMINAL_OUTPUT_FRAME_INTERVAL_MS);
    }
    this._drain();
  }

  private _flushFrameBuffer(): void {
    if (this._frameBufferLength === 0) {
      return;
    }

    this._clearFrameTimer();
    const data = this._frameBufferLength === TERMINAL_OUTPUT_MAX_FRAME_BYTES
      ? this._frameBuffer
      : this._frameBuffer.slice(0, this._frameBufferLength);
    if (this._frameBufferLength === TERMINAL_OUTPUT_MAX_FRAME_BYTES) {
      this._frameBuffer = new Uint8Array(TERMINAL_OUTPUT_MAX_FRAME_BYTES);
    }
    this._frameBufferLength = 0;

    const frame: ITerminalOutputFrame = {
      sequence: this._nextSequence,
      data,
    };
    this._nextSequence = (this._nextSequence + 1) >>> 0;
    for (const client of this._clients) {
      client.pendingFrames.push(frame);
    }
  }

  private _clearFrameTimer(): void {
    if (!this._frameTimer) {
      return;
    }
    clearTimeout(this._frameTimer);
    this._frameTimer = null;
  }

  private _drain(): void {
    for (const client of [...this._clients]) {
      this._drainClient(client);
    }

    if (this._isSourceCompleted) {
      this._releaseSourcePause();
      this._tryComplete();
      return;
    }

    const hasPendingFrames = [...this._clients].some((client) => client.pendingFrameIndex < client.pendingFrames.length);
    if (hasPendingFrames && !this._isSourcePaused) {
      this._source.pauseOutput();
      this._isSourcePaused = true;
      return;
    }
    if (!hasPendingFrames && this._isSourcePaused) {
      this._source.resumeOutput();
      this._isSourcePaused = false;
    }
  }

  private _drainClient(client: IClientState): void {
    while (client.pendingFrameIndex < client.pendingFrames.length) {
      const frame = client.pendingFrames[client.pendingFrameIndex]!;
      if (
        frame.data.byteLength > client.availableCreditBytes
        || client.inFlightFrames.length >= TERMINAL_OUTPUT_CREDIT_FRAMES
      ) {
        break;
      }

      try {
        client.sink.send(frame);
      } catch (error) {
        this._removeClient(client);
        this._notifyError(client.sink, error instanceof Error ? error : new Error(String(error)));
        return;
      }

      client.availableCreditBytes -= frame.data.byteLength;
      client.inFlightFrames.push(frame);
      client.pendingFrameIndex += 1;
    }

    if (client.pendingFrameIndex === client.pendingFrames.length) {
      client.pendingFrames.length = 0;
      client.pendingFrameIndex = 0;
    }
  }

  private _acknowledge(client: IClientState, sequence: number): void {
    const acknowledgedIndex = client.inFlightFrames.findIndex((frame) => frame.sequence === sequence);
    if (acknowledgedIndex === -1) {
      return;
    }

    let acknowledgedBytes = 0;
    for (let index = 0; index <= acknowledgedIndex; index++) {
      acknowledgedBytes += client.inFlightFrames[index]!.data.byteLength;
    }
    client.inFlightFrames.splice(0, acknowledgedIndex + 1);
    client.availableCreditBytes = Math.min(
      TERMINAL_OUTPUT_CREDIT_BYTES,
      client.availableCreditBytes + acknowledgedBytes
    );
    this._drain();
  }

  private _removeClient(client: IClientState): void {
    if (!this._clients.delete(client)) {
      return;
    }
    client.pendingFrames.length = 0;
    client.inFlightFrames.length = 0;
    if (this._clients.size === 0) {
      this.dispose();
      return;
    }
    this._drain();
  }

  private _complete(): void {
    if (this._disposed || this._isSourceCompleted) {
      return;
    }
    this._flushFrameBuffer();
    this._isSourceCompleted = true;
    this._sourceSubscription = null;
    this._drain();
  }

  private _fail(error: Error): void {
    if (this._disposed || this._isSourceCompleted) {
      return;
    }
    this._flushFrameBuffer();
    this._sourceError = error;
    this._isSourceCompleted = true;
    this._sourceSubscription = null;
    this._drain();
  }

  private _tryComplete(): void {
    if (!this._isSourceCompleted) {
      return;
    }
    const hasUnacknowledgedFrames = [...this._clients].some((client) =>
      client.pendingFrameIndex < client.pendingFrames.length || client.inFlightFrames.length > 0
    );
    if (hasUnacknowledgedFrames) {
      return;
    }

    const clients = [...this._clients];
    this._clients.clear();
    this.dispose();
    for (const client of clients) {
      if (this._sourceError) {
        this._notifyError(client.sink, this._sourceError);
      } else {
        this._notifyComplete(client.sink);
      }
    }
  }

  private _releaseSourcePause(): void {
    if (!this._isSourcePaused) {
      return;
    }
    this._isSourcePaused = false;
    this._source.resumeOutput();
  }

  private _notifyComplete(sink: ITerminalOutputSink): void {
    try {
      sink.complete();
    } catch {
      // The transport may already be closed; the flow is complete regardless.
    }
  }

  private _notifyError(sink: ITerminalOutputSink, error: Error): void {
    try {
      sink.error(error);
    } catch {
      // The transport may already be closed; the source error is already terminal.
    }
  }
}

const SOURCE_WAIT_TIMEOUT_MS = 10_000;

export class TerminalOutputStreamService extends Disposable implements ITerminalOutputStreamService {
  private readonly _flows = new Map<string, TerminalOutputFlow>();

  constructor(
    @IPTYSessionServiceIdentifier private readonly _ptySessionService: IPTYSessionService,
    @ISSHSessionServiceIdentifier private readonly _sshSessionService: ISSHSessionService,
    @ITerminalSessionNotifyService private readonly _sessionNotifyService: ITerminalSessionNotifyService
  ) {
    super();
  }

  async open(source: TerminalOutputSourceType, sessionId: string, sink: ITerminalOutputSink): Promise<ITerminalOutputStreamHandle> {
    this.ensureNotDisposed();
    const key = `${source}:${sessionId}`;
    let flow = this._flows.get(key);
    if (!flow) {
      const outputSource = await this._resolveSource(source, sessionId);
      this.ensureNotDisposed();
      // Another concurrent open() may have created the flow while this one
      // was waiting for the session to appear.
      flow = this._flows.get(key);
      if (!flow) {
        flow = new TerminalOutputFlow(outputSource, (terminatedFlow) => {
          if (this._flows.get(key) === terminatedFlow) {
            this._flows.delete(key);
          }
        });
        this._flows.set(key, flow);
      }
    }

    const handle = flow.attach(sink);
    let isDisposed = false;
    return {
      acknowledge: (sequence) => handle.acknowledge(sequence),
      dispose: () => {
        if (isDisposed) {
          return;
        }
        isDisposed = true;
        handle.dispose();
        if (flow.clientCount === 0) {
          flow.dispose();
        }
      },
    };
  }

  override dispose(): void {
    super.dispose();
    for (const flow of this._flows.values()) {
      flow.dispose();
    }
    this._flows.clear();
  }

  private _lookupSource(source: TerminalOutputSourceType, sessionId: string): ITerminalOutputSource | undefined {
    const session = source === 'pty'
      ? this._ptySessionService.getSession(sessionId)
      : this._sshSessionService.getSession(sessionId);
    return session as ITerminalOutputSource | undefined;
  }

  private async _resolveSource(source: TerminalOutputSourceType, sessionId: string): Promise<ITerminalOutputSource> {
    const existing = this._lookupSource(source, sessionId);
    if (existing) {
      return existing;
    }

    // The lookup above and the subscription inside firstValueFrom happen in
    // the same synchronous run, so a creation event cannot slip through.
    // Session services register the session before notifying, so the event
    // guarantees the follow-up lookup succeeds.
    await firstValueFrom(
      this._sessionNotifyService.sessionCreated$.pipe(
        filter((event) => event.sessionId === sessionId),
        take(1),
        timeout({ first: SOURCE_WAIT_TIMEOUT_MS }),
        catchError(() => throwError(() => new Error(`Terminal output source ${source}:${sessionId} not found`)))
      )
    );

    const resolved = this._lookupSource(source, sessionId);
    if (!resolved) {
      throw new Error(`Terminal output source ${source}:${sessionId} not found`);
    }
    return resolved;
  }
}
