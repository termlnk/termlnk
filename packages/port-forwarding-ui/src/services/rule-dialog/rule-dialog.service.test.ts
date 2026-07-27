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

import type { IRuleDialogState } from './rule-dialog.service';
import { PortForwardingType } from '@termlnk/rpc';
import { describe, expect, it } from 'vitest';
import { RuleDialogService } from './rule-dialog.service';

function collect(service: RuleDialogService, key: 'state$' | 'stateUpdate$'): IRuleDialogState[] {
  const seen: IRuleDialogState[] = [];
  service[key].subscribe((state) => seen.push(state));
  return seen;
}

describe('ruleDialogService', () => {
  it('should start closed in create mode', () => {
    const service = new RuleDialogService();
    expect(service.getState()).toEqual({
      open: false,
      mode: 'create',
      ruleId: null,
      initialType: null,
    });
  });

  it('should open in create mode carrying the requested type', () => {
    const service = new RuleDialogService();
    service.openCreate(PortForwardingType.DYNAMIC);
    expect(service.getState()).toEqual({
      open: true,
      mode: 'create',
      ruleId: null,
      initialType: PortForwardingType.DYNAMIC,
    });
  });

  it('should open in edit mode carrying the rule id and no initial type', () => {
    const service = new RuleDialogService();
    service.openEdit('rule-1');
    expect(service.getState()).toEqual({
      open: true,
      mode: 'edit',
      ruleId: 'rule-1',
      initialType: null,
    });
  });

  it('should reset to the initial state on close', () => {
    const service = new RuleDialogService();
    service.openEdit('rule-1');
    service.close();
    expect(service.getState()).toEqual({
      open: false,
      mode: 'create',
      ruleId: null,
      initialType: null,
    });
  });

  it('should replay the current state to late subscribers of state$', () => {
    const service = new RuleDialogService();
    service.openCreate(PortForwardingType.REMOTE);
    const seen = collect(service, 'state$');
    expect(seen).toHaveLength(1);
    expect(seen[0].initialType).toBe(PortForwardingType.REMOTE);
  });

  // Controllers bridge stateUpdate$ to IDialogService; replaying `open: false`
  // on subscription would close a dialog nobody asked to close.
  it('should not replay anything to late subscribers of stateUpdate$', () => {
    const service = new RuleDialogService();
    service.openCreate(PortForwardingType.LOCAL);
    expect(collect(service, 'stateUpdate$')).toHaveLength(0);
  });

  it('should emit on both streams for every transition', () => {
    const service = new RuleDialogService();
    const states = collect(service, 'state$');
    const updates = collect(service, 'stateUpdate$');

    service.openCreate(PortForwardingType.LOCAL);
    service.openEdit('rule-2');
    service.close();

    expect(states).toHaveLength(4); // initial + 3 transitions
    expect(updates).toHaveLength(3);
    expect(updates.map((s) => s.mode)).toEqual(['create', 'edit', 'create']);
  });

  // close() is wired to dialog dismissal, which can fire when already closed.
  it('should be a no-op when closing an already closed dialog', () => {
    const service = new RuleDialogService();
    const updates = collect(service, 'stateUpdate$');
    service.close();
    expect(updates).toHaveLength(0);
  });

  it('should complete both streams on dispose', () => {
    const service = new RuleDialogService();
    let stateCompleted = false;
    let updateCompleted = false;
    service.state$.subscribe({
      complete: () => {
        stateCompleted = true;
      },
    });
    service.stateUpdate$.subscribe({
      complete: () => {
        updateCompleted = true;
      },
    });

    service.dispose();

    expect(stateCompleted).toBe(true);
    expect(updateCompleted).toBe(true);
  });
});
