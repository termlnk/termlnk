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
import { stripAnsi } from './ansi-strip';

describe('stripAnsi', () => {
  it('removes CSI color codes', () => {
    expect(stripAnsi('\x1B[1;32mhello\x1B[0m')).toBe('hello');
  });

  it('removes cursor movement CSI sequences', () => {
    expect(stripAnsi('\x1B[2Kline\x1B[0K')).toBe('line');
  });

  it('removes OSC sequences terminated by BEL', () => {
    expect(stripAnsi('\x1B]0;window title\x07visible text')).toBe('visible text');
  });

  it('removes OSC sequences terminated by ST', () => {
    expect(stripAnsi('\x1B]7;file:///tmp\x1B\\hello')).toBe('hello');
  });

  it('removes DCS sequences', () => {
    expect(stripAnsi('\x1BPqpayload\x1B\\visible')).toBe('visible');
  });

  it('collapses carriage-return overwrites to the last visible text on the line', () => {
    expect(stripAnsi('loading...\rdone\n')).toBe('done\n');
  });

  it('leaves plain CRLF newlines intact across lines', () => {
    expect(stripAnsi('line1\nline2\n')).toBe('line1\nline2\n');
  });

  it('preserves CRLF-terminated lines (PTY onlcr mode must not be treated as overwrite)', () => {
    // Every line of PTY output passes through tty line discipline which
    // converts \n → \r\n (onlcr). This is the default for cooked ttys.
    // If \r in CRLF were treated as overwrite we would wipe every line.
    expect(stripAnsi('alma\r\nApplications\r\ncode\r\n')).toBe('alma\nApplications\ncode\n');
  });

  it('handles lone \\r (progress overwrite) even when other lines use CRLF', () => {
    const input = 'line1\r\nloading...\rdone\r\nline3\r\n';
    expect(stripAnsi(input)).toBe('line1\ndone\nline3\n');
  });

  it('strips ANSI colors from CRLF-terminated ls-like output', () => {
    const input = '\x1B[01;34malma\x1B[0m\r\n\x1B[01;34mApplications\x1B[0m\r\ncode\r\n';
    expect(stripAnsi(input)).toBe('alma\nApplications\ncode\n');
  });

  it('removes lingering ESC and BEL characters', () => {
    expect(stripAnsi('\x07bell and \x1B stray')).toBe('bell and  stray');
  });

  it('returns empty input unchanged', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('handles input with no escape sequences', () => {
    expect(stripAnsi('plain text only')).toBe('plain text only');
  });
});
