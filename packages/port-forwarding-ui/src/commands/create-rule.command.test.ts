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
import { PortForwardingType } from '@termlnk/rpc';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCommandTestBed } from '../__tests__/command-test-bed';
import { CreateRuleCommand } from './create-rule.command';

describe('createRuleCommand', () => {
  let bed: ICommandTestBed;

  beforeEach(() => {
    bed = createCommandTestBed();
  });

  it.each([PortForwardingType.LOCAL, PortForwardingType.REMOTE, PortForwardingType.DYNAMIC])(
    'should open the create dialog seeded with the %s type',
    (type) => {
      const result = bed.injector.invoke(CreateRuleCommand.handler, { type });
      expect(result).toBe(true);
      expect(bed.ruleDialog.getState()).toEqual({
        open: true,
        mode: 'create',
        ruleId: null,
        initialType: type,
      });
    }
  );

  // The side-tab "+" button triggers the command without params.
  it('should default to a local rule when no type is given', () => {
    bed.injector.invoke(CreateRuleCommand.handler);
    expect(bed.ruleDialog.getState().initialType).toBe(PortForwardingType.LOCAL);
  });
});
