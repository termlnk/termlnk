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

import type { IAgentToolPermissionRequest, ISuggestedRule } from '@termlnk/agent';
import type { IValueOption } from '@termlnk/ui';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { IAgentToolPermissionService } from '@termlnk/rpc-client';
import { BehaviorSubject, map } from 'rxjs';

export interface IApprovalTarget {
  request: IAgentToolPermissionRequest;
  suggestions: ISuggestedRule[];
}

/**
 * Holds the approval request whose "allow always" menu is open, exposing its
 * variable-length suggestions as SELECTOR options and performing the chosen
 * "allow always" response. The bar sets the target before triggering the menu;
 * `submitting$` lets it disable the other actions while a response is in flight.
 */
export class ApprovalMenuService extends Disposable {
  private readonly _target$ = new BehaviorSubject<IApprovalTarget | null>(null);

  private readonly _submitting$ = new BehaviorSubject<boolean>(false);
  readonly submitting$: Observable<boolean> = this._submitting$.asObservable();

  readonly selections$: Observable<IValueOption[]> = this._target$.pipe(
    map((target) => (target?.suggestions ?? []).map((suggestion, index) => ({
      value: index,
      label: suggestion.label,
      params: { suggestion },
    })))
  );

  constructor(
    @IAgentToolPermissionService private readonly _permissionService: IAgentToolPermissionService
  ) {
    super();
  }

  get target(): IApprovalTarget | null {
    return this._target$.getValue();
  }

  setTarget(target: IApprovalTarget): void {
    this._target$.next(target);
  }

  async allowAlways(suggestion: ISuggestedRule): Promise<void> {
    const target = this._target$.getValue();
    if (!target || this._submitting$.getValue()) {
      return;
    }
    this._submitting$.next(true);
    try {
      await this._permissionService.respond({
        requestId: target.request.id,
        decision: 'allow',
        scope: 'user',
        rule: {
          toolName: target.request.toolName,
          pattern: suggestion.pattern,
          matchField: suggestion.matchField,
          decision: 'allow',
        },
      });
    } finally {
      this._submitting$.next(false);
      this._target$.next(null);
    }
  }

  override dispose(): void {
    super.dispose();
    this._target$.complete();
    this._submitting$.complete();
  }
}
