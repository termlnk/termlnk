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

import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
} from '@agentclientprotocol/sdk';
import type { ChildProcess } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { Disposable } from '@termlnk/core';

interface IManagedTerminal {
  id: string;
  child: ChildProcess;
  chunks: string[];
  totalBytes: number;
  outputByteLimit: number;
  truncated: boolean;
  exitCode: number | null;
  exitSignal: string | null;
  exited: Promise<void>;
  resolveExited: () => void;
}

const DEFAULT_OUTPUT_BYTE_LIMIT = 1024 * 1024;

/**
 * Background (non-PTY) terminals created on behalf of an ACP agent.
 * v1 intentionally does not surface these as real tab sessions.
 */
export class ACPTerminalRegistry extends Disposable {
  private readonly _terminals = new Map<string, IManagedTerminal>();
  private _seq = 0;

  constructor(
    private readonly _env: Record<string, string>
  ) {
    super();
  }

  createTerminal(params: CreateTerminalRequest): CreateTerminalResponse {
    const id = `acp-term-${++this._seq}-${Date.now().toString(36)}`;
    const outputByteLimit = params.outputByteLimit ?? DEFAULT_OUTPUT_BYTE_LIMIT;
    const cwd = params.cwd || undefined;
    const args = params.args ?? [];
    const env = {
      ...this._env,
      ...(params.env
        ? Object.fromEntries(params.env.map((e) => [e.name, e.value]))
        : {}),
    };

    const child = spawn(params.command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let resolveExited!: () => void;
    const exited = new Promise<void>((resolve) => {
      resolveExited = resolve;
    });

    const term: IManagedTerminal = {
      id,
      child,
      chunks: [],
      totalBytes: 0,
      outputByteLimit,
      truncated: false,
      exitCode: null,
      exitSignal: null,
      exited,
      resolveExited,
    };

    const onData = (buf: Buffer) => {
      const text = buf.toString('utf8');
      term.chunks.push(text);
      term.totalBytes += Buffer.byteLength(text, 'utf8');
      while (term.totalBytes > term.outputByteLimit && term.chunks.length > 1) {
        const removed = term.chunks.shift()!;
        term.totalBytes -= Buffer.byteLength(removed, 'utf8');
        term.truncated = true;
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code, signal) => {
      term.exitCode = code;
      term.exitSignal = signal;
      term.resolveExited();
    });

    this._terminals.set(id, term);
    return { terminalId: id };
  }

  terminalOutput(params: TerminalOutputRequest): TerminalOutputResponse {
    const term = this._require(params.terminalId);
    return {
      output: term.chunks.join(''),
      truncated: term.truncated,
      exitStatus:
        term.exitCode !== null || term.exitSignal !== null
          ? { exitCode: term.exitCode, signal: term.exitSignal }
          : null,
    };
  }

  async waitForTerminalExit(
    params: WaitForTerminalExitRequest
  ): Promise<WaitForTerminalExitResponse> {
    const term = this._require(params.terminalId);
    await term.exited;
    return {
      exitCode: term.exitCode,
      signal: term.exitSignal,
    };
  }

  killTerminal(params: KillTerminalRequest): KillTerminalResponse {
    const term = this._terminals.get(params.terminalId);
    if (term && !term.child.killed) {
      term.child.kill('SIGTERM');
    }
    return {};
  }

  releaseTerminal(params: ReleaseTerminalRequest): ReleaseTerminalResponse {
    const term = this._terminals.get(params.terminalId);
    if (!term) {
      return {};
    }
    if (!term.child.killed) {
      term.child.kill('SIGKILL');
    }
    this._terminals.delete(params.terminalId);
    return {};
  }

  override dispose(): void {
    for (const term of this._terminals.values()) {
      if (!term.child.killed) {
        term.child.kill('SIGKILL');
      }
    }
    this._terminals.clear();
    super.dispose();
  }

  private _require(id: string): IManagedTerminal {
    const term = this._terminals.get(id);
    if (!term) {
      throw new Error(`Unknown terminal: ${id}`);
    }
    return term;
  }
}
