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

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Observable } from 'rxjs';
import type { IWebSession, IWebSessionService } from '../services/web-session.service';
import { BehaviorSubject } from 'rxjs';

/**
 * In-memory IWebSessionService stub used by transport-layer specs that need a
 * session decision but do not exercise the cookie / Argon2id path themselves.
 *
 * Two modes:
 * - `mode: 'allow-all'` — every `resolveFromRequest` call yields a synthetic
 *   session, so the transport's `authenticate` gate becomes a pass-through.
 *   Lets the existing P7.1a / P7.1b specs keep asserting transport behaviour
 *   without re-implementing the full login flow.
 * - `mode: 'cookie-required'` — the stub honours a single fixed cookie value
 *   ("test-session") and rejects anything else. Used by the new authentication
 *   specs that explicitly test the 401 / socket.destroy paths.
 */
export class FakeWebSessionService implements IWebSessionService {
  private readonly _activeCount$ = new BehaviorSubject<number>(0);
  readonly activeCount$: Observable<number> = this._activeCount$.asObservable();

  constructor(private readonly _mode: 'allow-all' | 'cookie-required' = 'allow-all') {}

  create(): IWebSession {
    const now = Date.now();
    return { id: 'test-session', createdAt: now, lastActivityAt: now };
  }

  touch(sessionId: string): IWebSession | null {
    if (this._mode === 'allow-all') {
      return { id: sessionId, createdAt: Date.now(), lastActivityAt: Date.now() };
    }
    return sessionId === 'test-session'
      ? { id: sessionId, createdAt: Date.now(), lastActivityAt: Date.now() }
      : null;
  }

  destroy(): void {}
  destroyAll(): void {}

  resolveFromRequest(req: IncomingMessage): IWebSession | null {
    if (this._mode === 'allow-all') {
      return this.create();
    }
    const cookieHeader = req.headers.cookie ?? '';
    if (cookieHeader.includes('termlnk-web-sid=test-session')) {
      return this.create();
    }
    return null;
  }

  setCookie(res: ServerResponse, session: IWebSession): void {
    res.setHeader('Set-Cookie', `termlnk-web-sid=${session.id}; Path=/; HttpOnly; SameSite=Strict`);
  }

  clearCookie(res: ServerResponse): void {
    res.setHeader('Set-Cookie', 'termlnk-web-sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  }
}
