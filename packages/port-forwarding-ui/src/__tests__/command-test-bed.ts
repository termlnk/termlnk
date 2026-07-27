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

import type { Dependency } from '@termlnk/core';
import type { PortForwardingTunnelStatus } from '@termlnk/rpc';
import type { Mock } from 'vitest';
import { IConfirmService, Injector, LocaleService } from '@termlnk/core';
import { IPortForwardingService } from '@termlnk/rpc';
import { vi } from 'vitest';
import { IRuleContextService, RuleContextService } from '../services/rule-context/rule-context.service';
import { IRuleDialogService, RuleDialogService } from '../services/rule-dialog/rule-dialog.service';
import { makeTarget } from './fixtures';

export interface ITestPortForwardingService {
  startRule: Mock;
  stopRule: Mock;
  restartRule: Mock;
  deleteRule: Mock;
}

export interface ICommandTestBed {
  injector: Injector;
  portForwarding: ITestPortForwardingService;
  ruleContext: RuleContextService;
  ruleDialog: RuleDialogService;
  confirm: Mock;
  setContextTarget: (ruleId: string, status?: PortForwardingTunnelStatus) => void;
}

/**
 * Commands run through `injector.invoke(handler)` in production, so the bed
 * uses a real Injector instead of a hand-rolled accessor: a wrong identifier
 * then fails here the same way it would at runtime.
 */
export function createCommandTestBed(): ICommandTestBed {
  const portForwarding: ITestPortForwardingService = {
    startRule: vi.fn().mockResolvedValue(undefined),
    stopRule: vi.fn().mockResolvedValue(undefined),
    restartRule: vi.fn().mockResolvedValue(undefined),
    deleteRule: vi.fn().mockResolvedValue(undefined),
  };
  const confirm = vi.fn().mockResolvedValue(true);
  const ruleContext = new RuleContextService();
  const ruleDialog = new RuleDialogService();

  const dependencies: Dependency[] = [
    [IPortForwardingService, { useValue: portForwarding as never }],
    [IConfirmService, { useValue: { confirm } as never }],
    [LocaleService, { useValue: { t: (key: string) => key } as never }],
    [IRuleContextService, { useValue: ruleContext }],
    [IRuleDialogService, { useValue: ruleDialog }],
  ];

  const injector = new Injector(dependencies);

  return {
    injector,
    portForwarding,
    ruleContext,
    ruleDialog,
    confirm,
    setContextTarget: (ruleId, status) => ruleContext.setTarget(makeTarget(ruleId, status)),
  };
}
