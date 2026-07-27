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

import type { IRuleContextTarget } from './rule-context.service';
import { PortForwardingTunnelStatus } from '@termlnk/rpc';
import { describe, expect, it } from 'vitest';
import { makeTarget } from '../../__tests__/fixtures';
import { RuleContextService } from './rule-context.service';

describe('ruleContextService', () => {
  it('should start with no target', () => {
    const service = new RuleContextService();
    expect(service.target).toBeNull();
  });

  it('should expose the last target through the synchronous getter', () => {
    const service = new RuleContextService();
    service.setTarget(makeTarget('rule-1'));
    service.setTarget(makeTarget('rule-2', PortForwardingTunnelStatus.ACTIVE));
    expect(service.target?.rule.id).toBe('rule-2');
    expect(service.target?.status).toBe(PortForwardingTunnelStatus.ACTIVE);
  });

  it('should replay the current target to late subscribers', () => {
    const service = new RuleContextService();
    service.setTarget(makeTarget('rule-1'));

    const seen: (IRuleContextTarget | null)[] = [];
    service.target$.subscribe((target) => seen.push(target));

    expect(seen).toHaveLength(1);
    expect(seen[0]?.rule.id).toBe('rule-1');
  });

  it('should emit null on clear', () => {
    const service = new RuleContextService();
    const seen: (IRuleContextTarget | null)[] = [];
    service.target$.subscribe((target) => seen.push(target));

    service.setTarget(makeTarget('rule-1'));
    service.clear();

    expect(seen).toEqual([null, expect.objectContaining({ status: PortForwardingTunnelStatus.IDLE }), null]);
    expect(service.target).toBeNull();
  });

  it('should complete the stream on dispose', () => {
    const service = new RuleContextService();
    let completed = false;
    service.target$.subscribe({
      complete: () => {
        completed = true;
      },
    });
    service.dispose();
    expect(completed).toBe(true);
  });
});
