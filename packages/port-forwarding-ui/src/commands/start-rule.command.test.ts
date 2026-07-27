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

import type { ICommandTestBed } from '../__tests__/command-test-bed';
import { PortForwardingTunnelStatus } from '@termlnk/rpc';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCommandTestBed } from '../__tests__/command-test-bed';
import { resolveRuleId, StartRuleCommand } from './start-rule.command';
import { RestartRuleCommand, StopRuleCommand } from './stop-rule.command';

describe('resolveRuleId', () => {
  let bed: ICommandTestBed;

  beforeEach(() => {
    bed = createCommandTestBed();
  });

  it('should prefer the explicit params over the context target', () => {
    bed.setContextTarget('from-context');
    const resolved = bed.injector.invoke((accessor) => resolveRuleId(accessor, { ruleId: 'from-params' }));
    expect(resolved).toBe('from-params');
  });

  it('should fall back to the right-clicked rule when no params are given', () => {
    bed.setContextTarget('from-context');
    expect(bed.injector.invoke((accessor) => resolveRuleId(accessor))).toBe('from-context');
  });

  it('should return null when neither params nor context provide a rule', () => {
    expect(bed.injector.invoke((accessor) => resolveRuleId(accessor))).toBeNull();
  });

  it('should return null after the context target is cleared', () => {
    bed.setContextTarget('from-context');
    bed.ruleContext.clear();
    expect(bed.injector.invoke((accessor) => resolveRuleId(accessor))).toBeNull();
  });
});

describe.each([
  { command: StartRuleCommand, method: 'startRule' as const },
  { command: StopRuleCommand, method: 'stopRule' as const },
  { command: RestartRuleCommand, method: 'restartRule' as const },
])('$command.id', ({ command, method }) => {
  let bed: ICommandTestBed;

  beforeEach(() => {
    bed = createCommandTestBed();
  });

  it('should forward the rule id from params', async () => {
    const result = await bed.injector.invoke(command.handler, { ruleId: 'rule-1' });
    expect(result).toBe(true);
    expect(bed.portForwarding[method]).toHaveBeenCalledWith('rule-1');
  });

  it('should forward the rule id from the context target', async () => {
    bed.setContextTarget('rule-2', PortForwardingTunnelStatus.ACTIVE);
    const result = await bed.injector.invoke(command.handler);
    expect(result).toBe(true);
    expect(bed.portForwarding[method]).toHaveBeenCalledWith('rule-2');
  });

  it('should do nothing and report failure when no rule can be resolved', async () => {
    const result = await bed.injector.invoke(command.handler);
    expect(result).toBe(false);
    expect(bed.portForwarding[method]).not.toHaveBeenCalled();
  });
});
