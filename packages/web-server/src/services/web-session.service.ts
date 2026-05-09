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

import type { Buffer as BufferType } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Observable } from 'rxjs';
import type { IWebServerConfig } from '../controllers/config.schema';
import { randomBytes } from 'node:crypto';
import { createIdentifier, Disposable, IConfigService, ILogService } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { DEFAULT_SESSION_IDLE_TIMEOUT_MS, WEB_SERVER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';

/** Cookie name carrying the opaque session identifier. */
export const SESSION_COOKIE_NAME = 'termlnk-web-sid';

/** Session bookkeeping kept in process memory; never persisted. */
export interface IWebSession {
  /** Unguessable random ID (256-bit) used both as cookie value and map key. */
  readonly id: string;
  /** Wall-clock millis at the most recent activity for this session. */
  lastActivityAt: number;
  /** Wall-clock millis when the session was created (login). */
  readonly createdAt: number;
}

export interface IWebSessionService {
  readonly activeCount$: Observable<number>;

  /** Create a new session post-login. Returns the session ID for the cookie. */
  create(): IWebSession;

  /** Look up a session by ID. Bumps `lastActivityAt` on hit. Returns null on miss / expired. */
  touch(sessionId: string): IWebSession | null;

  /** Drop a session immediately (logout). No-op when not present. */
  destroy(sessionId: string): void;

  /** Drop every session right now. Used on dispose / forced re-auth. */
  destroyAll(): void;

  /**
   * Parse the session cookie out of a request and call `touch`. Returns null
   * when the cookie is absent or maps to an expired/unknown session.
   */
  resolveFromRequest(req: IncomingMessage): IWebSession | null;

  /**
   * Write the session cookie on a response. `HttpOnly + Secure + SameSite=Strict`
   * with no Max-Age — the cookie ends with the browser tab unless the client
   * sees an explicit `clear` from `clearCookie`. Idle eviction lives entirely
   * server-side so a stolen cookie value still expires.
   */
  setCookie(res: ServerResponse, session: IWebSession, opts: { secure: boolean }): void;

  /** Erase the cookie on the client (Max-Age=0). */
  clearCookie(res: ServerResponse, opts: { secure: boolean }): void;
}

export const IWebSessionService = createIdentifier<IWebSessionService>('web-server.web-session.service');

const SESSION_ID_LEN_BYTES = 32;

export class WebSessionService extends Disposable implements IWebSessionService {
  private readonly _sessions = new Map<string, IWebSession>();
  private readonly _activeCount$ = new BehaviorSubject<number>(0);
  readonly activeCount$: Observable<number> = this._activeCount$.asObservable();

  private _sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    // Sweep every 60s — fine-grained enough that idle eviction lands within
    // (idleTimeoutMs + 60s) of true idle, coarse enough not to be a CPU sink.
    this._sweepTimer = setInterval(() => this._sweepIdle(), 60_000);
    // Don't keep the Node event loop alive just for the sweeper.
    if (typeof this._sweepTimer.unref === 'function') {
      this._sweepTimer.unref();
    }
  }

  override dispose(): void {
    super.dispose();
    if (this._sweepTimer) {
      clearInterval(this._sweepTimer);
      this._sweepTimer = null;
    }
    this._sessions.clear();
    this._activeCount$.next(0);
    this._activeCount$.complete();
  }

  create(): IWebSession {
    const id = this._generateId();
    const now = Date.now();
    const session: IWebSession = { id, createdAt: now, lastActivityAt: now };
    this._sessions.set(id, session);
    this._activeCount$.next(this._sessions.size);
    return session;
  }

  touch(sessionId: string): IWebSession | null {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return null;
    }
    const idleTimeoutMs = this._idleTimeoutMs();
    if (Date.now() - session.lastActivityAt > idleTimeoutMs) {
      this._sessions.delete(sessionId);
      this._activeCount$.next(this._sessions.size);
      return null;
    }
    session.lastActivityAt = Date.now();
    return session;
  }

  destroy(sessionId: string): void {
    if (this._sessions.delete(sessionId)) {
      this._activeCount$.next(this._sessions.size);
    }
  }

  destroyAll(): void {
    if (this._sessions.size === 0) {
      return;
    }
    this._sessions.clear();
    this._activeCount$.next(0);
  }

  resolveFromRequest(req: IncomingMessage): IWebSession | null {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return null;
    }
    const sessionId = parseCookieValue(cookieHeader, SESSION_COOKIE_NAME);
    if (!sessionId) {
      return null;
    }
    return this.touch(sessionId);
  }

  setCookie(res: ServerResponse, session: IWebSession, opts: { secure: boolean }): void {
    const parts = [
      `${SESSION_COOKIE_NAME}=${session.id}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
    ];
    if (opts.secure) {
      parts.push('Secure');
    }
    appendSetCookie(res, parts.join('; '));
  }

  clearCookie(res: ServerResponse, opts: { secure: boolean }): void {
    const parts = [
      `${SESSION_COOKIE_NAME}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      'Max-Age=0',
    ];
    if (opts.secure) {
      parts.push('Secure');
    }
    appendSetCookie(res, parts.join('; '));
  }

  private _idleTimeoutMs(): number {
    const cfg = this._configService.getConfig<IWebServerConfig>(WEB_SERVER_PLUGIN_CONFIG_KEY);
    return cfg?.sessionIdleTimeoutMs ?? DEFAULT_SESSION_IDLE_TIMEOUT_MS;
  }

  private _sweepIdle(): void {
    const idleTimeoutMs = this._idleTimeoutMs();
    const cutoff = Date.now() - idleTimeoutMs;
    let dropped = 0;
    for (const [id, session] of this._sessions) {
      if (session.lastActivityAt < cutoff) {
        this._sessions.delete(id);
        dropped += 1;
      }
    }
    if (dropped > 0) {
      this._activeCount$.next(this._sessions.size);
      this._logService.log(`[WebSessionService] swept ${dropped} idle session(s)`);
    }
  }

  private _generateId(): string {
    const bytes: BufferType = randomBytes(SESSION_ID_LEN_BYTES);
    // base64url — cookie-safe, no `=` padding glitches when split downstream.
    return bytes.toString('base64url');
  }
}

function parseCookieValue(header: string, name: string): string | null {
  // Lightweight parser — RFC 6265 cookie-pair splitting. Avoids pulling the
  // `cookie` package for one trivial lookup.
  const target = `${name}=`;
  const segments = header.split(';');
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (trimmed.startsWith(target)) {
      return trimmed.slice(target.length);
    }
  }
  return null;
}

function appendSetCookie(res: ServerResponse, value: string): void {
  // Multiple Set-Cookie headers may already be present; preserve them.
  const existing = res.getHeader('Set-Cookie');
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, value]);
  } else if (typeof existing === 'string') {
    res.setHeader('Set-Cookie', [existing, value]);
  } else {
    res.setHeader('Set-Cookie', value);
  }
}
