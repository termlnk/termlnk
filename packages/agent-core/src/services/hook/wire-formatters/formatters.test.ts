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

import { describe, expect, it } from 'vitest';
import { ClaudeCodeWireFormatter } from './claude-code-formatter';
import { GenericWireFormatter } from './generic-formatter';

describe('ClaudeCodeWireFormatter', () => {
  const fmt = new ClaudeCodeWireFormatter();

  it('allow → hookSpecificOutput.decision.behavior = allow', () => {
    const parsed = JSON.parse(fmt.formatResponse({ kind: 'allow' }));
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('allow');
  });

  it('deny → behavior = deny with message', () => {
    const parsed = JSON.parse(fmt.formatResponse({ kind: 'deny' }));
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('deny');
    expect(parsed.hookSpecificOutput.decision.message).toMatch(/Denied/);
  });
});

describe('GenericWireFormatter', () => {
  const fmt = new GenericWireFormatter();

  it('allow → empty body', () => {
    expect(fmt.formatResponse({ kind: 'allow' })).toBe('{}');
  });

  it('deny → block shape', () => {
    expect(JSON.parse(fmt.formatResponse({ kind: 'deny' })).decision).toBe('block');
  });
});
