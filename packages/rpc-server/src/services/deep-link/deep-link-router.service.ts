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

import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, ILogService } from '@termlnk/core';
import { Subject } from 'rxjs';

/**
 * Process-local router for OS-level deep links (termlnk://).
 *
 * electron-main captures `open-url` (macOS) and `second-instance` argv
 * (win/linux) events and feeds each URL into `emit`. The router parses the URL
 * once and dispatches it to the single route registered for its host
 * (`termlnk://<host>/...`), so every deep link reaches exactly one owner: OAuth
 * callbacks (`host=auth`) never leak into the invite stream (`host=invite`) and
 * vice versa. A URL whose host has no registered route is logged and dropped
 * rather than broadcast to every consumer.
 *
 * Lives in @termlnk/rpc-server so the renderer can pull a host's route through a
 * tRPC subscription without electron-main having to know about tRPC routes.
 */
export interface IDeepLinkRouterService {
  /** Feed a raw OS deep-link URL; dispatched to the route matching its host. */
  emit(url: string): void;
  /** Stream of deep-link URLs whose `termlnk://<host>` equals `host`. */
  route(host: string): Observable<string>;
}

export const IDeepLinkRouterService = createIdentifier<IDeepLinkRouterService>('rpc-server.deep-link-router.service');

export class DeepLinkRouterService extends Disposable implements IDeepLinkRouterService {
  private readonly _routes = new Map<string, Subject<string>>();

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  emit(url: string): void {
    const host = this._hostOf(url);
    if (host === null) {
      this._logService.warn(`[DeepLinkRouterService] dropping unparseable deep link: ${url}`);
      return;
    }
    const route = this._routes.get(host);
    if (!route) {
      this._logService.warn(`[DeepLinkRouterService] no route registered for host '${host}', dropping: ${url}`);
      return;
    }
    route.next(url);
  }

  route(host: string): Observable<string> {
    return this._ensureRoute(host).asObservable();
  }

  private _ensureRoute(host: string): Subject<string> {
    let subject = this._routes.get(host);
    if (!subject) {
      subject = new Subject<string>();
      this._routes.set(host, subject);
    }
    return subject;
  }

  private _hostOf(url: string): string | null {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  override dispose(): void {
    super.dispose();
    for (const subject of this._routes.values()) {
      subject.complete();
    }
    this._routes.clear();
  }
}
