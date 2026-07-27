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
import { Injector } from '@termlnk/core';
import { PortForwardingTunnelStatus } from '@termlnk/rpc';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTarget } from '../__tests__/fixtures';
import { IRuleContextService, RuleContextService } from '../services/rule-context/rule-context.service';

// @termlnk/ui re-exports @termlnk/design, which pulls @lobehub/icons and its
// Node-unresolvable directory imports. Only the enum is used by the factories.
vi.mock('@termlnk/ui', () => ({
  MenuItemType: { BUTTON: 'BUTTON' },
}));

const {
  DeleteRuleMenuFactory,
  EditRuleMenuFactory,
  RestartRuleMenuFactory,
  StartRuleMenuFactory,
  StopRuleMenuFactory,
} = await import('./rule-context.menu');

const RUNNING_STATUSES = [
  PortForwardingTunnelStatus.ACTIVE,
  PortForwardingTunnelStatus.STARTING,
  PortForwardingTunnelStatus.AUTHENTICATING,
];
const STOPPED_STATUSES = [
  PortForwardingTunnelStatus.IDLE,
  PortForwardingTunnelStatus.FAILED,
  PortForwardingTunnelStatus.STOPPING,
  PortForwardingTunnelStatus.CLOSED,
];

describe('rule context menu', () => {
  let injector: Injector;
  let ruleContext: RuleContextService;

  beforeEach(() => {
    ruleContext = new RuleContextService();
    injector = new Injector([[IRuleContextService, { useValue: ruleContext }]]);
  });

  function latestHidden(hidden$: Observable<boolean> | undefined): boolean | undefined {
    let latest: boolean | undefined;
    hidden$?.subscribe((value) => {
      latest = value;
    });
    return latest;
  }

  function hiddenFor(
    factory: (accessor: never) => { hidden$?: Observable<boolean> },
    status?: PortForwardingTunnelStatus
  ): boolean | undefined {
    if (status) {
      ruleContext.setTarget(makeTarget('rule-1', status));
    }
    const item = injector.invoke(factory as never) as { hidden$?: Observable<boolean> };
    return latestHidden(item.hidden$);
  }

  it.each(RUNNING_STATUSES)('should hide start and show stop/restart while %s', (status) => {
    expect(hiddenFor(StartRuleMenuFactory, status)).toBe(true);
    expect(hiddenFor(StopRuleMenuFactory, status)).toBe(false);
    expect(hiddenFor(RestartRuleMenuFactory, status)).toBe(false);
  });

  it.each(STOPPED_STATUSES)('should show start and hide stop/restart while %s', (status) => {
    expect(hiddenFor(StartRuleMenuFactory, status)).toBe(false);
    expect(hiddenFor(StopRuleMenuFactory, status)).toBe(true);
    expect(hiddenFor(RestartRuleMenuFactory, status)).toBe(true);
  });

  // The menu is built once and reacts to target$, so a fresh right-click on a
  // running rule must flip the items without rebuilding the menu.
  it('should follow the context target across right-clicks', () => {
    const start = injector.invoke(StartRuleMenuFactory as never) as { hidden$: Observable<boolean> };
    const seen: boolean[] = [];
    start.hidden$.subscribe((hidden) => seen.push(hidden));

    ruleContext.setTarget(makeTarget('rule-1', PortForwardingTunnelStatus.ACTIVE));
    ruleContext.setTarget(makeTarget('rule-2', PortForwardingTunnelStatus.IDLE));

    expect(seen).toEqual([false, true, false]);
  });

  it('should treat an absent target as not running', () => {
    expect(hiddenFor(StartRuleMenuFactory)).toBe(false);
    expect(hiddenFor(StopRuleMenuFactory)).toBe(true);
  });

  it('should leave edit and delete always visible', () => {
    expect(EditRuleMenuFactory().hidden$).toBeUndefined();
    expect(DeleteRuleMenuFactory().hidden$).toBeUndefined();
  });

  it('should bind every item to its own command', () => {
    const items = [
      injector.invoke(StartRuleMenuFactory as never),
      injector.invoke(StopRuleMenuFactory as never),
      injector.invoke(RestartRuleMenuFactory as never),
      EditRuleMenuFactory(),
      DeleteRuleMenuFactory(),
    ] as { id: string; commandId: string }[];

    expect(items.map((item) => item.commandId)).toEqual([
      'port-forwarding-ui.command.start-rule',
      'port-forwarding-ui.command.stop-rule',
      'port-forwarding-ui.command.restart-rule',
      'port-forwarding-ui.command.edit-rule',
      'port-forwarding-ui.command.delete-rule',
    ]);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
});
