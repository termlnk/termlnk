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

import type { IAgentTool, IAgentToolRegistryService } from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { ISSHToolService } from '@termlnk/rpc';
import type { IPTYSessionService } from '@termlnk/terminal';
import { Buffer } from 'node:buffer';
import { PTYSessionStatus } from '@termlnk/terminal';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CommandBlockService } from '../services/shell-integration/command-block.service';
import { registerTerminalTools } from './terminal-tools';

const ESC = '\u001B';
const BEL = '\u0007';
function osc633(data: string): string {
  return `${ESC}]633;${data}${BEL}`;
}

function createLogService(): ILogService {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as ILogService;
}

function createFakeSshToolService(): ISSHToolService {
  return {
    listHosts: vi.fn(),
    connectHost: vi.fn(),
    closeSession: vi.fn(),
    listSessions: vi.fn(),
    writeToSession: vi.fn(),
    getSessionData$: vi.fn().mockReturnValue(null),
    getSessionStatus: vi.fn().mockReturnValue(null),
  } as unknown as ISSHToolService;
}

interface ITestHarness {
  tools: Record<string, IAgentTool>;
  dataStream: Subject<Buffer>;
  commandBlockService: CommandBlockService;
  writeCalls: string[];
}

interface IHarnessOptions {
  attachCommandBlockService?: boolean;
}

function createHarness(sessionId: string, options: IHarnessOptions = {}): ITestHarness {
  const { attachCommandBlockService = true } = options;
  const logService = createLogService();
  const commandBlockService = new CommandBlockService(logService);
  const dataStream = new Subject<Buffer>();
  const writeCalls: string[] = [];

  const fakePtySession = {
    sessionId,
    data$: dataStream.asObservable(),
    status: PTYSessionStatus.READY,
    write: (text: string) => writeCalls.push(text),
  };

  const ptySessionService = {
    getSession: (id: string) => (id === sessionId ? fakePtySession : undefined),
    write: async (id: string, text: string) => {
      if (id === sessionId) {
        writeCalls.push(text);
      }
    },
    createSession: vi.fn(),
    closeSession: vi.fn(),
    getAllSessions: vi.fn(),
    resize: vi.fn(),
    getShellPath: vi.fn(),
  } as unknown as IPTYSessionService;

  if (attachCommandBlockService) {
    commandBlockService.attachSession(sessionId, dataStream.asObservable());
  }

  const tools: Record<string, IAgentTool> = {};
  const registry = {
    registerTool(tool: IAgentTool) {
      tools[tool.name] = tool;
      return { dispose: () => delete tools[tool.name] };
    },
    unregisterTool: vi.fn(),
    getTools: vi.fn(),
    getToolByName: vi.fn(),
  } as unknown as IAgentToolRegistryService;

  registerTerminalTools(
    {
      sshToolService: createFakeSshToolService(),
      logService,
      ptySessionService,
      commandBlockService,
    },
    registry
  );

  return { tools, dataStream, commandBlockService, writeCalls };
}

function emitBytes(stream: Subject<Buffer>, text: string): void {
  stream.next(Buffer.from(text, 'utf8'));
}

