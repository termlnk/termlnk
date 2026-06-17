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

import type { IPermissionRequestPayload } from '@termlnk/island';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { distinctUntilChanged, map } from 'rxjs';
import { IIslandUIStateService } from './island-state.service';

/**
 * Facade over the permission-request UI flow. The React view is a pure
 * renderer of `activeRequest$`; every mutation (allow / deny) goes through
 * one of the methods here.
 *
 * AskUserQuestion pendings do not flow through this service — each agent's
 * CLI TUI handles those picks natively, so the island just shows the pet's
 * Question state without any interactive UI.
 */
export interface IPermissionRequestService {
  /** The permission request currently surfaced in the approval scene (or `null`). */
  readonly activeRequest$: Observable<IPermissionRequestPayload | null>;

  /** Approve the given permission request. */
  allow(requestId: string): void;

  /** Reject the given permission request. */
  deny(requestId: string): void;
}

export const IPermissionRequestService = createIdentifier<IPermissionRequestService>('island-ui.permission-request-service');

export class PermissionRequestService extends Disposable implements IPermissionRequestService {
  readonly activeRequest$: Observable<IPermissionRequestPayload | null>;

  constructor(
    @IIslandUIStateService private readonly _stateService: IIslandUIStateService
  ) {
    super();

    this.activeRequest$ = this._stateService.pendingInteractions$.pipe(
      map((interactions) =>
        interactions.find((p): p is IPermissionRequestPayload => p.kind === 'permission') ?? null
      ),
      distinctUntilChanged((a, b) => a?.requestId === b?.requestId)
    );
  }

  allow(requestId: string): void {
    this._stateService.respondPermission(requestId, { kind: 'allow' });
  }

  deny(requestId: string): void {
    this._stateService.respondPermission(requestId, { kind: 'deny' });
  }
}
