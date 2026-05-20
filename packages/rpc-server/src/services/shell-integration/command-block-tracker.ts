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
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { parseOsc633 } from '@termlnk/terminal';
import { Subject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { stripAnsi } from '../../common/ansi-strip';

const ESC = '\u001B';
const BEL = '\u0007';
const ST = '\\';
const DEFAULT_MAX_OUTPUT_BYTES = 512 * 1024;
const DEFAULT_MAX_OSC_PAYLOAD = 8192;

type ParseState = 'ground' | 'escape' | 'osc-id' | 'osc-payload';
type FlowState = 'idle' | 'at-prompt' | 'after-prompt-end' | 'executing';

interface IPendingBlock {
  id: string;
  commandLine: string;
  startedAt: number;
  rawChunks: string[];
  rawBytes: number;
}

export interface ICommandBlockTrackerOptions {
  sessionId: string;
  maxOutputBytes?: number;
  keepRawOutput?: boolean;
}

export interface IBlockStartedEvent {
  sessionId: string;
  blockId: string;
}

export interface INaturalLanguageQueryEvent {
  sessionId: string;
  query: string;
  /** Monotonic counter — same scheme as block seq, incremented per query. */
  seq: number;
  /** Wall-clock timestamp the query was observed (ms since epoch). */
  observedAt: number;
}

/**
 * Raw OSC 633;P values as the script printed them (e.g. `Darwin`, `zsh`,
 * `ubuntu`). Normalization to PlatformType/ShellType is the consumer's job;
 * tracker stays protocol-faithful.
 */
export interface IRawRemoteEnv {
  remoteOS: string;
  remoteShell: string;
  remoteDistro: string;
}

export interface IRawRemoteEnvChange {
  sessionId: string;
  env: IRawRemoteEnv;
}

export interface IPendingBlockSnapshot {
  blockId: string;
  command: string;
  startedAt: number;
  outputTotalBytes: number;
  output: string;
  outputRaw: string;
}

/**
 * Per-session FSM that consumes the raw terminal byte stream, detects OSC 633
 * shell integration events, and emits structured command blocks.
 *
 * Input: raw PTY / SSH bytes (as strings). Output: `ITerminalCommand` objects
 * representing completed commands, with ANSI-stripped output and exit codes.
 *
 * Non-OSC bytes are accumulated only while in the `executing` flow state, so
 * prompt text and command echo (which show up before OSC 633;C) are
 * automatically excluded from the captured output.
 */
export class CommandBlockTracker extends Disposable {
  private readonly _sessionId: string;
  private readonly _maxOutputBytes: number;
  private readonly _keepRawOutput: boolean;

  private readonly _blockFinished$ = new Subject<ITerminalCommand>();
  readonly blockFinished$: Observable<ITerminalCommand> = this._blockFinished$.asObservable();

  private readonly _blockStarted$ = new Subject<IBlockStartedEvent>();
  readonly blockStarted$: Observable<IBlockStartedEvent> = this._blockStarted$.asObservable();

  private readonly _query$ = new Subject<INaturalLanguageQueryEvent>();
  readonly query$: Observable<INaturalLanguageQueryEvent> = this._query$.asObservable();
  private _querySeq = 0;

  private readonly _envChanged$ = new Subject<IRawRemoteEnvChange>();
  readonly envChanged$: Observable<IRawRemoteEnvChange> = this._envChanged$.asObservable();

  private _parseState: ParseState = 'ground';
  private _flowState: FlowState = 'idle';
  private _oscIdBuffer = '';
  private _oscPayload = '';
  private _skipNextStChar = false;

  private _pending: IPendingBlock | null = null;
  private _currentCwd = '';
  private readonly _currentEnv: IRawRemoteEnv = { remoteOS: '', remoteShell: '', remoteDistro: '' };
  private _seq = 0;
  private _osc633EventCount = 0;

  private readonly _blocks: ITerminalCommand[] = [];

  constructor(options: ICommandBlockTrackerOptions) {
    super();
    this._sessionId = options.sessionId;
    this._maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    this._keepRawOutput = options.keepRawOutput ?? false;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get currentCwd(): string {
    return this._currentCwd;
  }

  get currentRemoteOS(): string {
    return this._currentEnv.remoteOS;
  }

  get currentRemoteShell(): string {
    return this._currentEnv.remoteShell;
  }

  get currentRemoteDistro(): string {
    return this._currentEnv.remoteDistro;
  }

  getRawEnv(): IRawRemoteEnv {
    return { ...this._currentEnv };
  }

  /** Count of OSC 633 events received on this session (A/B/C/D/E/P combined). */
  get osc633EventCount(): number {
    return this._osc633EventCount;
  }

  getBlocks(): ITerminalCommand[] {
    return this._blocks.slice();
  }

  getLastBlock(): ITerminalCommand | null {
    return this._blocks.length > 0 ? this._blocks[this._blocks.length - 1] : null;
  }

  getBlockById(blockId: string): ITerminalCommand | null {
    return this._blocks.find((b) => b.id === blockId) ?? null;
  }

  hasPending(): boolean {
    return this._pending !== null;
  }

  snapshotPending(): IPendingBlockSnapshot | null {
    if (!this._pending) {
      return null;
    }
    const rawOutput = this._pending.rawChunks.join('');
    return {
      blockId: this._pending.id,
      command: this._pending.commandLine,
      startedAt: this._pending.startedAt,
      outputTotalBytes: this._pending.rawBytes,
      output: stripAnsi(rawOutput),
      outputRaw: rawOutput,
    };
  }

  feed(chunk: string): void {
    for (let i = 0; i < chunk.length; i += 1) {
      this._feedChar(chunk[i]);
    }
  }

  override dispose(): void {
    this._blockFinished$.complete();
    this._blockStarted$.complete();
    this._query$.complete();
    this._envChanged$.complete();
    this._blocks.length = 0;
    this._pending = null;
    super.dispose();
  }

  private _feedChar(ch: string): void {
    if (this._skipNextStChar) {
      this._skipNextStChar = false;
      if (ch === ST) {
        return;
      }
    }

    switch (this._parseState) {
      case 'ground':
        if (ch === ESC) {
          this._parseState = 'escape';
        } else {
          this._appendOutputChar(ch);
        }
        break;

      case 'escape':
        if (ch === ']') {
          this._parseState = 'osc-id';
          this._oscIdBuffer = '';
          this._oscPayload = '';
        } else {
          // Previous ESC was not an OSC introducer — preserve both bytes as
          // literal output so stripAnsi() can deal with CSI/SGR/DCS/etc.
          this._appendOutputChar(ESC);
          if (ch === ESC) {
            this._parseState = 'escape';
          } else {
            this._appendOutputChar(ch);
            this._parseState = 'ground';
          }
        }
        break;

      case 'osc-id':
        if (ch >= '0' && ch <= '9') {
          this._oscIdBuffer += ch;
        } else if (ch === ';' && this._oscIdBuffer.length > 0) {
          this._parseState = 'osc-payload';
        } else if (ch === ESC) {
          this._parseState = 'escape';
          this._oscIdBuffer = '';
        } else {
          this._resetOscState();
        }
        break;

      case 'osc-payload':
        if (ch === BEL) {
          this._emitOsc();
        } else if (ch === ESC) {
          this._emitOsc();
          this._skipNextStChar = true;
        } else if (this._oscPayload.length < DEFAULT_MAX_OSC_PAYLOAD) {
          this._oscPayload += ch;
        }
        break;
    }
  }

  private _resetOscState(): void {
    this._parseState = 'ground';
    this._oscIdBuffer = '';
    this._oscPayload = '';
  }

  private _emitOsc(): void {
    const oscNumber = Number.parseInt(this._oscIdBuffer, 10);
    const payload = this._oscPayload;
    this._resetOscState();

    if (!Number.isFinite(oscNumber)) {
      return;
    }

    if (oscNumber === 633) {
      this._handleOsc633(payload);
      return;
    }

    if (oscNumber === 7) {
      this._handleOsc7(payload);
    }
  }

  private _handleOsc633(payload: string): void {
    const event = parseOsc633(payload);
    if (!event) {
      return;
    }

    this._osc633EventCount += 1;

    switch (event.type) {
      case 'A':
        this._flowState = 'at-prompt';
        break;

      case 'B':
        this._flowState = 'after-prompt-end';
        break;

      case 'E':
        if (!this._pending) {
          this._pending = this._createPending();
        }
        this._pending.commandLine = decodeOsc633CommandLine(event.commandLine);
        break;

      case 'C':
        if (!this._pending) {
          this._pending = this._createPending();
        }
        this._pending.startedAt = Date.now();
        this._flowState = 'executing';
        break;

      case 'D':
        this._finalizeBlock(event.exitCode);
        this._flowState = 'idle';
        break;

      case 'P':
        if (event.key === 'Cwd') {
          this._currentCwd = event.value;
        } else if (event.key === 'RemoteOS') {
          this._updateEnvField('remoteOS', event.value);
        } else if (event.key === 'RemoteShell') {
          this._updateEnvField('remoteShell', event.value);
        } else if (event.key === 'RemoteDistro') {
          this._updateEnvField('remoteDistro', event.value);
        }
        break;

      case 'Q':
        this._handleQuery(event.query);
        break;
    }
  }

  private _updateEnvField(field: keyof IRawRemoteEnv, value: string): void {
    if (this._currentEnv[field] === value) {
      return;
    }
    this._currentEnv[field] = value;
    this._envChanged$.next({ sessionId: this._sessionId, env: { ...this._currentEnv } });
  }

  private _handleQuery(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    this._querySeq += 1;
    this._query$.next({
      sessionId: this._sessionId,
      query: trimmed,
      seq: this._querySeq,
      observedAt: Date.now(),
    });
  }

  private _handleOsc7(payload: string): void {
    const match = payload.match(/^file:\/\/[^/]*(\/.*)$/);
    if (match) {
      this._currentCwd = decodeURIComponent(match[1]);
    }
  }

  private _createPending(): IPendingBlock {
    const id = uuidv4();
    const now = Date.now();
    this._blockStarted$.next({ sessionId: this._sessionId, blockId: id });
    return {
      id,
      commandLine: '',
      startedAt: now,
      rawChunks: [],
      rawBytes: 0,
    };
  }

  private _appendOutputChar(ch: string): void {
    if (this._flowState !== 'executing' || !this._pending) {
      return;
    }
    if (this._pending.rawBytes >= this._maxOutputBytes) {
      return;
    }
    this._pending.rawChunks.push(ch);
    this._pending.rawBytes += 1;
  }

  private _finalizeBlock(exitCode: number): void {
    const pending = this._pending;
    this._pending = null;

    if (!pending) {
      return;
    }

    const finishedAt = Date.now();
    const rawOutput = pending.rawChunks.join('');
    const truncated = pending.rawBytes >= this._maxOutputBytes;
    const cleanOutput = stripAnsi(rawOutput);
    this._seq += 1;

    const block: ITerminalCommand = {
      id: pending.id,
      sessionId: this._sessionId,
      command: pending.commandLine,
      output: cleanOutput,
      exitCode,
      cwd: this._currentCwd,
      startLine: null,
      endLine: null,
      timestamp: {
        start: pending.startedAt,
        end: finishedAt,
      },
      duration: Math.max(0, finishedAt - pending.startedAt),
      seq: this._seq,
      outputTotalBytes: pending.rawBytes,
      outputTruncated: truncated,
      shellIntegrated: true,
    };

    if (this._keepRawOutput) {
      block.outputRaw = rawOutput;
    }

    this._blocks.push(block);
    this._blockFinished$.next(block);
  }
}

/**
 * OSC 633 `E` events carry the literal command line, with selected characters
 * escaped (space → \x20, backslash → \\, semicolon → \x3b, newline → \x0a).
 * Reverse that here so downstream consumers see the command as typed.
 */
function decodeOsc633CommandLine(encoded: string): string {
  return encoded
    .replace(/\\x20/g, ' ')
    .replace(/\\x3b/g, ';')
    .replace(/\\x0a/g, '\n')
    .replace(/\\\\/g, '\\');
}
