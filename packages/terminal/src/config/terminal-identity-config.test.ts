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
import {
  DEFAULT_TERMINAL_IDENTITY_CONFIG,
  normalizeTerminalIdentityConfig,
  resolveTerminalIdentityEnv,
  TERMINAL_IDENTITIES,
  TERMINAL_IDENTITY_ENV_KEYS,
} from './terminal-identity-config';

describe('normalizeTerminalIdentityConfig', () => {
  it('should default to the termlnk identity when nothing is stored', () => {
    expect(normalizeTerminalIdentityConfig(null)).toEqual({ identity: 'termlnk' });
    expect(normalizeTerminalIdentityConfig(undefined)).toEqual({ identity: 'termlnk' });
    expect(normalizeTerminalIdentityConfig({})).toEqual({ identity: 'termlnk' });
  });

  it('should keep every known identity', () => {
    for (const identity of TERMINAL_IDENTITIES) {
      expect(normalizeTerminalIdentityConfig({ identity })).toEqual({ identity });
    }
  });

  it('should fall back to termlnk for unknown or malformed values', () => {
    expect(normalizeTerminalIdentityConfig({ identity: 'alacritty' as never })).toEqual({ identity: 'termlnk' });
    expect(normalizeTerminalIdentityConfig({ identity: 42 as never })).toEqual({ identity: 'termlnk' });
  });

  it('should not return the shared default object', () => {
    const normalized = normalizeTerminalIdentityConfig(null);
    expect(normalized).not.toBe(DEFAULT_TERMINAL_IDENTITY_CONFIG);
  });
});

describe('resolveTerminalIdentityEnv', () => {
  it('should reproduce the historical termlnk env exactly', () => {
    expect(resolveTerminalIdentityEnv('termlnk')).toEqual({
      TERM_PROGRAM: 'termlnk',
      TERM_PROGRAM_VERSION: '0.0.0',
    });
  });

  it('should announce kitty-graphics capable terminals', () => {
    expect(resolveTerminalIdentityEnv('ghostty').TERM_PROGRAM).toBe('ghostty');
    expect(resolveTerminalIdentityEnv('kitty')).toMatchObject({
      TERM_PROGRAM: 'kitty',
      KITTY_WINDOW_ID: '1',
    });
  });

  it('should announce iTerm2 with a session id', () => {
    const env = resolveTerminalIdentityEnv('iterm2');
    expect(env.TERM_PROGRAM).toBe('iTerm.app');
    expect(env.ITERM_SESSION_ID).toMatch(/^w0t0p0:/);
  });

  it('should never set TERM — a bogus terminfo entry breaks remote sessions', () => {
    for (const identity of TERMINAL_IDENTITIES) {
      expect(resolveTerminalIdentityEnv(identity)).not.toHaveProperty('TERM');
    }
  });

  it('should only emit keys listed in TERMINAL_IDENTITY_ENV_KEYS so callers can fully reset', () => {
    for (const identity of TERMINAL_IDENTITIES) {
      for (const key of Object.keys(resolveTerminalIdentityEnv(identity))) {
        expect(TERMINAL_IDENTITY_ENV_KEYS).toContain(key);
      }
    }
  });

  it('should emit values safe to embed in single-quoted shell exports', () => {
    for (const identity of TERMINAL_IDENTITIES) {
      for (const value of Object.values(resolveTerminalIdentityEnv(identity))) {
        expect(value).toMatch(/^[\w.:-]+$/);
      }
    }
  });
});
