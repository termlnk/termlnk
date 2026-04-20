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

import type { ITerminalCommand } from '@termlnk/terminal';
import { describe, expect, it } from 'vitest';
import { CommandBlockTracker } from './command-block-tracker';

const ESC = '\u001B';
const BEL = '\u0007';

function osc633(data: string): string {
  return `${ESC}]633;${data}${BEL}`;
}

function captureBlocks(tracker: CommandBlockTracker): ITerminalCommand[] {
  const blocks: ITerminalCommand[] = [];
  tracker.blockFinished$.subscribe((block) => blocks.push(block));
  return blocks;
}

describe('CommandBlockTracker', () => {
  it('emits a block when a full OSC 633 A-B-E-C-output-D sequence is fed', () => {
    const tracker = new CommandBlockTracker({ sessionId: 'sess-1' });
    const blocks = captureBlocks(tracker);

    tracker.feed([
      osc633('A'),
      'user@host:~$ ',
      osc633('B'),
      osc633('E;ls'),
      'ls\r\n',
      osc633('C'),
      'file1.txt\nfile2.txt\n',
      osc633('D;0'),
    ].join(''));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].command).toBe('ls');
    expect(blocks[0].output).toBe('file1.txt\nfile2.txt\n');
    expect(blocks[0].exitCode).toBe(0);
    expect(blocks[0].sessionId).toBe('sess-1');
    expect(blocks[0].shellIntegrated).toBe(true);
    expect(blocks[0].seq).toBe(1);
  });

  it('captures non-zero exit codes', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's' });
    const blocks = captureBlocks(tracker);

    tracker.feed(`${osc633('A')}${osc633('B')}${osc633('E;false')}${osc633('C')}${osc633('D;1')}`);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].exitCode).toBe(1);
    expect(blocks[0].output).toBe('');
  });

  it('strips ANSI color codes from captured output', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's' });
    const blocks = captureBlocks(tracker);

    const coloredBody = `${ESC}[1;32m●${ESC}[0m tat_agent.service - running\n`;
    tracker.feed([
      osc633('A'),
      osc633('B'),
      osc633('E;systemctl status'),
      osc633('C'),
      coloredBody,
      osc633('D;0'),
    ].join(''));

    expect(blocks[0].output).toBe('● tat_agent.service - running\n');
    expect(blocks[0].output).not.toContain(ESC);
  });

  it('excludes prompt/echo bytes that arrive before OSC 633;C', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's' });
    const blocks = captureBlocks(tracker);

    tracker.feed([
      osc633('A'),
      'PS1_PREFIX user@host ',
      osc633('B'),
      'ls typed by user',
      osc633('E;ls'),
      'ls\r\n',
      osc633('C'),
      'only this is the output\n',
      osc633('D;0'),
    ].join(''));

    expect(blocks[0].output).toBe('only this is the output\n');
  });

  it('handles OSC sequences split across chunk boundaries', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's' });
    const blocks = captureBlocks(tracker);

    const full = [
      osc633('A'),
      osc633('B'),
      osc633('E;echo hi'),
      osc633('C'),
      'hi\n',
      osc633('D;0'),
    ].join('');

    for (let i = 0; i < full.length; i += 3) {
      tracker.feed(full.slice(i, i + 3));
    }

    expect(blocks).toHaveLength(1);
    expect(blocks[0].command).toBe('echo hi');
    expect(blocks[0].output).toBe('hi\n');
    expect(blocks[0].exitCode).toBe(0);
  });

  it('updates cwd from OSC 633;P;Cwd events', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's' });
    const blocks = captureBlocks(tracker);

    tracker.feed([
      osc633('A'),
      osc633('B'),
      osc633('E;cd /tmp'),
      osc633('C'),
      osc633('D;0'),
      osc633('P;Cwd=/tmp'),
      osc633('A'),
      osc633('B'),
      osc633('E;pwd'),
      osc633('C'),
      '/tmp\n',
      osc633('D;0'),
    ].join(''));

    expect(blocks).toHaveLength(2);
    expect(blocks[1].cwd).toBe('/tmp');
    expect(tracker.currentCwd).toBe('/tmp');
  });

  it('assigns monotonically increasing seq numbers', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's' });
    const blocks = captureBlocks(tracker);

    for (let i = 0; i < 3; i += 1) {
      tracker.feed([
        osc633('A'),
        osc633('B'),
        osc633(`E;cmd${i}`),
        osc633('C'),
        `output${i}\n`,
        osc633('D;0'),
      ].join(''));
    }

    expect(blocks.map((b) => b.seq)).toEqual([1, 2, 3]);
    expect(blocks.map((b) => b.command)).toEqual(['cmd0', 'cmd1', 'cmd2']);
  });

  it('decodes OSC 633;E escaped characters', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's' });
    const blocks = captureBlocks(tracker);

    tracker.feed([
      osc633('A'),
      osc633('B'),
      osc633('E;ls\\x20-la\\x20/tmp'),
      osc633('C'),
      osc633('D;0'),
    ].join(''));

    expect(blocks[0].command).toBe('ls -la /tmp');
  });

  it('truncates output at the configured byte limit and flags the block', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's', maxOutputBytes: 10 });
    const blocks = captureBlocks(tracker);

    tracker.feed([
      osc633('A'),
      osc633('B'),
      osc633('E;cat huge'),
      osc633('C'),
      'abcdefghijklmnopqrst',
      osc633('D;0'),
    ].join(''));

    expect(blocks[0].outputTruncated).toBe(true);
    expect(blocks[0].outputTotalBytes).toBe(10);
    expect(blocks[0].output.length).toBe(10);
  });

  it('retains raw output when keepRawOutput is set', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's', keepRawOutput: true });
    const blocks = captureBlocks(tracker);

    const raw = `${ESC}[1;32mgreen${ESC}[0m text\n`;
    tracker.feed([
      osc633('A'),
      osc633('B'),
      osc633('E;echo green'),
      osc633('C'),
      raw,
      osc633('D;0'),
    ].join(''));

    expect(blocks[0].output).toBe('green text\n');
    expect(blocks[0].outputRaw).toBe(raw);
  });

  it('ignores non-OSC bytes while idle (before the first A event)', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's' });
    const blocks = captureBlocks(tracker);

    tracker.feed('stale banner before any prompt\n');
    tracker.feed([
      osc633('A'),
      osc633('B'),
      osc633('E;ls'),
      osc633('C'),
      'real output\n',
      osc633('D;0'),
    ].join(''));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].output).toBe('real output\n');
  });

  it('does not emit a block when D arrives without a preceding C', () => {
    const tracker = new CommandBlockTracker({ sessionId: 's' });
    const blocks = captureBlocks(tracker);

    tracker.feed(osc633('D;0'));

    expect(blocks).toHaveLength(0);
  });

  it('produces a correct output for the real zsh+PTY stream (CRLF lines, C-before-E, ANSI colors)', () => {
    // This reproduces what the renderer actually sees on macOS/zsh where:
    // - tty line discipline is onlcr, so every shell \n is delivered as \r\n;
    // - zsh preexec prints C first, then E (see scripts.ts);
    // - ls is commonly aliased to add colors, wrapping filenames in CSI SGR;
    // - A/B may be absent if PS1 wrap was overridden by a theme (e.g. p10k).
    const tracker = new CommandBlockTracker({ sessionId: 'real' });
    const blocks = captureBlocks(tracker);

    tracker.feed([
      'ls\r\n', // tty echo of the injected command
      osc633('C'),
      osc633('E;ls'),
      '\x1B[01;34malma\x1B[0m  Applications  code\r\n',
      'data  Desktop  Documents\r\n',
      'Downloads  fxqf  go\r\n',
      osc633('D;0'),
      osc633('P;Cwd=/Users/telan'),
    ].join(''));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].command).toBe('ls');
    expect(blocks[0].exitCode).toBe(0);
    expect(blocks[0].output).toContain('alma');
    expect(blocks[0].output).toContain('Applications');
    expect(blocks[0].output).toContain('Downloads');
    expect(blocks[0].output).not.toContain('\x1B');
    // Line endings must collapse to plain LF — no \r residues left.
    expect(blocks[0].output).not.toContain('\r');
    expect(blocks[0].output.split('\n').filter((l) => l.length > 0)).toHaveLength(3);
  });
});
