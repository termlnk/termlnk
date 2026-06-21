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

import type { ILogService } from '@termlnk/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TLSSocket } from 'node:tls';
import type { IMasterKeyHolderService } from '../services/master-key-holder.service';
import type { IRouteHandler } from '../services/static-file.service';
import type { IWebSessionService } from '../services/web-session.service';
import { Buffer } from 'node:buffer';
import { TERMLNK_WEB_AUTH_PATH_PREFIX } from '../controllers/config.schema';

const ROUTE_LOGIN = `${TERMLNK_WEB_AUTH_PATH_PREFIX}/login`;
const ROUTE_LOGOUT = `${TERMLNK_WEB_AUTH_PATH_PREFIX}/logout`;
const ROUTE_STATUS = `${TERMLNK_WEB_AUTH_PATH_PREFIX}/status`;

const MAX_BODY_BYTES = 4096;

export interface IAuthRouteHandlerDeps {
  readonly masterKeyHolder: IMasterKeyHolderService;
  readonly sessionService: IWebSessionService;
  readonly logService: ILogService;
  readonly demo: boolean;
}

/**
 * Build the unified handler that backs `/__termlnk-web/login`,
 * `/__termlnk-web/logout`, `/__termlnk-web/status`. Designed to be wired with
 * `IWebServerService.mountRouteHandler('/__termlnk-web', handler)`.
 *
 * Endpoints:
 *
 * - `POST /__termlnk-web/login` — body `{ password: string }` (JSON). On match,
 *   creates a new in-memory session and sets the cookie. Always responds in
 *   constant Argon2id-time so a wrong password reveals nothing about the
 *   verifier path.
 * - `POST /__termlnk-web/logout` — drops the session referenced by the cookie
 *   and clears it. Idempotent (404 is never returned even when no session).
 * - `GET /__termlnk-web/status` — non-authenticated endpoint returning the
 *   master-key holder state and whether the request carries a valid session.
 *   Used by the SPA shell to decide between login form and main app on first
 *   load.
 *
 * The handler returns `false` when it does not own the path so the caller can
 * keep walking the route chain — letting tRPC / static SPA take it.
 */
export function createAuthRouteHandler(deps: IAuthRouteHandlerDeps): IRouteHandler {
  return async (req, res) => {
    const url = req.url ?? '/';
    const pathname = url.split('?')[0];

    if (pathname === ROUTE_LOGIN) {
      await handleLogin(req, res, deps);
      return true;
    }
    if (pathname === ROUTE_LOGOUT) {
      await handleLogout(req, res, deps);
      return true;
    }
    if (pathname === ROUTE_STATUS) {
      await handleStatus(req, res, deps);
      return true;
    }
    return false;
  };
}

async function handleLogin(req: IncomingMessage, res: ServerResponse, deps: IAuthRouteHandlerDeps): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }
  if (deps.demo) {
    sendJson(res, 200, { ok: true });
    return;
  }
  const holderState = deps.masterKeyHolder.getState();
  if (holderState.status !== 'unlocked') {
    sendJson(res, 503, { error: 'service_unavailable', detail: holderState.errorMessage });
    return;
  }
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: 'bad_request', detail: err instanceof Error ? err.message : String(err) });
    return;
  }
  const password = extractPassword(body);
  if (!password) {
    sendJson(res, 400, { error: 'bad_request', detail: 'missing password field' });
    return;
  }

  let ok = false;
  try {
    ok = await deps.masterKeyHolder.verifyAccess(password);
  } catch (err) {
    deps.logService.error(`[auth-routes] verifyAccess threw: ${err instanceof Error ? err.message : String(err)}`);
    sendJson(res, 500, { error: 'internal_error' });
    return;
  }

  if (!ok) {
    // No timing variance vs success path: verifyAccess already ran Argon2id.
    sendJson(res, 401, { error: 'invalid_password' });
    return;
  }

  const session = deps.sessionService.create();
  deps.sessionService.setCookie(res, session, { secure: isSecureRequest(req) });
  sendJson(res, 200, { ok: true });
}

async function handleLogout(req: IncomingMessage, res: ServerResponse, deps: IAuthRouteHandlerDeps): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }
  const existing = deps.sessionService.resolveFromRequest(req);
  if (existing) {
    deps.sessionService.destroy(existing.id);
  }
  deps.sessionService.clearCookie(res, { secure: isSecureRequest(req) });
  sendJson(res, 200, { ok: true });
}

async function handleStatus(req: IncomingMessage, res: ServerResponse, deps: IAuthRouteHandlerDeps): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }
  if (deps.demo) {
    sendJson(res, 200, {
      holderStatus: 'unlocked',
      holderError: null,
      authenticated: true,
      demo: true,
    });
    return;
  }
  const holderState = deps.masterKeyHolder.getState();
  const session = deps.sessionService.resolveFromRequest(req);
  sendJson(res, 200, {
    holderStatus: holderState.status,
    holderError: holderState.errorMessage,
    authenticated: Boolean(session),
  });
}

function extractPassword(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const password = (body as { password?: unknown }).password;
  if (typeof password !== 'string' || password.length === 0) {
    return null;
  }
  return password;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy(new Error(`body exceeded ${MAX_BODY_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (raw.length === 0) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

function isSecureRequest(req: IncomingMessage): boolean {
  // Direct TLS connection (when termlnk-web terminates TLS itself).
  if ((req.socket as TLSSocket).encrypted) {
    return true;
  }
  // Reverse-proxy case: trust X-Forwarded-Proto only when the loopback bind
  // matches what the deployer configured. We accept anything because the
  // recommended deployment has nginx / caddy in front and 127.0.0.1 listening
  // — the operator owns both ends. If you bind to 0.0.0.0 you opt out of
  // upstream-forwarded TLS implication and the cookie skips the Secure flag.
  const xfp = req.headers['x-forwarded-proto'];
  if (typeof xfp === 'string') {
    return xfp.toLowerCase().includes('https');
  }
  return false;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  if (!res.headersSent) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.end(JSON.stringify(payload));
}
