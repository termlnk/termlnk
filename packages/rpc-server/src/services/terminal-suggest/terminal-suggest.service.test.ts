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

import type { Api, AssistantMessage, Model } from '@earendil-works/pi-ai';
import type { ITerminalSuggestion, ITerminalSuggestionPhaseEvent } from '@termlnk/agent';
import type { ITerminalCommand } from '@termlnk/terminal';
import type { ICommandBlockService } from '../shell-integration/command-block.service';
import { AGENT_PLUGIN_CONFIG_KEY } from '@termlnk/agent';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminalSuggestService } from './terminal-suggest.service';

const completeSimpleMock = vi.fn<(...args: unknown[]) => Promise<AssistantMessage>>();

interface IBlockStartedEvent {
  sessionId: string;
  blockId: string;
}
interface INaturalLanguageQueryEvent {
  sessionId: string;
  query: string;
  seq: number;
  observedAt: number;
}

class FakeCommandBlockService implements ICommandBlockService {
  blockFinished$ = new Subject<ITerminalCommand>();
  blockStarted$ = new Subject<IBlockStartedEvent>();
  query$ = new Subject<INaturalLanguageQueryEvent>();
  envChanged$ = new Subject<{ sessionId: string; env: { remoteOS: string; remoteShell: string; remoteDistro: string } }>();
  private _cwd = new Map<string, string>();
  private _env = new Map<string, { remoteOS: string; remoteShell: string; remoteDistro: string }>();
  private _blocks = new Map<string, ITerminalCommand[]>();

  setCwd(sessionId: string, cwd: string): void {
    this._cwd.set(sessionId, cwd);
  }

  setEnv(sessionId: string, env: { remoteOS?: string; remoteShell?: string; remoteDistro?: string }): void {
    this._env.set(sessionId, {
      remoteOS: env.remoteOS ?? '',
      remoteShell: env.remoteShell ?? '',
      remoteDistro: env.remoteDistro ?? '',
    });
  }

  pushBlock(block: ITerminalCommand): void {
    const arr = this._blocks.get(block.sessionId) ?? [];
    arr.push(block);
    this._blocks.set(block.sessionId, arr);
  }

  attachSession(): void {}
  detachSession(): void {}

  getBlocks(sessionId: string): ITerminalCommand[] {
    return this._blocks.get(sessionId) ?? [];
  }

  getLastBlock(sessionId: string): ITerminalCommand | null {
    const arr = this._blocks.get(sessionId);
    return arr && arr.length > 0 ? arr[arr.length - 1] : null;
  }

  getBlockById(): ITerminalCommand | null {
    return null;
  }

  getPendingSnapshot(): null {
    return null;
  }

  getCurrentCwd(sessionId: string): string {
    return this._cwd.get(sessionId) ?? '';
  }

  getRawEnv(sessionId: string): { remoteOS: string; remoteShell: string; remoteDistro: string } {
    return this._env.get(sessionId) ?? { remoteOS: '', remoteShell: '', remoteDistro: '' };
  }

  isAttached(): boolean {
    return false;
  }

  getOsc633EventCount(): number {
    return 0;
  }
}

interface IFakeProviderConfig {
  apiKey?: string;
}

class FakeLLMProviderService {
  private _activeModel = {
    id: 'openai/gpt-test',
    name: 'gpt-test',
    providerId: 'openai',
    enabled: true,
    reasoning: false,
    input: ['text'] as const,
    contextWindow: 8000,
    maxTokens: 512,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };

  resolveModel(_p: string, modelId: string): Model<Api> {
    return {
      id: modelId,
      name: modelId,
      api: 'openai-completions',
      provider: 'openai',
      baseUrl: 'https://example.com/v1',
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 8000,
      maxTokens: 512,
    } as Model<Api>;
  }

  getProviderConfig(_p: string): IFakeProviderConfig {
    return { apiKey: 'sk-test' };
  }

  getActiveModel(): typeof this._activeModel {
    return this._activeModel;
  }

  completeSimple = (...args: unknown[]) => completeSimpleMock(...args);
  streamSimple = vi.fn();

  // Other methods on ILLMProviderService — service does not call them.
  // Cast in setup as any to satisfy the DI typing.
  readonly providers$ = new Subject<unknown>();
  readonly activeModelId$ = new Subject<unknown>();
  readonly activeModel$ = new Subject<unknown>();
  readonly activeProvider$ = new Subject<unknown>();
}

