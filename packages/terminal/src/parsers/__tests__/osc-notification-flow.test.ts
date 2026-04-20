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
import { isOscNotification, parseOscNotification } from '../osc-notification-parser';
import { OscSequenceStreamParser } from '../osc-stream-parser';

describe('OSC 9 notification flow', () => {
  it('should extract and parse OSC 9 with BEL terminator', () => {
    const parser = new OscSequenceStreamParser();
    // printf '\e]9;Hello\a'
    const data = '\u001B]9;Hello\u0007';
    const sequences = parser.feed(data);

    expect(sequences).toHaveLength(1);
    expect(sequences[0].oscNumber).toBe(9);
    expect(sequences[0].data).toBe('Hello');
    expect(isOscNotification(9)).toBe(true);

    const result = parseOscNotification(9, sequences[0].data);
    expect(result.success).toBe(true);
    expect(result.params?.title).toBe('Terminal Notification');
    expect(result.params?.body).toBe('Hello');
  });

  it('should extract and parse OSC 9 with ST (ESC \\) terminator', () => {
    const parser = new OscSequenceStreamParser();
    // printf '\e]9;Hello\e\\'
    const data = '\u001B]9;Hello\u001B\\';
    const sequences = parser.feed(data);

    expect(sequences).toHaveLength(1);
    expect(sequences[0].oscNumber).toBe(9);
    expect(sequences[0].data).toBe('Hello');
  });

  it('should extract OSC 9 with CJK characters', () => {
    const parser = new OscSequenceStreamParser();
    const data = '\u001B]9;Hello from termlnk! 这是一条 OSC 9 测试通知\u001B\\';
    const sequences = parser.feed(data);

    expect(sequences).toHaveLength(1);
    expect(sequences[0].oscNumber).toBe(9);
    expect(sequences[0].data).toBe('Hello from termlnk! 这是一条 OSC 9 测试通知');

    const result = parseOscNotification(9, sequences[0].data);
    expect(result.success).toBe(true);
    expect(result.params?.body).toBe('Hello from termlnk! 这是一条 OSC 9 测试通知');
  });

  it('should handle OSC 9 interleaved with shell integration (OSC 633)', () => {
    const parser = new OscSequenceStreamParser();
    // Typical flow: shell integration + printf output
    const data = '\u001B]633;C\u0007\u001B]9;Build complete\u0007\u001B]633;D;0\u0007';
    const sequences = parser.feed(data);

    expect(sequences).toHaveLength(3);
    expect(sequences[0]).toEqual({ oscNumber: 633, data: 'C' });
    expect(sequences[1]).toEqual({ oscNumber: 9, data: 'Build complete' });
    expect(sequences[2]).toEqual({ oscNumber: 633, data: 'D;0' });

    // Only OSC 9 should be a notification
    const notifications = sequences.filter((s) => isOscNotification(s.oscNumber));
    expect(notifications).toHaveLength(1);
    expect(notifications[0].oscNumber).toBe(9);
  });

  it('should handle OSC 9 embedded in normal terminal output', () => {
    const parser = new OscSequenceStreamParser();
    // ANSI colors + OSC 9 + more text
    const data = '\u001B[32muser@host\u001B[0m$ \u001B]9;test notification\u0007next prompt';
    const sequences = parser.feed(data);

    expect(sequences).toHaveLength(1);
    expect(sequences[0].oscNumber).toBe(9);
    expect(sequences[0].data).toBe('test notification');
  });

  it('should handle OSC 9 split across multiple chunks', () => {
    const parser = new OscSequenceStreamParser();

    // Chunk 1: partial OSC sequence
    const sequences1 = parser.feed('\u001B]9;Hel');
    expect(sequences1).toHaveLength(0);

    // Chunk 2: complete the sequence
    const sequences2 = parser.feed('lo\u0007');
    expect(sequences2).toHaveLength(1);
    expect(sequences2[0].oscNumber).toBe(9);
    expect(sequences2[0].data).toBe('Hello');
  });

  it('should handle OSC 9 with ST split across chunks', () => {
    const parser = new OscSequenceStreamParser();

    // Chunk 1: ends with ESC (the start of ST)
    const sequences1 = parser.feed('\u001B]9;Hello\u001B');
    expect(sequences1).toHaveLength(1);
    expect(sequences1[0].data).toBe('Hello');

    // Chunk 2: starts with \ (the rest of ST)
    const sequences2 = parser.feed('\\more data');
    expect(sequences2).toHaveLength(0); // The \ should be consumed by skipNextStChar
  });
});
