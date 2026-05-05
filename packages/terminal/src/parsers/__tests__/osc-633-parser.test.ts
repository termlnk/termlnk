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
import { describe, expect, it } from 'vitest';
import { parseOsc633 } from '../osc-633-parser';

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

describe('parseOsc633', () => {
  it('parses A/B/C as zero-arg events', () => {
    expect(parseOsc633('A')).toEqual({ type: 'A' });
    expect(parseOsc633('B')).toEqual({ type: 'B' });
    expect(parseOsc633('C')).toEqual({ type: 'C' });
  });

  it('parses D with exit code', () => {
    expect(parseOsc633('D;0')).toEqual({ type: 'D', exitCode: 0, command: null });
    expect(parseOsc633('D;127')).toEqual({ type: 'D', exitCode: 127, command: null });
  });

  it('parses E command line preserving embedded semicolons', () => {
    expect(parseOsc633('E;ls -la;echo done')).toEqual({
      type: 'E',
      commandLine: 'ls -la;echo done',
    });
  });

  it('parses P key=value properties', () => {
    expect(parseOsc633('P;Cwd=/home/user')).toEqual({
      type: 'P',
      key: 'Cwd',
      value: '/home/user',
    });
  });

  it('parses Q natural-language query (base64-decoded UTF-8)', () => {
    const query = 'list files larger than 100MB';
    expect(parseOsc633(`Q;${b64(query)}`)).toEqual({
      type: 'Q',
      query,
    });
  });

  it('parses Q with multibyte UTF-8 characters', () => {
    const query = '查找最近 7 天修改过的文件';
    expect(parseOsc633(`Q;${b64(query)}`)).toEqual({
      type: 'Q',
      query,
    });
  });

  it('returns null for empty Q payload', () => {
    expect(parseOsc633('Q;')).toBeNull();
  });

  it('returns null for malformed base64 in Q', () => {
    expect(parseOsc633('Q;@@@not-base64@@@')).toBeNull();
  });

  it('returns null for unknown event types', () => {
    expect(parseOsc633('Z;something')).toBeNull();
  });
});
