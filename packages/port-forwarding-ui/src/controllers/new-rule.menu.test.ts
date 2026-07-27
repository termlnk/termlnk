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

import { PortForwardingType } from '@termlnk/rpc';
import { describe, expect, it, vi } from 'vitest';

// See rule-context.menu.test.ts: @termlnk/ui cannot be loaded under Node ESM.
vi.mock('@termlnk/ui', () => ({
  MenuItemType: { BUTTON: 'BUTTON' },
}));

const {
  CreateDynamicRuleMenuFactory,
  CreateLocalRuleMenuFactory,
  CreateRemoteRuleMenuFactory,
} = await import('./new-rule.menu');

describe('new rule menu', () => {
  // All three entries share one commandId and differ only by params, so a
  // copy-paste slip would silently create the wrong forwarding type.
  it('should seed each entry with its own forwarding type', () => {
    const items = [
      CreateLocalRuleMenuFactory(),
      CreateRemoteRuleMenuFactory(),
      CreateDynamicRuleMenuFactory(),
    ];

    expect(items.map((item) => item.params)).toEqual([
      { type: PortForwardingType.LOCAL },
      { type: PortForwardingType.REMOTE },
      { type: PortForwardingType.DYNAMIC },
    ]);
  });

  it('should route every entry to the create-rule command under a unique id', () => {
    const items = [
      CreateLocalRuleMenuFactory(),
      CreateRemoteRuleMenuFactory(),
      CreateDynamicRuleMenuFactory(),
    ];

    expect(items.every((item) => item.commandId === 'port-forwarding-ui.command.create-rule')).toBe(true);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
});
