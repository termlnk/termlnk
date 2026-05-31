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

import type { IShareableSession } from '@termlnk/shared-terminal';
import type { ITerminalSession } from '@termlnk/terminal-ui';
import { ILogService, Optional, RxDisposable } from '@termlnk/core';
import { ISharedSessionService } from '@termlnk/shared-terminal';
import { ITerminalUIService } from '@termlnk/terminal-ui';
import { combineLatest, takeUntil } from 'rxjs';

const TITLE_DEBOUNCE_MS = 200;

/**
 * Renderer-side title forwarder for owner-side shared sessions.
 *
 * The owner's local PTY emits OSC 0/1/2 on every prompt, so its visible tab
 * title shifts on every command. This controller watches ITerminalUIService's
 * tab list, picks out sessions that are currently being shared, and forwards
 * each new title to the main process via ISharedSessionService.setSessionTitle.
 * The daemon broadcasts the new title to every joiner via a session_metadata
 * SessionEvent so their tab UI stays in sync.
 *
 * Per-session debouncing (200ms) prevents OSC spam.
 */
export class SharedSessionTitleSyncController extends RxDisposable {
  /** Last value we successfully pushed, per sessionId. Avoids redundant RPCs. */
  private readonly _lastSent = new Map<string, string>();
  /** Pending debounce timers, per sessionId. */
  private readonly _pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @ITerminalUIService private readonly _terminalUIService: ITerminalUIService,
    @Optional(ISharedSessionService) private readonly _shared?: ISharedSessionService
  ) {
    super();

    if (!this._shared) {
      return;
    }
    this._wire(this._shared);
  }

  override dispose(): void {
    super.dispose();
    for (const timer of this._pendingTimers.values()) {
      clearTimeout(timer);
    }
    this._pendingTimers.clear();
    this._lastSent.clear();
  }

  private _wire(shared: ISharedSessionService): void {
    combineLatest([this._terminalUIService.sessions$, shared.shareable$])
      .pipe(takeUntil(this.dispose$))
      .subscribe(([sessions, shareable]) => {
        const sharedSet = sharedSessionIds(shareable);
        // For every currently-shared session, schedule a debounced title push.
        for (const session of sessions) {
          if (!sharedSet.has(session.id)) {
            continue;
          }
          const title = sessionTitleOf(session);
          if (title === undefined) {
            continue;
          }
          if (this._lastSent.get(session.id) === title) {
            continue;
          }
          this._scheduleTitlePush(shared, session.id, title);
        }
        // A session that stopped being shared shouldn't keep accumulating
        // stale pending timers — drop them and forget the last-sent value so
        // a future re-share with the same visible title still pushes once
        // (otherwise the same-value dedupe guard would silently swallow it).
        for (const sid of [...this._pendingTimers.keys()]) {
          if (!sharedSet.has(sid)) {
            clearTimeout(this._pendingTimers.get(sid)!);
            this._pendingTimers.delete(sid);
          }
        }
        for (const sid of [...this._lastSent.keys()]) {
          if (!sharedSet.has(sid)) {
            this._lastSent.delete(sid);
          }
        }
      });
  }

  private _scheduleTitlePush(shared: ISharedSessionService, sessionId: string, title: string): void {
    const existing = this._pendingTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this._pendingTimers.delete(sessionId);
      shared.setSessionTitle(sessionId, title)
        .then(() => {
          this._lastSent.set(sessionId, title);
        })
        .catch((err) => {
          this._logService.warn(`[SharedSessionTitleSyncController] setSessionTitle ${sessionId} failed:`, err);
        });
    }, TITLE_DEBOUNCE_MS);
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
      (timer as { unref: () => void }).unref();
    }
    this._pendingTimers.set(sessionId, timer);
  }
}

function sharedSessionIds(shareable: readonly IShareableSession[]): Set<string> {
  const out = new Set<string>();
  for (const s of shareable) {
    if (s.shared) {
      out.add(s.sessionId);
    }
  }
  return out;
}

function sessionTitleOf(session: ITerminalSession): string | undefined {
  // Prefer the OSC-driven user-facing title; fall back to host name from
  // the registry, which matches what TerminalTabBar shows in the absence of
  // an OSC title (so joiners see the same string as the owner's tab).
  if (session.title && session.title.length > 0) {
    return session.title;
  }
  if (session.hostName && session.hostName.length > 0) {
    return session.hostName;
  }
  return undefined;
}
