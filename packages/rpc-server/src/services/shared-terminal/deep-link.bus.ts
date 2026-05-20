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
import { createIdentifier, Disposable } from '@termlnk/core';
import { Subject } from 'rxjs';

/**
 * Process-local pub/sub for OS-level deep links (termlnk://).
 *
 * The electron-main side captures `open-url` (macOS) and `second-instance` argv
 * (win/linux) events and forwards each URL into this bus. Any consumer (multiplayer
 * router, deep-link audit log, etc.) subscribes to react.
 *
 * Lives in @termlnk/rpc-server so the renderer can hit it through a tRPC subscription
 * without electron-main having to know about tRPC routes.
 */
export interface IDeepLinkBus {
  readonly url$: Observable<string>;
  emit(url: string): void;
}

export const IDeepLinkBus = createIdentifier<IDeepLinkBus>('rpc-server.deep-link-bus');

export class DeepLinkBus extends Disposable implements IDeepLinkBus {
  private readonly _url$ = new Subject<string>();
  readonly url$: Observable<string> = this._url$.asObservable();

  emit(url: string): void {
    this._url$.next(url);
  }

  override dispose(): void {
    super.dispose();
    this._url$.complete();
  }
}
