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
import { beforeEach, describe, expect, it } from 'vitest';
import { createCommandTestBed } from '../__tests__/command-test-bed';
import { DeleteRuleCommand, EditRuleCommand } from './edit-rule.command';

describe('editRuleCommand', () => {
  let bed: ICommandTestBed;

  beforeEach(() => {
    bed = createCommandTestBed();
  });

  it('should open the dialog in edit mode for the rule from params', () => {
    const result = bed.injector.invoke(EditRuleCommand.handler, { ruleId: 'rule-1' });
    expect(result).toBe(true);
    expect(bed.ruleDialog.getState()).toMatchObject({ open: true, mode: 'edit', ruleId: 'rule-1' });
  });

  it('should open the dialog for the right-clicked rule when no params are given', () => {
    bed.setContextTarget('rule-2');
    bed.injector.invoke(EditRuleCommand.handler);
    expect(bed.ruleDialog.getState().ruleId).toBe('rule-2');
  });

  it('should leave the dialog closed when no rule can be resolved', () => {
    const result = bed.injector.invoke(EditRuleCommand.handler);
    expect(result).toBe(false);
    expect(bed.ruleDialog.getState().open).toBe(false);
  });
});

describe('deleteRuleCommand', () => {
  let bed: ICommandTestBed;

  beforeEach(() => {
    bed = createCommandTestBed();
  });

  it('should stop the tunnel before deleting a confirmed rule', async () => {
    const result = await bed.injector.invoke(DeleteRuleCommand.handler, { ruleId: 'rule-1' });

    expect(result).toBe(true);
    expect(bed.portForwarding.stopRule).toHaveBeenCalledWith('rule-1');
    expect(bed.portForwarding.deleteRule).toHaveBeenCalledWith('rule-1');
    expect(bed.portForwarding.stopRule.mock.invocationCallOrder[0])
      .toBeLessThan(bed.portForwarding.deleteRule.mock.invocationCallOrder[0]);
  });

  it('should scope the confirm dialog id to the rule', async () => {
    await bed.injector.invoke(DeleteRuleCommand.handler, { ruleId: 'rule-9' });
    expect(bed.confirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'delete-rule-rule-9' }));
  });

  it('should not delete anything when the user cancels', async () => {
    bed.confirm.mockResolvedValue(false);
    const result = await bed.injector.invoke(DeleteRuleCommand.handler, { ruleId: 'rule-1' });

    expect(result).toBe(false);
    expect(bed.portForwarding.stopRule).not.toHaveBeenCalled();
    expect(bed.portForwarding.deleteRule).not.toHaveBeenCalled();
  });

  // A rule that never started (or whose tunnel already died) must still be
  // deletable, so a failing stopRule is deliberately swallowed.
  it('should delete the rule even when stopping the tunnel fails', async () => {
    bed.portForwarding.stopRule.mockRejectedValue(new Error('not running'));
    const result = await bed.injector.invoke(DeleteRuleCommand.handler, { ruleId: 'rule-1' });

    expect(result).toBe(true);
    expect(bed.portForwarding.deleteRule).toHaveBeenCalledWith('rule-1');
  });

  it('should not prompt when no rule can be resolved', async () => {
    const result = await bed.injector.invoke(DeleteRuleCommand.handler);
    expect(result).toBe(false);
    expect(bed.confirm).not.toHaveBeenCalled();
  });
});
