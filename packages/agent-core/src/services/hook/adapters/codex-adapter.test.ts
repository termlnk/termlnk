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
import { stripLegacyCodexHooksFlag } from './codex-adapter';

describe('stripLegacyCodexHooksFlag', () => {
  it('returns null when no codex_hooks substring present', () => {
    const toml = '[features]\nhooks = true\n';
    expect(stripLegacyCodexHooksFlag(toml)).toBeNull();
  });

  it('removes a bare codex_hooks = true line', () => {
    const toml = '[features]\ncodex_hooks = true\n';
    expect(stripLegacyCodexHooksFlag(toml)).toBe('[features]\n');
  });

  it('removes the line even without a trailing newline', () => {
    const toml = '[features]\ncodex_hooks = true';
    expect(stripLegacyCodexHooksFlag(toml)).toBe('[features]\n');
  });

  it('removes quoted string values that the prior \\w+ pattern missed', () => {
    const toml = '[features]\ncodex_hooks = "true"\n';
    expect(stripLegacyCodexHooksFlag(toml)).toBe('[features]\n');
  });

  it('removes the line regardless of whitespace around equals', () => {
    const toml = '[features]\ncodex_hooks=true\n';
    expect(stripLegacyCodexHooksFlag(toml)).toBe('[features]\n');
  });

  it('removes all occurrences when the flag is repeated', () => {
    const toml = '[features]\ncodex_hooks = true\nother = 1\ncodex_hooks = false\n';
    expect(stripLegacyCodexHooksFlag(toml)).toBe('[features]\nother = 1\n');
  });

  it('does not touch keys that merely share the codex_hooks prefix', () => {
    const toml = '[features]\ncodex_hooks_v2 = true\n';
    expect(stripLegacyCodexHooksFlag(toml)).toBeNull();
  });

  it('does not touch comments that mention codex_hooks but do not assign it', () => {
    const toml = '[features]\n# codex_hooks was removed upstream\nhooks = true\n';
    expect(stripLegacyCodexHooksFlag(toml)).toBeNull();
  });

  it('preserves surrounding sections and entries', () => {
    const toml = '[other]\nfoo = 1\n\n[features]\ncodex_hooks = true\nbar = 2\n';
    expect(stripLegacyCodexHooksFlag(toml)).toBe('[other]\nfoo = 1\n\n[features]\nbar = 2\n');
  });

  it('returns null when substring matches but no assignment line matches', () => {
    // The earlier substring guard returns null without going through the
    // regex when codex_hooks appears only inside a string value, etc.
    const toml = 'description = "see codex_hooks docs"\n';
    expect(stripLegacyCodexHooksFlag(toml)).toBeNull();
  });
});
