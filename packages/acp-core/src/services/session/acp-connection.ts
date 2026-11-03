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

import type { AgentCapabilities, ClientApp, ClientContext, ContentBlock, RequestPermissionRequest, RequestPermissionResponse, SessionNotification } from '@agentclientprotocol/sdk';
import type {
  IACPPermissionRequest,
  IACPPromptBlock,
  IACPProviderDescriptor,
  IACPSessionInfo,
  IACPStreamEvent,
} from '@termlnk/acp';
import type { IChatMessage } from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { Buffer } from 'node:buffer';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Observable } from 'rxjs';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';
import { Readable, Writable } from 'node:stream';
import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
} from '@agentclientprotocol/sdk';
import { ACP_CLIENT_NAME, ACP_CLIENT_VERSION, AGENT_TERMINATE_GRACE_MS, DEFAULT_HANDSHAKE_TIMEOUT_MS } from '@termlnk/acp';
import { Disposable, generateRandomId } from '@termlnk/core';
import { Subject } from 'rxjs';
import { ACPTerminalRegistry } from './acp-terminal-registry';
import { findModelConfigId, translateModelSelection } from './translate/config-options';
import { translatePermissionRequest } from './translate/permission';
import {
  createTranslatorState,
  reduceStreamEvents,
  translateSessionUpdate,
} from './translate/session-update';

export interface IACPConnectionParams {
  sessionId: string;
  descriptor: IACPProviderDescriptor;
  cwd: string;
  env: Record<string, string>;
  /** Resume handle from a previous session. */
  nativeSessionId?: string;
  autoAccept?: boolean;
  hostId?: string;
  providerTitle: string;
  /** Deadline for `initialize` + session setup after spawn. */
  handshakeTimeoutMs?: number;
}

interface IPendingPermission {
  request: IACPPermissionRequest;
  resolve: (response: RequestPermissionResponse) => void;
}

/** Stderr lines retained to explain a failed handshake. */
const STDERR_TAIL_LINES = 8;

/**
 * One ACP agent process + ClientSideConnection for a single Termlnk tab.
 */
export class ACPConnection extends Disposable {
  private _child: ChildProcessWithoutNullStreams | null = null;
  private _connection: ClientContext | null = null;
  private _nativeSessionId: string | null = null;
  private _agentCapabilities: AgentCapabilities | null = null;
  private _terminals: ACPTerminalRegistry | null = null;
  private _translator = createTranslatorState();
  private _replayingHistory = false;
  private _replayBuffer: IACPStreamEvent[] = [];
  private _permissionSeq = 0;
  private readonly _pendingPermissions = new Map<string, IPendingPermission>();
  private readonly _events$ = new Subject<IACPStreamEvent>();
  private _info: IACPSessionInfo;
  private _starting: Promise<void> | null = null;
  private _promptInFlight = false;
  /**
   * Aborts a pending handshake. An agent that is on PATH but does not speak ACP
   * exits right after spawn without ever answering `initialize`, so the process
   * lifecycle handlers and the deadline timer need a way to fail that promise.
   */
  private _abortHandshake: ((reason: Error) => void) | null = null;
  private _stderrTail: string[] = [];
  /** Config option id that drives model selection for this agent. */
  private _modelConfigId: string | null = null;

  readonly events$: Observable<IACPStreamEvent> = this._events$.asObservable();

  constructor(
    private readonly _params: IACPConnectionParams,
    private readonly _logService: ILogService
  ) {
    super();
    const now = Date.now();
    this._info = {
      id: _params.sessionId,
      providerId: _params.descriptor.id,
      providerTitle: _params.providerTitle,
      cwd: _params.cwd,
      status: 'idle',
      nativeSessionId: _params.nativeSessionId,
      hostId: _params.hostId,
      createdAt: now,
      updatedAt: now,
    };
  }

  get info(): IACPSessionInfo {
    return this._info;
  }

  get sessionId(): string {
    return this._params.sessionId;
  }

  async start(): Promise<void> {
    if (this._starting) {
      return this._starting;
    }
    this._starting = this._doStart();
    try {
      await this._starting;
    } finally {
      this._starting = null;
    }
  }

