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

import type { IPendingInteractionPayload, IPermissionDecision, IPermissionViewModel } from '@termlnk/island';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { toPermissionViewModel } from '@termlnk/island';
import { distinctUntilChanged, map } from 'rxjs';
import { IIslandUIStateService } from './island-state.service';

/**
 * Facade over the permission-request UI flow. The React view is a pure
 * renderer of `activeViewModel$`; every mutation (allow / deny / pick an
 * option) goes through one of the methods here.
 *
 * Mirrors Univer's `DesktopConfirmService` pattern: service owns state and
 * mutations; React observes via `useObservable` and dispatches intents.
 */
export interface IPermissionRequestService {
  /** The interaction currently surfaced in the approval scene (or `null`). */
  readonly activeRequest$: Observable<IPendingInteractionPayload | null>;

  /**
   * Pre-computed view-model for the active request. Encapsulates derived
   * fields (`primaryTarget`, `optionCount`, `isQuestion`) so the React
   * component never has to run the derivation itself.
   */
  readonly activeViewModel$: Observable<IPermissionViewModel | null>;

  /** Approve the given request (permission kind only). */
  allow(requestId: string): void;

  /** Reject the given request. */
  deny(requestId: string): void;

  /**
   * Pick an option by label or by zero-based index. Index-mode is used by
   * the ⌘1–⌘9 shortcuts; label-mode by click handlers. Index lookup runs
   * against the live `activeRequest$` — stale indices (option list
   * changed between keypress and handler) are silently dropped.
   */
  selectOption(requestId: string, label: string): void;
  selectOptionByIndex(requestId: string, index: number): void;
}

export const IPermissionRequestService = createIdentifier<IPermissionRequestService>('island-ui.permission-request-service');

export class PermissionRequestService extends Disposable implements IPermissionRequestService {
  readonly activeRequest$: Observable<IPendingInteractionPayload | null>;
  readonly activeViewModel$: Observable<IPermissionViewModel | null>;

  constructor(
    @IIslandUIStateService private readonly _stateService: IIslandUIStateService
  ) {
    super();

    this.activeRequest$ = this._stateService.pendingInteractions$.pipe(
      map((interactions) => interactions[0] ?? null),
      distinctUntilChanged((a, b) => a?.requestId === b?.requestId)
    );

    this.activeViewModel$ = this.activeRequest$.pipe(
      map((request) => request ? toPermissionViewModel(request) : null),
      distinctUntilChanged((a, b) => a?.request.requestId === b?.request.requestId)
    );
  }

  allow(requestId: string): void {
    this._respond(requestId, { kind: 'allow' });
  }

  deny(requestId: string): void {
    this._respond(requestId, { kind: 'deny' });
  }

  selectOption(requestId: string, label: string): void {
    this._respond(requestId, { kind: 'answer', label });
  }

  selectOptionByIndex(requestId: string, index: number): void {
    const active = this._currentActive();
    if (!active || active.requestId !== requestId || active.kind !== 'question') {
      return;
    }
    const option = active.question.options[index];
    if (!option) {
      return;
    }
    this._respond(requestId, { kind: 'answer', label: option.label });
  }

  private _respond(requestId: string, decision: IPermissionDecision): void {
    this._stateService.respondPermission(requestId, decision);
  }

  private _currentActive(): IPendingInteractionPayload | null {
    // Snapshot via synchronous getValue on the underlying BehaviorSubject.
    // Safe because pendingInteractions$ is always a BehaviorSubject in
    // the state service.
    let snapshot: IPendingInteractionPayload | null = null;
    const sub = this._stateService.pendingInteractions$.subscribe((list) => {
      snapshot = list[0] ?? null;
    });
    sub.unsubscribe();
    return snapshot;
  }
}
