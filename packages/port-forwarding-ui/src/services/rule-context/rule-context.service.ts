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

import type { IPortForwardingRule, PortForwardingTunnelStatus } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export interface IRuleContextTarget {
  rule: IPortForwardingRule;
  status: PortForwardingTunnelStatus;
}

export interface IRuleContextService {
  readonly target$: Observable<IRuleContextTarget | null>;
  readonly target: IRuleContextTarget | null;
  setTarget(target: IRuleContextTarget): void;
  clear(): void;
}
export const IRuleContextService = createIdentifier<IRuleContextService>('port-forwarding-ui.rule-context-service');

/**
 * Holds the right-clicked rule so menu factories (DI layer) and the commands
 * they invoke can react without threading ruleId through static menu params.
 * Mirrors @termlnk/sftp-ui's FileContextService.
 */
export class RuleContextService extends Disposable implements IRuleContextService {
  private readonly _target$ = new BehaviorSubject<IRuleContextTarget | null>(null);
  readonly target$: Observable<IRuleContextTarget | null> = this._target$.asObservable();

  get target(): IRuleContextTarget | null {
    return this._target$.getValue();
  }

  setTarget(target: IRuleContextTarget): void {
    this._target$.next(target);
  }

  clear(): void {
    this._target$.next(null);
  }

  override dispose(): void {
    super.dispose();
    this._target$.complete();
  }
}