  async prompt(blocks: IACPPromptBlock[]): Promise<void> {
    const connection = this._requireConnection();
    const nativeId = this._requireNativeSessionId();
    if (this._promptInFlight) {
      throw new Error('A prompt is already in progress');
    }

    const prompt = blocksToContent(blocks);
    const userMessage = buildUserMessage(blocks);
    this._emit({ type: 'message_upsert', message: userMessage });

    // A new user turn starts a fresh assistant stream.
    this._translator.assistantMessageId = null;
    this._translator.userMessageId = null;

    this._promptInFlight = true;
    this._setStatus('streaming');
    try {
      const result = await connection.request(methods.agent.session.prompt, {
        sessionId: nativeId,
        prompt,
      });
      this._emit({
        type: 'turn_complete',
        stopReason: result.stopReason,
      });
      this._setStatus('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._emit({ type: 'error', message });
      this._setStatus('error', message);
      throw err;
    } finally {
      this._promptInFlight = false;
      this._rejectAllPermissions();
    }
  }

  async cancel(): Promise<void> {
    const connection = this._connection;
    const nativeId = this._nativeSessionId;
    if (!connection || !nativeId) {
      return;
    }
    try {
      await connection.notify(methods.agent.session.cancel, { sessionId: nativeId });
    } catch (err) {
      this._logService.warn('[ACPConnection] cancel failed', err);
    }
    this._rejectAllPermissions();
  }

  async respondPermission(requestId: string, optionId: string): Promise<void> {
    const pending = this._pendingPermissions.get(requestId);
    if (!pending) {
      throw new Error(`Unknown permission request: ${requestId}`);
    }
    this._pendingPermissions.delete(requestId);
    pending.resolve({
      outcome: { outcome: 'selected', optionId },
    });
    this._emit({ type: 'permission_resolved', requestId, optionId });
  }

  async setMode(modeId: string): Promise<void> {
    const connection = this._requireConnection();
    const nativeId = this._requireNativeSessionId();
    await connection.request(methods.agent.session.setMode, { sessionId: nativeId, modeId });
    this._patchInfo({ currentModeId: modeId });
    this._emit({ type: 'mode_update', currentModeId: modeId });
  }

  async setModel(modelId: string): Promise<void> {
    const connection = this._requireConnection();
    const nativeId = this._requireNativeSessionId();
    // Models are exposed as session config options by most agents.
    await connection.request(methods.agent.session.setConfigOption, {
      sessionId: nativeId,
      configId: this._modelConfigId ?? 'model',
      value: modelId,
    });
    this._patchInfo({ currentModelId: modelId });
    this._emit({ type: 'models_update', currentModelId: modelId });
  }

  override dispose(): void {
    super.dispose();
    this._rejectAllPermissions();
    // Status first: the exit handler keys off 'closed' to stay quiet.
    this._setStatus('closed');
    this._terminals?.dispose();
    this._terminals = null;
    void this._killChild();
    this._connection = null;
    this._events$.complete();
  }

  private async _doStart(): Promise<void> {
    this._setStatus('connecting');
    const { descriptor, cwd, env } = this._params;
    const [binary, ...args] = descriptor.command;
    const childEnv = {
      ...env,
      ...(descriptor.env ?? {}),
    };

    const child = spawn(binary, args, {
      cwd,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      // Own process group so terminating the agent also reaps the helpers it
      // forks (node wrappers, MCP servers). Without this, killing the direct
      // child leaves those running.
      detached: process.platform !== 'win32',
    });
    this._child = child;

    child.stderr.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8').trim();
      if (text) {
        this._logService.debug(`[ACP:${descriptor.id}] ${text}`);
        // Kept so a failed handshake can quote why: a non-ACP binary explains
        // itself on stderr ("unknown option --acp") and nowhere else.
        this._stderrTail = [...this._stderrTail, text].slice(-STDERR_TAIL_LINES);
      }
    });

    child.on('error', (err) => {
      const message = err.message || String(err);
      this._abortHandshake?.(new Error(this._describeFailure(message)));
      this._emit({ type: 'error', message });
      this._setStatus('error', message);
    });

    child.on('exit', (code, signal) => {
      const message = `Agent process exited (code=${code}, signal=${signal})`;
      this._abortHandshake?.(new Error(this._describeFailure(message)));
      if (this._info.status === 'closed' || this._info.status === 'error') {
        return;
      }
      this._emit({ type: 'error', message });
      this._setStatus('error', message);
      this._rejectAllPermissions();
    });

    this._terminals = new ACPTerminalRegistry(childEnv);

    const input = Writable.toWeb(child.stdin) as WritableStream<Uint8Array>;
    const output = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
    const stream = ndJsonStream(input, output);

    const handle = this._createClientApp().connect(stream);
    const connection = handle.agent;
    this._connection = connection;

    // Every handshake round-trip races the process dying and the deadline. The
    // SDK only rejects pending requests with 'ACP connection closed' once stdout
    // ends, so a hung-but-alive agent or a spawn error would leave createSession
    // waiting forever without this.
    const aborted = new Promise<never>((_, reject) => {
      this._abortHandshake = reject;
    });
    const timeoutMs = this._params.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
    const timer = setTimeout(() => {
      this._abortHandshake?.(
        new Error(this._describeFailure(`Handshake timed out after ${timeoutMs}ms`))
      );
    }, timeoutMs);
    const untilAborted = <T>(promise: Promise<T>): Promise<T> =>
      Promise.race([promise, aborted]);