class FakeSSHSessionService {
  write = vi.fn().mockResolvedValue(undefined);
  // unused in tests
  createSession = vi.fn();
  closeSession = vi.fn();
  retrySession = vi.fn();
  resize = vi.fn();
  getSession = vi.fn();
  getAllSessions = vi.fn(() => []);
}

class FakePTYSessionService {
  write = vi.fn().mockResolvedValue(undefined);
  createSession = vi.fn();
  closeSession = vi.fn();
  resize = vi.fn();
  getSession = vi.fn();
  getAllSessions = vi.fn(() => []);
  getShellPath = vi.fn();
}

class FakeSessionNotifyService {
  sessionCreated$ = new Subject<{ sessionId: string; type: 'ssh' | 'local' }>();
  sessionClosed$ = new Subject<{ sessionId: string }>();
  sessionStatusChanged$ = new Subject<unknown>();
  focusedSessionId$ = new Subject<string | null>();
  notifySessionCreated = vi.fn();
  notifySessionClosed = vi.fn();
  notifySessionStatusChanged = vi.fn();
  setFocusedSession = vi.fn();
  getFocusedSessionId = vi.fn(() => null);
}

class FakeConfigService {
  private _store = new Map<string, unknown>();
  setConfig(key: string, value: unknown): void {
    this._store.set(key, value);
  }

  getConfig<T>(key: string): T {
    return this._store.get(key) as T;
  }
}

class FakeLogService {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

function makeAssistantMessage(text: string): AssistantMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    api: 'openai-completions',
    provider: 'openai',
    model: 'gpt-test',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'stop',
    timestamp: Date.now(),
  };
}

interface ITestEnv {
  service: TerminalSuggestService;
  block: FakeCommandBlockService;
  notify: FakeSessionNotifyService;
  ssh: FakeSSHSessionService;
  pty: FakePTYSessionService;
  config: FakeConfigService;
  suggestions: ITerminalSuggestion[];
  phases: ITerminalSuggestionPhaseEvent[];
}

function setup(): ITestEnv {
  const block = new FakeCommandBlockService();
  const llm = new FakeLLMProviderService();
  const config = new FakeConfigService();
  const notify = new FakeSessionNotifyService();
  const ssh = new FakeSSHSessionService();
  const pty = new FakePTYSessionService();
  const log = new FakeLogService();

  config.setConfig(AGENT_PLUGIN_CONFIG_KEY, {
    terminalSuggest: {
      enabled: true,
      naturalLanguageEnabled: true,
      errorAutoSuggest: true,
    },
  });

  // Build with positional ctor — DI decorators are inert in tests.
  const service = new TerminalSuggestService(
    block as unknown as ICommandBlockService,
    llm as unknown as ConstructorParameters<typeof TerminalSuggestService>[1],
    config as unknown as ConstructorParameters<typeof TerminalSuggestService>[2],
    notify as unknown as ConstructorParameters<typeof TerminalSuggestService>[3],
    ssh as unknown as ConstructorParameters<typeof TerminalSuggestService>[4],
    pty as unknown as ConstructorParameters<typeof TerminalSuggestService>[5],
    log as unknown as ConstructorParameters<typeof TerminalSuggestService>[6]
  );

  const suggestions: ITerminalSuggestion[] = [];
  service.suggestion$.subscribe((s) => suggestions.push(s));

  const phases: ITerminalSuggestionPhaseEvent[] = [];
  service.phase$.subscribe((p) => phases.push(p));

  return { service, block, notify, ssh, pty, config, suggestions, phases };
}