function parseResult(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

describe('termlnk_terminal_run', () => {
  it('writes the command, waits for OSC 633 D, and returns a structured completed result', async () => {
    const { tools, dataStream, writeCalls } = createHarness('sess-run');
    const run = tools.termlnk_terminal_run;
    expect(run).toBeDefined();

    const resultPromise = run.handler({ sessionId: 'sess-run', command: 'ls', timeoutMs: 2000 });

    await new Promise((r) => setTimeout(r, 0));
    expect(writeCalls).toEqual(['ls\r']);

    emitBytes(dataStream, osc633('A'));
    emitBytes(dataStream, osc633('B'));
    emitBytes(dataStream, osc633('E;ls'));
    emitBytes(dataStream, osc633('C'));
    emitBytes(dataStream, 'file1\nfile2\n');
    emitBytes(dataStream, osc633('D;0'));

    const result = await resultPromise;
    const parsed = parseResult((result.content[0] as { text: string }).text);

    expect(parsed.status).toBe('completed');
    expect(parsed.exitCode).toBe(0);
    expect(parsed.command).toBe('ls');
    expect(parsed.output).toBe('file1\nfile2\n');
    expect(parsed.shellIntegrated).toBe(true);
    expect(parsed.blockId).toBeTruthy();
    expect(parsed.seq).toBe(1);
  });

  it('returns status=timeout with pending snapshot when the command never finishes', async () => {
    const { tools, dataStream } = createHarness('sess-t');
    const run = tools.termlnk_terminal_run;

    const resultPromise = run.handler({ sessionId: 'sess-t', command: 'sleep 5', timeoutMs: 1000 });
    await new Promise((r) => setTimeout(r, 0));

    emitBytes(dataStream, osc633('A'));
    emitBytes(dataStream, osc633('B'));
    emitBytes(dataStream, osc633('E;sleep\\x205'));
    emitBytes(dataStream, osc633('C'));
    emitBytes(dataStream, 'still running\n');

    const result = await resultPromise;
    const parsed = parseResult((result.content[0] as { text: string }).text);

    expect(parsed.status).toBe('timeout');
    expect(parsed.output).toContain('still running');
    expect(parsed.blockId).toBeTruthy();
    expect(parsed.hint).toContain('termlnk_terminal_poll_block');
  });

  it('falls back to heuristic_completed when shell integration is not active', async () => {
    // Session has no OSC 633 hooks (e.g. user disabled autoInject or remote shell unsupported).
    // commandBlockService is still present (with data$ attached — it just never sees any OSC 633 events).
    const { tools, dataStream, writeCalls } = createHarness('sess-heu');
    const run = tools.termlnk_terminal_run;

    const resultPromise = run.handler({
      sessionId: 'sess-heu',
      command: 'echo hello',
      timeoutMs: 1000,
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(writeCalls).toEqual(['echo hello\r']);

    // Simulate what a plain shell emits: command echo + output + next prompt,
    // but no OSC 633 framing.
    dataStream.next(Buffer.from('echo hello\nhello\nuser@host:~$ ', 'utf8'));

    const result = await resultPromise;
    const parsed = parseResult((result.content[0] as { text: string }).text);

    expect(parsed.status).toBe('heuristic_completed');
    expect(parsed.shellIntegrated).toBe(false);
    expect(parsed.shellIntegrationActive).toBe(false);
    expect(parsed.osc633EventCount).toBe(0);
    expect(parsed.exitCode).toBe(null);
    expect(typeof parsed.output).toBe('string');
    expect(parsed.output as string).toContain('hello');
    expect((parsed.hint as string).toLowerCase()).toContain('no osc 633 events');
  });

  it('with waitForExit=false returns a running status as soon as C is seen', async () => {
    const { tools, dataStream } = createHarness('sess-bg');
    const run = tools.termlnk_terminal_run;

    const resultPromise = run.handler({
      sessionId: 'sess-bg',
      command: 'tail -f /var/log/foo',
      waitForExit: false,
    });
    await new Promise((r) => setTimeout(r, 0));

    emitBytes(dataStream, `${osc633('A')}${osc633('B')}${osc633('E;tail')}${osc633('C')}`);

    const result = await resultPromise;
    const parsed = parseResult((result.content[0] as { text: string }).text);

    expect(parsed.status).toBe('running');
    expect(parsed.blockId).toBeTruthy();
    expect(parsed.hint).toContain('poll_block');
  });
});

describe('termlnk_terminal_list_blocks / read_block / poll_block', () => {
  it('list_blocks returns metadata only, read_block returns full output, poll_block finds running blocks', async () => {
    const { tools, dataStream } = createHarness('sess-list');
    const run = tools.termlnk_terminal_run;
    const listBlocks = tools.termlnk_terminal_list_blocks;
    const readBlock = tools.termlnk_terminal_read_block;
    const pollBlock = tools.termlnk_terminal_poll_block;

    // First command: finishes immediately
    const p1 = run.handler({ sessionId: 'sess-list', command: 'pwd', timeoutMs: 1000 });
    await new Promise((r) => setTimeout(r, 0));
    emitBytes(dataStream, `${osc633('A')}${osc633('B')}${osc633('E;pwd')}${osc633('C')}/home/user\n${osc633('D;0')}`);
    await p1;

    // list_blocks
    const listResult = await listBlocks.handler({ sessionId: 'sess-list' });
    const list = parseResult((listResult.content[0] as { text: string }).text) as {
      blocks: Array<{ command: string; exitCode: number; outputPreview: string }>;
      totalFinished: number;
    };
    expect(list.totalFinished).toBe(1);
    expect(list.blocks).toHaveLength(1);
    expect(list.blocks[0].command).toBe('pwd');
    expect(list.blocks[0].exitCode).toBe(0);
    expect(list.blocks[0].outputPreview).toBe('/home/user');

    // read_block by seq
    const readResult = await readBlock.handler({ sessionId: 'sess-list', seq: 1 });
    const read = parseResult((readResult.content[0] as { text: string }).text) as {
      output: string;
      command: string;
    };
    expect(read.command).toBe('pwd');
    expect(read.output).toBe('/home/user\n');

    // Second command: still running — poll_block should return isRunning
    const runningPromise = run.handler({
      sessionId: 'sess-list',
      command: 'tail -f x',
      waitForExit: false,
    });
    await new Promise((r) => setTimeout(r, 0));
    emitBytes(dataStream, `${osc633('A')}${osc633('B')}${osc633('E;tail')}${osc633('C')}line1\n`);
    const runningResult = await runningPromise;
    const running = parseResult((runningResult.content[0] as { text: string }).text) as { blockId: string };

    emitBytes(dataStream, 'line2\n');

    const pollResult = await pollBlock.handler({
      sessionId: 'sess-list',
      blockId: running.blockId,
      maxWaitMs: 150,
    });
    const poll = parseResult((pollResult.content[0] as { text: string }).text) as {
      isRunning: boolean;
      output: string;
      status: string;
    };
    expect(poll.status).toBe('running');
    expect(poll.isRunning).toBe(true);
    expect(poll.output).toContain('line1');
    expect(poll.output).toContain('line2');

    // Now finish it — poll_block should pick up the completion
    emitBytes(dataStream, osc633('D;0'));
    const pollAfter = await pollBlock.handler({
      sessionId: 'sess-list',
      blockId: running.blockId,
      maxWaitMs: 500,
    });
    const done = parseResult((pollAfter.content[0] as { text: string }).text) as {
      status: string;
      exitCode: number;
      isRunning: boolean;
    };
    expect(done.status).toBe('completed');
    expect(done.exitCode).toBe(0);
    expect(done.isRunning).toBe(false);
  });
});