    try {
      const init = await untilAborted(connection.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          terminal: true,
        },
        clientInfo: {
          name: ACP_CLIENT_NAME,
          version: ACP_CLIENT_VERSION,
        },
      }));
      this._agentCapabilities = init.agentCapabilities ?? null;

      const resumeId = this._params.nativeSessionId;
      const caps = init.agentCapabilities;
      if (resumeId && caps?.loadSession) {
        await untilAborted(this._loadSession(connection, resumeId));
      } else if (resumeId && caps?.sessionCapabilities?.resume) {
        await untilAborted(connection.request(methods.agent.session.resume, {
          sessionId: resumeId,
          cwd,
          mcpServers: [],
        }));
        this._nativeSessionId = resumeId;
        this._patchInfo({ nativeSessionId: resumeId });
      } else {
        const created = await untilAborted(connection.request(methods.agent.session.new, {
          cwd,
          // Some agents (e.g. Devin CLI) reject missing mcpServers even when empty.
          mcpServers: [],
        }));
        this._nativeSessionId = created.sessionId;
        this._modelConfigId = findModelConfigId(created.configOptions) ?? null;
        this._patchInfo({
          nativeSessionId: created.sessionId,
          availableModes: created.modes?.availableModes?.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description ?? undefined,
          })),
          currentModeId: created.modes?.currentModeId ?? undefined,
          ...translateModelSelection(created.configOptions),
        });
      }

      this._setStatus('ready');
    } catch (rawErr) {
      // SDK 2.x rejects pending requests with 'ACP connection closed' as soon as stdout ends, before the exit handler runs.
      const err = rawErr instanceof Error && rawErr.message === 'ACP connection closed'
        ? new Error(this._describeFailure('Agent process exited before completing the handshake'))
        : rawErr;
      const message = err instanceof Error ? err.message : String(err);
      this._emit({ type: 'error', message });
      this._setStatus('error', message);
      await this._killChild();
      throw err;
    } finally {
      clearTimeout(timer);
      // Past the handshake the normal exit/error handlers own failures; leaving
      // this set would reject an already-settled race for nothing.
      this._abortHandshake = null;
    }
  }

  /** Appends the agent's stderr tail, which is usually the only real diagnosis. */
  private _describeFailure(message: string): string {
    const tail = this._stderrTail.join('\n').trim();
    const command = this._params.descriptor.command.join(' ');
    const base = `${message} (command: ${command})`;
    return tail ? `${base}\n${tail}` : base;
  }

  private async _loadSession(connection: ClientContext, nativeSessionId: string): Promise<void> {
    this._replayingHistory = true;
    this._replayBuffer = [];
    this._emit({ type: 'history_replay_start' });
    try {
      const loaded = await connection.request(methods.agent.session.load, {
        sessionId: nativeSessionId,
        cwd: this._params.cwd,
        mcpServers: [],
      });
      this._nativeSessionId = nativeSessionId;
      this._modelConfigId = findModelConfigId(loaded.configOptions) ?? null;
      this._patchInfo({
        nativeSessionId,
        availableModes: loaded.modes?.availableModes?.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description ?? undefined,
        })),
        currentModeId: loaded.modes?.currentModeId ?? undefined,
        ...translateModelSelection(loaded.configOptions),
      });
    } finally {
      const messages = reduceStreamEvents([], this._replayBuffer);
      this._replayingHistory = false;
      this._replayBuffer = [];
      this._emit({ type: 'history_replay_end', messages });
      // Reset translator so live turns start clean after replay.
      this._translator = createTranslatorState();
    }
  }

  private _createClientApp(): ClientApp {
    return client()
      .onNotification(methods.client.session.update, ({ params }) => {
        this._onSessionUpdate(params);
      })
      .onRequest(methods.client.session.requestPermission, ({ params }) => this._onRequestPermission(params))
      .onRequest(methods.client.fs.readTextFile, async ({ params }) => {
        const content = await readFile(params.path, 'utf8');
        if (params.line != null || params.limit != null) {
          const lines = content.split('\n');
          const start = Math.max(0, (params.line ?? 1) - 1);
          const end = params.limit != null ? start + params.limit : undefined;
          return { content: lines.slice(start, end).join('\n') };
        }
        return { content };
      })
      .onRequest(methods.client.fs.writeTextFile, async ({ params }) => {
        await mkdir(dirname(params.path), { recursive: true });
        await writeFile(params.path, params.content, 'utf8');
        return {};
      })
      .onRequest(methods.client.terminal.create, ({ params }) => this._requireTerminals().createTerminal(params))
      .onRequest(methods.client.terminal.output, ({ params }) => this._requireTerminals().terminalOutput(params))
      .onRequest(methods.client.terminal.waitForExit, ({ params }) => this._requireTerminals().waitForTerminalExit(params))
      .onRequest(methods.client.terminal.kill, ({ params }) => this._requireTerminals().killTerminal(params))
      .onRequest(methods.client.terminal.release, ({ params }) => this._requireTerminals().releaseTerminal(params));
  }

  private _onSessionUpdate(params: SessionNotification): void {
    const events = translateSessionUpdate(params.update, this._translator);
    for (const event of events) {
      this._applyMetaEvent(event);
      this._emit(event);
    }
  }

  private _applyMetaEvent(event: IACPStreamEvent): void {
    switch (event.type) {
      case 'mode_update':
        this._patchInfo({
          currentModeId: event.currentModeId ?? this._info.currentModeId,
          availableModes: event.availableModes ?? this._info.availableModes,
        });
        break;
      case 'commands_update':
        this._patchInfo({ availableCommands: event.commands });
        break;
      case 'models_update':
        this._patchInfo({
          currentModelId: event.currentModelId ?? this._info.currentModelId,
          availableModels: event.availableModels ?? this._info.availableModels,
        });
        break;
      case 'title_update':
        this._patchInfo({ title: event.title });
        break;
      default:
        break;
    }
  }

  private async _onRequestPermission(
    params: RequestPermissionRequest
  ): Promise<RequestPermissionResponse> {
    if (this._params.autoAccept) {
      const allow = params.options.find(
        (o) => o.kind === 'allow_once' || o.kind === 'allow_always'
      );
      if (allow) {
        return { outcome: { outcome: 'selected', optionId: allow.optionId } };
      }
    }

    const requestId = `perm_${++this._permissionSeq}_${Date.now().toString(36)}`;
    const request = translatePermissionRequest(this._params.sessionId, requestId, params);

    return new Promise<RequestPermissionResponse>((resolve) => {
      this._pendingPermissions.set(requestId, { request, resolve });
      this._emit({ type: 'permission_requested', request });
    });
  }

  private _rejectAllPermissions(): void {
    for (const [requestId, pending] of this._pendingPermissions) {
      pending.resolve({ outcome: { outcome: 'cancelled' } });
      this._emit({ type: 'permission_resolved', requestId, cancelled: true });
    }
    this._pendingPermissions.clear();
  }

  private _emit(event: IACPStreamEvent): void {
    if (this._replayingHistory && event.type !== 'history_replay_start' && event.type !== 'history_replay_end') {
      this._replayBuffer.push(event);
      return;
    }
    this._events$.next(event);
  }

  private _setStatus(status: IACPSessionInfo['status'], errorMessage?: string): void {
    this._patchInfo({ status, errorMessage });
    this._emit({ type: 'session_status', status, errorMessage });
  }

  private _patchInfo(patch: Partial<IACPSessionInfo>): void {
    this._info = {
      ...this._info,
      ...patch,
      updatedAt: Date.now(),
    };
  }

  private _requireConnection(): ClientContext {
    if (!this._connection) {
      throw new Error('ACP connection is not started');
    }
    return this._connection;
  }

  private _requireTerminals(): ACPTerminalRegistry {
    if (!this._terminals) {
      throw new Error('ACP terminal registry is not available');
    }
    return this._terminals;
  }

  private _requireNativeSessionId(): string {
    if (!this._nativeSessionId) {
      throw new Error('ACP native session id is missing');
    }
    return this._nativeSessionId;
  }

  private async _killChild(): Promise<void> {
    const child = this._child;
    this._child = null;
    if (!child || child.killed) {
      return;
    }
    await treeKill(child.pid, AGENT_TERMINATE_GRACE_MS);
  }
}

function blocksToContent(blocks: IACPPromptBlock[]): ContentBlock[] {
  return blocks.map((block): ContentBlock => {
    if (block.type === 'text') {
      return { type: 'text', text: block.text };
    }
    return {
      type: 'image',
      data: block.image.data,
      mimeType: block.image.mimeType,
    };
  });
}

function buildUserMessage(blocks: IACPPromptBlock[]): IChatMessage {
  const text = blocks
    .filter((b): b is Extract<IACPPromptBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return {
    id: `acp_${generateRandomId()}`,
    role: 'user',
    parts: text ? [{ type: 'text', text }] : [],
    createdAt: Date.now(),
  };
}

async function treeKill(pid: number | undefined, graceMs: number): Promise<void> {
  if (pid == null) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      return;
    }
    // Negative PID targets the whole group (spawned detached above); fall back
    // to the bare pid when the platform refused the group.
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      process.kill(pid, 'SIGTERM');
    }
    await sleep(graceMs);
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
  } catch {
    // already gone
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