describe('TerminalSuggestService', () => {
  beforeEach(() => {
    completeSimpleMock.mockReset();
  });

  afterEach(() => {
    // Each test should dispose its service; left here as a safety net.
  });

  it('NL2Cmd: writes Ctrl+U + sanitized command to PTY for local sessions', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 's1', type: 'local' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"list files","command":"ls -la"}')
    );

    env.block.query$.next({ sessionId: 's1', query: 'list files', seq: 1, observedAt: Date.now() });
    await flushAsync();

    expect(env.pty.write).toHaveBeenCalledTimes(1);
    expect(env.pty.write).toHaveBeenCalledWith('s1', '\x15ls -la');
    expect(env.suggestions).toHaveLength(1);
    expect(env.suggestions[0]).toMatchObject({
      kind: 'nl2cmd',
      sessionId: 's1',
      command: 'ls -la',
      injected: true,
      dangerous: false,
    });

    env.service.dispose();
  });

  it('NL2Cmd: routes to SSH write for ssh sessions', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 's2', type: 'ssh' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"who","command":"whoami"}')
    );

    env.block.query$.next({ sessionId: 's2', query: 'who am i', seq: 1, observedAt: Date.now() });
    await flushAsync();

    expect(env.ssh.write).toHaveBeenCalledWith('s2', '\x15whoami');
    expect(env.pty.write).not.toHaveBeenCalled();

    env.service.dispose();
  });

  it('NL2Cmd: flags dangerous commands but still injects (without \\r)', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 's3', type: 'local' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"wipe","command":"rm -rf /tmp/foo"}')
    );

    env.block.query$.next({ sessionId: 's3', query: 'wipe tmp foo', seq: 1, observedAt: Date.now() });
    await flushAsync();

    expect(env.pty.write).toHaveBeenCalledTimes(1);
    expect(env.pty.write.mock.calls[0]?.[1]).toBe('\x15rm -rf /tmp/foo');
    expect(env.pty.write.mock.calls[0]?.[1]).not.toMatch(/\r/);
    expect(env.suggestions[0]).toMatchObject({ dangerous: true, injected: true });

    env.service.dispose();
  });

  it('NL2Cmd: collapses LLM-returned multi-line commands to single line', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 's4', type: 'local' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"multi","command":"echo a\\necho b"}')
    );

    env.block.query$.next({ sessionId: 's4', query: 'two echoes', seq: 1, observedAt: Date.now() });
    await flushAsync();

    expect(env.pty.write).toHaveBeenCalledWith('s4', '\x15echo a echo b');

    env.service.dispose();
  });

  it('errorFix: triggers on non-zero exit and does not skip help-flag commands', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 's5', type: 'local' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"correct typo","command":"git status"}')
    );

    env.block.blockFinished$.next({
      id: 'b1',
      sessionId: 's5',
      command: 'git stuts',
      output: 'git: stuts is not a git command',
      exitCode: 1,
      cwd: '/tmp',
      startLine: null,
      endLine: null,
      timestamp: { start: 0, end: 0 },
      duration: 0,
    });
    await flushAsync();

    // Error-fix path: never injects directly; only emits a notice (suggestion
    // with injected:false) and forces a fresh prompt by writing \n to PTY.
    expect(env.pty.write).toHaveBeenCalledTimes(1);
    expect(env.pty.write).toHaveBeenCalledWith('s5', '\n');
    expect(env.suggestions[0]).toMatchObject({
      kind: 'errorFix',
      command: 'git status',
      injected: false,
    });

    env.service.dispose();
  });

  it('errorFix: applyLastErrorFix writes Ctrl+U + command + Enter for non-dangerous suggestions', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 'apply1', type: 'local' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"add missing arg","command":"ls -la"}')
    );

    env.block.blockFinished$.next({
      id: 'b1',
      sessionId: 'apply1',
      command: 'ls -lawhat',
      output: 'invalid option',
      exitCode: 2,
      cwd: '/',
      startLine: null,
      endLine: null,
      timestamp: { start: 0, end: 0 },
      duration: 0,
    });
    await flushAsync();

    // \n was written for the prompt-push; clear and run apply.
    env.pty.write.mockClear();

    const applied = env.service.applyLastErrorFix('apply1');
    expect(applied).toBe(true);
    await flushAsync();

    expect(env.pty.write).toHaveBeenCalledWith('apply1', '\x15ls -la\n');
    env.service.dispose();
  });

  it('errorFix: applyLastErrorFix omits Enter for dangerous commands so user must confirm', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 'apply2', type: 'local' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"force reset","command":"git reset --hard HEAD"}')
    );

    env.block.blockFinished$.next({
      id: 'b1',
      sessionId: 'apply2',
      command: 'git resert',
      output: 'unknown',
      exitCode: 1,
      cwd: '/',
      startLine: null,
      endLine: null,
      timestamp: { start: 0, end: 0 },
      duration: 0,
    });
    await flushAsync();

    env.pty.write.mockClear();

    expect(env.service.applyLastErrorFix('apply2')).toBe(true);
    await flushAsync();

    // Dangerous: \x15 + cmd, NO trailing \n. User must press Enter.
    expect(env.pty.write).toHaveBeenCalledWith('apply2', '\x15git reset --hard HEAD');
    env.service.dispose();
  });

  it('errorFix: applyLastErrorFix returns false when nothing is queued', () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 'apply3', type: 'local' });

    expect(env.service.applyLastErrorFix('apply3')).toBe(false);
    expect(env.pty.write).not.toHaveBeenCalled();

    env.service.dispose();
  });

  it('errorFix: ignores SIGINT (130) and SIGTERM (143)', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 's6', type: 'local' });

    env.block.blockFinished$.next({
      id: 'b1',
      sessionId: 's6',
      command: 'sleep 100',
      output: '',
      exitCode: 130,
      cwd: '/',
      startLine: null,
      endLine: null,
      timestamp: { start: 0, end: 0 },
      duration: 0,
    });
    env.block.blockFinished$.next({
      id: 'b2',
      sessionId: 's6',
      command: 'wait',
      output: '',
      exitCode: 143,
      cwd: '/',
      startLine: null,
      endLine: null,
      timestamp: { start: 0, end: 0 },
      duration: 0,
    });
    await flushAsync();

    expect(completeSimpleMock).not.toHaveBeenCalled();
    expect(env.pty.write).not.toHaveBeenCalled();

    env.service.dispose();
  });

  it('errorFix: skips injection when a newer block has started before LLM returns', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 's7', type: 'local' });

    let resolveLlm: ((m: AssistantMessage) => void) = () => {};
    completeSimpleMock.mockImplementationOnce(
      () => new Promise<AssistantMessage>((res) => { resolveLlm = res; })
    );

    env.block.blockFinished$.next({
      id: 'b1',
      sessionId: 's7',
      command: 'oops',
      output: 'fail',
      exitCode: 1,
      cwd: '/',
      startLine: null,
      endLine: null,
      timestamp: { start: 0, end: 0 },
      duration: 0,
    });
    await flushAsync();

    // User started typing a new command — tracker fires blockStarted$
    env.block.blockStarted$.next({ sessionId: 's7', blockId: 'b2' });

    // Now LLM returns
    resolveLlm(makeAssistantMessage('{"summary":"fix","command":"echo fixed"}'));
    await flushAsync();

    expect(env.pty.write).not.toHaveBeenCalled();
    // Suggestion should not be emitted since we bailed before _emitSuggestion
    expect(env.suggestions).toHaveLength(0);

    env.service.dispose();
  });

  it('respects enabled=false (no calls, no writes)', async () => {
    const env = setup();
    env.config.setConfig(AGENT_PLUGIN_CONFIG_KEY, {
      terminalSuggest: { enabled: false, naturalLanguageEnabled: true, errorAutoSuggest: true },
    });
    env.notify.sessionCreated$.next({ sessionId: 's8', type: 'local' });

    env.block.query$.next({ sessionId: 's8', query: 'anything', seq: 1, observedAt: Date.now() });
    env.block.blockFinished$.next({
      id: 'b1',
      sessionId: 's8',
      command: 'fail',
      output: '',
      exitCode: 1,
      cwd: '/',
      startLine: null,
      endLine: null,
      timestamp: { start: 0, end: 0 },
      duration: 0,
    });
    await flushAsync();

    expect(completeSimpleMock).not.toHaveBeenCalled();
    expect(env.pty.write).not.toHaveBeenCalled();

    env.service.dispose();
  });

  it('parses JSON tolerant of code-fence wrappers from chatty models', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 's9', type: 'local' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('Sure! ```json\n{"summary":"list","command":"ls"}\n```')
    );

    env.block.query$.next({ sessionId: 's9', query: 'list', seq: 1, observedAt: Date.now() });
    await flushAsync();

    expect(env.pty.write).toHaveBeenCalledWith('s9', '\x15ls');

    env.service.dispose();
  });

  it('phase: emits matched pending/cleared with the same requestId for NL2Cmd', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 'p1', type: 'local' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"x","command":"echo ok"}')
    );

    env.block.query$.next({ sessionId: 'p1', query: 'do x', seq: 1, observedAt: Date.now() });
    await flushAsync();

    const phasesForSession = env.phases.filter((p) => p.sessionId === 'p1' && p.kind === 'nl2cmd');
    expect(phasesForSession).toHaveLength(2);
    expect(phasesForSession[0].phase).toBe('pending');
    expect(phasesForSession[1].phase).toBe('cleared');
    expect(phasesForSession[0].requestId).toBe(phasesForSession[1].requestId);

    env.service.dispose();
  });

  it('phase: emits matched pending/cleared for errorFix even when LLM returns empty command', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 'p2', type: 'local' });

    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"no fix available","command":""}')
    );

    env.block.blockFinished$.next({
      id: 'b1',
      sessionId: 'p2',
      command: 'broken',
      output: '',
      exitCode: 2,
      cwd: '/',
      startLine: null,
      endLine: null,
      timestamp: { start: 0, end: 0 },
      duration: 0,
    });
    await flushAsync();

    const phases = env.phases.filter((p) => p.sessionId === 'p2');
    expect(phases.map((p) => p.phase)).toEqual(['pending', 'cleared']);
    expect(phases[0].kind).toBe('errorFix');
    expect(phases[0].requestId).toBe(phases[1].requestId);

    env.service.dispose();
  });

  it('phase: superseded request emits its own cleared with prior requestId; new request gets distinct id', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 'p3', type: 'local' });

    let resolveFirst: ((m: AssistantMessage) => void) = () => {};
    completeSimpleMock.mockImplementationOnce(
      () => new Promise<AssistantMessage>((res) => { resolveFirst = res; })
    );
    completeSimpleMock.mockResolvedValueOnce(
      makeAssistantMessage('{"summary":"second","command":"second"}')
    );

    env.block.query$.next({ sessionId: 'p3', query: 'first', seq: 1, observedAt: Date.now() });
    await flushAsync();
    // Now supersede with a second query before the first resolves.
    env.block.query$.next({ sessionId: 'p3', query: 'second', seq: 2, observedAt: Date.now() });
    await flushAsync();
    // Drain the (now-aborted) first LLM call.
    resolveFirst(makeAssistantMessage('{"summary":"first","command":"first"}'));
    await flushAsync();

    const phases = env.phases.filter((p) => p.sessionId === 'p3' && p.kind === 'nl2cmd');
    // 4 events: pending(A), pending(B), cleared(A), cleared(B)
    expect(phases).toHaveLength(4);
    const [pendingA, pendingB, cleared1, cleared2] = phases;
    expect(pendingA.phase).toBe('pending');
    expect(pendingB.phase).toBe('pending');
    expect(cleared1.phase).toBe('cleared');
    expect(cleared2.phase).toBe('cleared');
    // The two requestIds differ
    expect(pendingA.requestId).not.toBe(pendingB.requestId);
    // Both cleared events match exactly one of the prior pending events
    const pendingIds = new Set([pendingA.requestId, pendingB.requestId]);
    expect(pendingIds.has(cleared1.requestId)).toBe(true);
    expect(pendingIds.has(cleared2.requestId)).toBe(true);
    expect(cleared1.requestId).not.toBe(cleared2.requestId);

    env.service.dispose();
  });

  it('cancelInflight: aborts pending NL2Cmd and emits cleared without injecting', async () => {
    const env = setup();
    env.notify.sessionCreated$.next({ sessionId: 'p4', type: 'local' });

    let resolveLlm: ((m: AssistantMessage) => void) = () => {};
    completeSimpleMock.mockImplementationOnce(
      () => new Promise<AssistantMessage>((res) => { resolveLlm = res; })
    );

    env.block.query$.next({ sessionId: 'p4', query: 'q', seq: 1, observedAt: Date.now() });
    await flushAsync();

    expect(env.phases.filter((p) => p.phase === 'pending')).toHaveLength(1);

    env.service.cancelInflight('p4');
    // Drain the aborted LLM (returns null via AbortError catch).
    resolveLlm(makeAssistantMessage('{"summary":"late","command":"late"}'));
    await flushAsync();

    const phases = env.phases.filter((p) => p.sessionId === 'p4');
    expect(phases.map((p) => p.phase)).toEqual(['pending', 'cleared']);
    expect(env.pty.write).not.toHaveBeenCalled();

    env.service.dispose();
  });
});

/**
 * Yield a few microtask + macrotask ticks so that the chain of awaits inside
 * the service's _handleNlQuery / _handleErrorFix completes before assertions.
 */
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
  await new Promise((res) => setTimeout(res, 0));
}
