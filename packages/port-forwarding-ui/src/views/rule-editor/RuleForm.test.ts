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
import { PortForwardingType } from '@termlnk/rpc';
import { describe, expect, it, vi } from 'vitest';
import { makeRule as makeBaseRule } from '../../__tests__/fixtures';

// @termlnk/design pulls @lobehub/icons, whose ESM ships directory imports Node
// cannot resolve. The exports below are only referenced by the React component,
// never by the value mappers under test.
vi.mock('@termlnk/design', () => ({
  cn: (...classNames: unknown[]) => classNames.filter(Boolean).join(' '),
  Field: () => null,
  FieldContent: () => null,
  FieldLabel: () => null,
  Input: () => null,
  Tooltip: () => null,
  TooltipContent: () => null,
  TooltipTrigger: () => null,
  useDependency: () => ({ t: (key: string) => key }),
}));

const { EMPTY_FORM_VALUES, fromRule, toCreateInput, toUpdateInput } = await import('./RuleForm');

function makeRule(overrides: Partial<IPortForwardingRule> = {}): IPortForwardingRule {
  return makeBaseRule('rule-1', { label: 'web', bindAddress: '0.0.0.0', ...overrides });
}

describe('EMPTY_FORM_VALUES', () => {
  it('should default to a loopback local rule with unset ports', () => {
    expect(EMPTY_FORM_VALUES).toEqual({
      label: '',
      type: PortForwardingType.LOCAL,
      hostId: '',
      bindAddress: '127.0.0.1',
      bindPort: 0,
      destinationAddress: '',
      destinationPort: 0,
    });
  });
});

describe('fromRule', () => {
  it('should map every editable field of a rule', () => {
    expect(fromRule(makeRule())).toEqual({
      label: 'web',
      type: PortForwardingType.LOCAL,
      hostId: 'host-1',
      bindAddress: '0.0.0.0',
      bindPort: 8080,
      destinationAddress: '10.0.0.5',
      destinationPort: 80,
    });
  });

  // Inputs are controlled; null would make React switch them to uncontrolled.
  it('should turn the null destination of a dynamic rule into empty form values', () => {
    const values = fromRule(makeRule({
      type: PortForwardingType.DYNAMIC,
      destinationAddress: null,
      destinationPort: null,
    }));
    expect(values.destinationAddress).toBe('');
    expect(values.destinationPort).toBe(0);
  });

  it('should treat a missing destination the same as a null one', () => {
    const rule = makeRule();
    delete rule.destinationAddress;
    delete rule.destinationPort;
    expect(fromRule(rule)).toMatchObject({ destinationAddress: '', destinationPort: 0 });
  });
});

describe.each([
  { name: 'toCreateInput', toInput: (v: Parameters<typeof toCreateInput>[0]) => toCreateInput(v) },
  { name: 'toUpdateInput', toInput: (v: Parameters<typeof toUpdateInput>[0]) => toUpdateInput(v) },
])('$name', ({ toInput }) => {
  it('should pass the destination through for local rules', () => {
    const input = toInput({ ...fromRule(makeRule()), type: PortForwardingType.LOCAL });
    expect(input).toMatchObject({ destinationAddress: '10.0.0.5', destinationPort: 80 });
  });

  it('should pass the destination through for remote rules', () => {
    const input = toInput({ ...fromRule(makeRule()), type: PortForwardingType.REMOTE });
    expect(input).toMatchObject({ destinationAddress: '10.0.0.5', destinationPort: 80 });
  });

  // A SOCKS proxy has no fixed destination; leftovers from a type switch in the
  // form must not reach the database.
  it('should null out the destination for dynamic rules', () => {
    const input = toInput({ ...fromRule(makeRule()), type: PortForwardingType.DYNAMIC });
    expect(input.destinationAddress).toBeNull();
    expect(input.destinationPort).toBeNull();
  });

  it('should keep the remaining fields verbatim', () => {
    const values = fromRule(makeRule());
    expect(toInput(values)).toMatchObject({
      label: 'web',
      type: PortForwardingType.LOCAL,
      hostId: 'host-1',
      bindAddress: '0.0.0.0',
      bindPort: 8080,
    });
  });
});
