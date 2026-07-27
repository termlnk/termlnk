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

import type { IPortForwardingRule } from '@termlnk/rpc';
import type { IRuleContextTarget } from '../services/rule-context/rule-context.service';
import { PortForwardingTunnelStatus, PortForwardingType } from '@termlnk/rpc';

export function makeRule(id: string, overrides: Partial<IPortForwardingRule> = {}): IPortForwardingRule {
  return {
    id,
    label: `rule ${id}`,
    type: PortForwardingType.LOCAL,
    hostId: 'host-1',
    bindAddress: '127.0.0.1',
    bindPort: 8080,
    destinationAddress: '10.0.0.5',
    destinationPort: 80,
    sort: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeTarget(ruleId: string, status = PortForwardingTunnelStatus.IDLE): IRuleContextTarget {
  return { rule: makeRule(ruleId), status };
}
