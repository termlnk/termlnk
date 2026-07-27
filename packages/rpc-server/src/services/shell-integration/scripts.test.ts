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

import { Buffer } from 'node:buffer';
import { resolveTerminalIdentityEnv } from '@termlnk/terminal';
import { describe, expect, it } from 'vitest';
import { buildSshBootstrapCommand } from './scripts';

/**
 * The bootstrap command wraps a base64 payload; decode it back to the sh script
 * so assertions read against what actually runs on the remote.
 */
function decodeInnerScript(command: string): string {
  const match = command.match(/printf %s ([A-Za-z0-9+/=]+)/);
  if (!match) {
    throw new Error('bootstrap command does not carry a base64 payload');
  }
  return Buffer.from(match[1], 'base64').toString('utf8');
}

describe('buildSshBootstrapCommand', () => {
  it('should not export any identity when none is requested', () => {
    expect(decodeInnerScript(buildSshBootstrapCommand())).not.toContain('export TERM_PROGRAM=');
  });

  it('should export the requested identity before any exec', () => {
    const script = decodeInnerScript(buildSshBootstrapCommand({
      identityEnv: resolveTerminalIdentityEnv('ghostty'),
    }));

    expect(script).toContain('export TERM_PROGRAM=\'ghostty\'');
    // The user's shell only inherits the vars if they are exported before exec.
    expect(script.indexOf('export TERM_PROGRAM=\'ghostty\'')).toBeLessThan(script.indexOf('exec'));
  });

  it('should never export TERM — remote terminfo may lack the entry', () => {
    for (const identity of ['termlnk', 'ghostty', 'kitty', 'iterm2'] as const) {
      const script = decodeInnerScript(buildSshBootstrapCommand({
        identityEnv: resolveTerminalIdentityEnv(identity),
      }));
      expect(script).not.toMatch(/^export TERM=/m);
    }
  });

  it('should drop values that could break out of the single-quoted export', () => {
    const script = decodeInnerScript(buildSshBootstrapCommand({
      identityEnv: {
        TERM_PROGRAM: 'ghostty\'; rm -rf /tmp/pwned; \'',
        KITTY_WINDOW_ID: '1',
      },
    }));

    expect(script).not.toContain('rm -rf');
    expect(script).not.toContain('export TERM_PROGRAM=');
    // A rejected value must not take the well-formed ones down with it.
    expect(script).toContain('export KITTY_WINDOW_ID=\'1\'');
  });

  it('should drop malformed keys', () => {
    const script = decodeInnerScript(buildSshBootstrapCommand({
      identityEnv: { 'TERM_PROGRAM; touch /tmp/x': 'ghostty' },
    }));

    expect(script).not.toContain('touch /tmp/x');
  });
});
