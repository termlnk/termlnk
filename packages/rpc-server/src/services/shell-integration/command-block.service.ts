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

import type { ITerminalCommand } from '@termlnk/terminal';
import type { Buffer } from 'node:buffer';
import type { Observable, Subscription } from 'rxjs';
import type { IBlockStartedEvent, INaturalLanguageQueryEvent, IPendingBlockSnapshot } from './command-block-tracker';
import { createIdentifier, Disposable, ILogService } from '@termlnk/core';
import { Subject } from 'rxjs';
import { CommandBlockTracker } from './command-block-tracker';

export interface IAttachSessionOptions {
  /** Override per-command output byte cap. Defaults to 512KB. */
  maxOutputBytes?: number;
  /** If true, retain raw (ANSI-preserved) output on the emitted block. */
  keepRawOutput?: boolean;
}

export interface ICommandBlockService {
  /** Emits every completed command block, tagged with its sessionId. */
  readonly blockFinished$: Observable<ITerminalCommand>;
  /** Emits {sessionId, blockId} as soon as a new pending block is created. */
  readonly blockStarted$: Observable<IBlockStartedEvent>;
  /**
   * Emits each natural-language query intercepted by the shell (OSC 633;Q).
   * Carries the decoded UTF-8 query plus a per-session monotonic seq.
   */
  readonly query$: Observable<INaturalLanguageQueryEvent>;
  /**
   * Attach a command block tracker to a terminal session's raw data stream.
   * Safe to call multiple times for the same sessionId — subsequent calls are
   * ignored (the first attach wins).
   */
  attachSession(
    sessionId: string,
    data$: Observable<Buffer | Uint8Array | string>,
    options?: IAttachSessionOptions
  ): void;
  /** Detach and clean up the tracker for a session. */
  detachSession(sessionId: string): void;
  /** Get all finished blocks for a session in insertion order. */
  getBlocks(sessionId: string): ITerminalCommand[];
  /** Get the most recently finished block for a session, or null. */
  getLastBlock(sessionId: string): ITerminalCommand | null;
  /**
   * Look up a block by id. Checks finished blocks first, then falls back to
   * the in-progress pending block if its id matches.
   */
  getBlockById(sessionId: string, blockId: string): ITerminalCommand | null;
  /** Snapshot of the current pending (in-progress) block, or null. */
  getPendingSnapshot(sessionId: string): IPendingBlockSnapshot | null;
  /** Get the current reported CWD for a session (empty string if unknown). */
  getCurrentCwd(sessionId: string): string;
  /** Whether a tracker is attached for a given session. */
  isAttached(sessionId: string): boolean;
  /**
   * Number of OSC 633 events observed for a session so far.
   * > 0 means shell integration is (at least partly) active; 0 means the
   * remote shell never emitted an OSC 633 event (injection didn't take).
   */
  getOsc633EventCount(sessionId: string): number;
}

export const ICommandBlockService = createIdentifier<ICommandBlockService>('rpc-server.command-block.service');

interface ISessionEntry {
  tracker: CommandBlockTracker;
  dataSub: Subscription;
  blockSub: Subscription;
  startedSub: Subscription;
  querySub: Subscription;
}

export class CommandBlockService extends Disposable implements ICommandBlockService {
  private readonly _sessions = new Map<string, ISessionEntry>();

  private readonly _blockFinished$ = new Subject<ITerminalCommand>();
  readonly blockFinished$: Observable<ITerminalCommand> = this._blockFinished$.asObservable();

  private readonly _blockStarted$ = new Subject<IBlockStartedEvent>();
  readonly blockStarted$: Observable<IBlockStartedEvent> = this._blockStarted$.asObservable();

  private readonly _query$ = new Subject<INaturalLanguageQueryEvent>();
  readonly query$: Observable<INaturalLanguageQueryEvent> = this._query$.asObservable();

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  attachSession(
    sessionId: string,
    data$: Observable<Buffer | Uint8Array | string>,
    options: IAttachSessionOptions = {}
  ): void {
    if (this._sessions.has(sessionId)) {
      return;
    }

    const tracker = new CommandBlockTracker({
      sessionId,
      maxOutputBytes: options.maxOutputBytes,
      keepRawOutput: options.keepRawOutput,
    });

    const decoder = new TextDecoder('utf-8');

    const dataSub = data$.subscribe({
      next: (data) => {
        try {
          const text = typeof data === 'string'
            ? data
            : decoder.decode(data instanceof Uint8Array ? data : new Uint8Array(data), { stream: true });
          tracker.feed(text);
        } catch (err) {
          this._logService.error('[CommandBlockService]', `decode/feed failed for ${sessionId}:`, err);
        }
      },
      error: (err) => {
        this._logService.error('[CommandBlockService]', `data$ error for ${sessionId}:`, err);
      },
    });

    const blockSub = tracker.blockFinished$.subscribe((block) => {
      this._blockFinished$.next(block);
    });

    const startedSub = tracker.blockStarted$.subscribe((event) => {
      this._blockStarted$.next(event);
    });

    const querySub = tracker.query$.subscribe((event) => {
      this._query$.next(event);
    });

    this._sessions.set(sessionId, { tracker, dataSub, blockSub, startedSub, querySub });
  }

  detachSession(sessionId: string): void {
    const entry = this._sessions.get(sessionId);
    if (!entry) {
      return;
    }
    entry.dataSub.unsubscribe();
    entry.blockSub.unsubscribe();
    entry.startedSub.unsubscribe();
    entry.querySub.unsubscribe();
    entry.tracker.dispose();
    this._sessions.delete(sessionId);
  }

  getBlocks(sessionId: string): ITerminalCommand[] {
    return this._sessions.get(sessionId)?.tracker.getBlocks() ?? [];
  }

  getLastBlock(sessionId: string): ITerminalCommand | null {
    return this._sessions.get(sessionId)?.tracker.getLastBlock() ?? null;
  }

  getBlockById(sessionId: string, blockId: string): ITerminalCommand | null {
    return this._sessions.get(sessionId)?.tracker.getBlockById(blockId) ?? null;
  }

  getPendingSnapshot(sessionId: string): IPendingBlockSnapshot | null {
    return this._sessions.get(sessionId)?.tracker.snapshotPending() ?? null;
  }

  getCurrentCwd(sessionId: string): string {
    return this._sessions.get(sessionId)?.tracker.currentCwd ?? '';
  }

  isAttached(sessionId: string): boolean {
    return this._sessions.has(sessionId);
  }

  getOsc633EventCount(sessionId: string): number {
    return this._sessions.get(sessionId)?.tracker.osc633EventCount ?? 0;
  }

  override dispose(): void {
    for (const sessionId of Array.from(this._sessions.keys())) {
      this.detachSession(sessionId);
    }
    this._sessions.clear();
    this._blockFinished$.complete();
    this._blockStarted$.complete();
    this._query$.complete();
    super.dispose();
  }
}
