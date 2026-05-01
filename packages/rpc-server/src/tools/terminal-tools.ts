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

import type { IAgentTool, IAgentToolRegistryService, IAgentToolResult } from '@termlnk/agent';
import type { IDisposable, ILogService } from '@termlnk/core';
import type { ISSHToolService } from '@termlnk/rpc';
import type { IPTYSessionService, ITerminalCommand } from '@termlnk/terminal';
import type { Buffer as NodeBuffer } from 'node:buffer';
import type { Observable } from 'rxjs';
import type { ICommandBlockService } from '../services/shell-integration/command-block.service';
import { PTYSessionStatus } from '@termlnk/terminal';
import { filter, firstValueFrom, take, timeout } from 'rxjs';
import { stripAnsi } from '../common/ansi-strip';
import { OutputBufferManager } from '../common/output-buffer';

export interface ITerminalToolDeps {
  sshToolService: ISSHToolService;
  logService: ILogService;
  ptySessionService?: IPTYSessionService;
  commandBlockService?: ICommandBlockService;
  /** Optional shared output buffer. If omitted a fresh instance is created and disposed with the tools. */
  outputBuffers?: OutputBufferManager;
}

export function registerTerminalTools(deps: ITerminalToolDeps, toolRegistry: IAgentToolRegistryService): IDisposable[] {
  const { sshToolService, logService, ptySessionService, commandBlockService } = deps;
  const outputBuffers = deps.outputBuffers ?? new OutputBufferManager();
  const ownsBuffers = !deps.outputBuffers;

  const disposables: IDisposable[] = [];

  disposables.push(
    toolRegistry.registerTool(createCreateSessionTool(sshToolService, ptySessionService, logService))
  );

  disposables.push(
    toolRegistry.registerTool(createListSessionsTool(sshToolService, logService, ptySessionService))
  );

  if (commandBlockService) {
    disposables.push(
      toolRegistry.registerTool(createRunTool(commandBlockService, sshToolService, logService, outputBuffers, ptySessionService))
    );
    disposables.push(
      toolRegistry.registerTool(createListBlocksTool(commandBlockService, logService))
    );
    disposables.push(
      toolRegistry.registerTool(createReadBlockTool(commandBlockService, logService))
    );
    disposables.push(
      toolRegistry.registerTool(createPollBlockTool(commandBlockService, logService))
    );
  }

  disposables.push(
    toolRegistry.registerTool(createCloseSessionTool(sshToolService, logService, outputBuffers, ptySessionService))
  );

  if (ownsBuffers) {
    disposables.push({ dispose: () => outputBuffers.cleanup() });
  }

  return disposables;
}

// ---------------------------------------------------------------------------
// Session lifecycle tools
// ---------------------------------------------------------------------------

function createCreateSessionTool(
  sshToolService: ISSHToolService,
  ptySessionService: IPTYSessionService | undefined,
  logService: ILogService
): IAgentTool {
  return {
    name: 'termlnk_terminal_create_session',
    label: 'Create Terminal Session',
    category: 'terminal',
    description: 'Open a terminal session and return its sessionId. Pass hostId to open an SSH session to a configured host (use termlnk_host_list first); omit hostId to open a local PTY. Before opening, call termlnk_terminal_list_sessions to avoid duplicates.',
    inputSchema: {
      type: 'object',
      properties: {
        hostId: {
          type: 'string',
          description: 'Configured host ID for an SSH session. Omit to open a local PTY.',
        },
        cols: { type: 'number', description: 'Terminal width in columns. Default: 80.', default: 80 },
        rows: { type: 'number', description: 'Terminal height in rows. Default: 24.', default: 24 },
      },
    },
    handler: async (args) => {
      try {
        const hostId = typeof args.hostId === 'string' && args.hostId ? args.hostId : null;
        const cols = Number(args.cols) || 80;
        const rows = Number(args.rows) || 24;

        if (hostId) {
          const result = await sshToolService.connectHost(hostId, cols, rows);
          return jsonOk({
            success: true,
            type: 'ssh',
            sessionId: result.sessionId,
            hostId: result.hostId,
            hostLabel: result.hostLabel,
          });
        }

        if (!ptySessionService) {
          return jsonError('Local PTY is not available in this process; pass a hostId to open a remote SSH session.');
        }

        const sessionId = await ptySessionService.createSession({ cols, rows });
        return jsonOk({ success: true, type: 'local', sessionId });
      } catch (err) {
        logService.error('[TerminalTools]', 'create_session failed:', err);
        return jsonError(`Failed to create session: ${formatError(err)}`);
      }
    },
  };
}

function createListSessionsTool(sshToolService: ISSHToolService, logService: ILogService, ptySessionService?: IPTYSessionService): IAgentTool {
  return {
    name: 'termlnk_terminal_list_sessions',
    label: 'List Terminal Sessions',
    category: 'terminal',
    description: 'List active terminal sessions (SSH + local PTY). Always call before operating on a session — never assume a sessionId. Returns id, type, host label, status.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status. If omitted, all sessions are returned.',
          enum: ['idle', 'connecting', 'authenticating', 'opening_shell', 'ready', 'closed', 'error'],
        },
      },
    },
    handler: async (args) => {
      try {
        const statusFilter = typeof args.status === 'string' ? args.status : undefined;

        const sshSessions = await sshToolService.listSessions(statusFilter);

        const ptyInfos: { sessionId: string; type: 'local'; status: string; isConnected: boolean }[] = [];
        if (ptySessionService) {
          const ptySessions = ptySessionService.getAllSessions();
          for (const session of ptySessions) {
            const status = session.status;
            if (statusFilter && status !== statusFilter) {
              continue;
            }
            ptyInfos.push({
              sessionId: session.sessionId,
              type: 'local' as const,
              status,
              isConnected: status === PTYSessionStatus.READY,
            });
          }
        }

        const sessions = [...sshSessions, ...ptyInfos];
        return jsonOk({ sessions, count: sessions.length });
      } catch (err) {
        logService.error('[TerminalTools]', 'list_sessions failed:', err);
        return jsonError(`Failed to list sessions: ${formatError(err)}`);
      }
    },
  };
}

function createCloseSessionTool(
  sshToolService: ISSHToolService,
  logService: ILogService,
  outputBuffers: OutputBufferManager,
  ptySessionService?: IPTYSessionService
): IAgentTool {
  return {
    name: 'termlnk_terminal_close_session',
    label: 'Close Terminal Session',
    category: 'terminal',
    description: 'Close a terminal session (SSH or local PTY) and its UI tab. The sessionId becomes invalid after this call.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to close.' },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      try {
        const sessionId = String(args.sessionId ?? '');
        if (!sessionId) {
          return jsonError('sessionId is required.');
        }

        const sshStatus = sshToolService.getSessionStatus(sessionId);
        if (sshStatus !== null) {
          await sshToolService.closeSession(sessionId);
          outputBuffers.removeBuffer(sessionId);
          return jsonOk({ success: true, sessionId, type: 'ssh' });
        }

        if (ptySessionService) {
          const ptySession = ptySessionService.getSession(sessionId);
          if (ptySession) {
            await ptySessionService.closeSession(sessionId);
            outputBuffers.removeBuffer(sessionId);
            return jsonOk({ success: true, sessionId, type: 'local' });
          }
        }

        return jsonError(`Session "${sessionId}" not found.`);
      } catch (err) {
        logService.error('[TerminalTools]', 'close_session failed:', err);
        return jsonError(`Failed to close session: ${formatError(err)}`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Command-block tools (shell integration via OSC 633)
// ---------------------------------------------------------------------------

function createRunTool(
  commandBlockService: ICommandBlockService,
  sshToolService: ISSHToolService,
  logService: ILogService,
  outputBuffers: OutputBufferManager,
  ptySessionService?: IPTYSessionService
): IAgentTool {
  return {
    name: 'termlnk_terminal_run',
    label: 'Run Terminal Command',
    category: 'terminal',
    description: 'Run a command in a terminal session and return a structured result (exit code, ANSI-stripped output, cwd, duration, blockId). Set waitForExit=false for streaming/long-running commands — get a blockId immediately and poll with termlnk_terminal_poll_block. If outputTruncated is true, fetch more via termlnk_terminal_read_block. For destructive commands (rm -rf, dd, mkfs, DROP TABLE, shutdown, git push --force, ...) confirm with the user first.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to run the command in.' },
        command: { type: 'string', description: 'Command to execute. Do NOT include a trailing newline — it is added automatically.' },
        timeoutMs: { type: 'number', description: 'Max ms to wait. Default 15000, max 120000. On timeout, returns partial output + blockId.', default: 15000 },
        outputPreviewLines: { type: 'number', description: 'Max lines of output returned inline. Default 200.', default: 200 },
        waitForExit: { type: 'boolean', description: 'Set false for streaming/long-running. Default true.', default: true },
      },
      required: ['sessionId', 'command'],
    },
    /**
     * Provides per-call SSH/local hint to the permission system. Approval
     * itself is handled by the universal wrap layer in agent-core, not here.
     */
    resolveMetadata: (args) => {
      const sessionId = String(args.sessionId ?? '');
      if (!sessionId) {
        return undefined;
      }
      const isSSH = sshToolService.getSessionStatus(sessionId) !== null;
      return { terminalSessionType: isSSH ? 'ssh' : 'local' };
    },
    handler: async (args) => {
      try {
        const sessionId = String(args.sessionId ?? '');
        const command = String(args.command ?? '');
        const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 15000, 1000), 120000);
        const outputPreviewLines = Math.min(Math.max(Number(args.outputPreviewLines) || 200, 1), 10000);
        const waitForExit = args.waitForExit !== false;

        if (!sessionId || !command) {
          return jsonError('Both sessionId and command are required.');
        }

        if (!commandBlockService.isAttached(sessionId)) {
          const sshData$ = sshToolService.getSessionData$(sessionId);
          if (sshData$) {
            commandBlockService.attachSession(sessionId, sshData$);
          }
        }

        // Arm heuristic buffer in parallel for fallback when shell integration is inactive.
        const heuristicData$ = resolveHeuristicDataStream(sessionId, sshToolService, ptySessionService);
        if (heuristicData$) {
          outputBuffers.ensureBuffering(sessionId, heuristicData$);
        }

        const finishedPromise = firstValueFrom(
          commandBlockService.blockFinished$.pipe(
            filter((b) => b.sessionId === sessionId),
            take(1),
            timeout(timeoutMs)
          )
        );

        const startedPromise = !waitForExit
          ? firstValueFrom(
            commandBlockService.blockStarted$.pipe(
              filter((e) => e.sessionId === sessionId),
              take(1),
              timeout(5000)
            )
          ).then((e) => e.blockId)
          : null;

        finishedPromise.catch(() => {});
        startedPromise?.catch(() => {});

        const commandWithEnter = command.endsWith('\r') || command.endsWith('\n')
          ? command
          : `${command}\r`;

        const writeResult = await writeCommandToSession(sessionId, commandWithEnter, sshToolService, ptySessionService);
        if (!writeResult.ok) {
          return jsonError(writeResult.error);
        }

        if (!waitForExit && startedPromise) {
          try {
            const blockId = await startedPromise;
            return jsonOk({
              status: 'running',
              blockId,
              sessionId,
              command,
              hint: `Command started in background. Poll with termlnk_terminal_poll_block (blockId=${blockId}).`,
            });
          } catch {
            return jsonError('Command did not emit an OSC 633;C start event within 5s. Shell integration may be inactive on this session.');
          }
        }

        try {
          const block = await finishedPromise;
          return formatBlockResult(block, outputPreviewLines, false);
        } catch {
          const pending = commandBlockService.getPendingSnapshot(sessionId);
          if (pending) {
            return jsonOk({
              status: 'timeout',
              blockId: pending.blockId,
              sessionId,
              command: pending.command,
              output: truncateToLines(pending.output, outputPreviewLines).text,
              outputTotalBytes: pending.outputTotalBytes,
              outputTruncated: true,
              hint: `Not finished after ${timeoutMs}ms. Poll with termlnk_terminal_poll_block (blockId=${pending.blockId}) or send Ctrl-C by writing "\\u0003" to interrupt.`,
            });
          }

          if (heuristicData$) {
            const rawOutput = await outputBuffers.drainBuffer(sessionId, heuristicData$, 0);
            const clean = stripAnsi(rawOutput).replace(commandEchoPattern(command), '');
            const truncated = truncateToLines(clean.trimStart(), outputPreviewLines);
            const osc633Events = commandBlockService.getOsc633EventCount(sessionId);
            const shellIntegrationActive = osc633Events > 0;
            return jsonOk({
              status: 'heuristic_completed',
              sessionId,
              command,
              output: truncated.text,
              outputTotalBytes: rawOutput.length,
              outputTruncated: truncated.truncated,
              shellIntegrated: false,
              shellIntegrationActive,
              osc633EventCount: osc633Events,
              exitCode: null,
              durationMs: timeoutMs,
              hint: shellIntegrationActive
                ? `Shell integration produced ${osc633Events} OSC 633 events but no command-end (D) within ${timeoutMs}ms. Returned a best-effort snapshot.`
                : 'No OSC 633 events observed — shell integration likely did not take effect (unsupported shell, overridden PS1, or script not sourced). Returned a best-effort snapshot.',
            });
          }

          return jsonError(`Command did not complete within ${timeoutMs}ms and no fallback data stream is available.`);
        }
      } catch (err) {
        logService.error('[TerminalTools]', 'run failed:', err);
        return jsonError(`Failed to run command: ${formatError(err)}`);
      }
    },
  };
}

function createListBlocksTool(
  commandBlockService: ICommandBlockService,
  logService: ILogService
): IAgentTool {
  return {
    name: 'termlnk_terminal_list_blocks',
    label: 'List Command Blocks',
    category: 'terminal',
    description: 'List recent completed command blocks for a session. Returns metadata only (command, exitCode, durationMs, cwd, seq) plus a 1-line outputPreview. Use termlnk_terminal_read_block to fetch a full block.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'The terminal session ID.' },
        limit: { type: 'number', description: 'Max blocks to return, newest last. Default 20.', default: 20 },
        sinceSeq: { type: 'number', description: 'Only return blocks with seq strictly greater than this value.' },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      try {
        const sessionId = String(args.sessionId ?? '');
        const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 200);
        const sinceSeq = typeof args.sinceSeq === 'number' ? args.sinceSeq : null;

        if (!sessionId) {
          return jsonError('sessionId is required.');
        }

        if (!commandBlockService.isAttached(sessionId)) {
          return jsonError(`Session "${sessionId}" has no command block tracker attached. Run a command with termlnk_terminal_run first, or ensure shell integration is active.`);
        }

        let blocks = commandBlockService.getBlocks(sessionId);
        if (sinceSeq !== null) {
          blocks = blocks.filter((b) => (b.seq ?? 0) > sinceSeq);
        }
        const sliced = blocks.slice(-limit);
        const pending = commandBlockService.getPendingSnapshot(sessionId);

        return jsonOk({
          sessionId,
          totalFinished: blocks.length,
          blocks: sliced.map((b) => ({
            blockId: b.id,
            seq: b.seq,
            command: b.command,
            exitCode: b.exitCode,
            durationMs: b.duration,
            cwd: b.cwd,
            outputPreview: firstLine(b.output),
            outputTotalBytes: b.outputTotalBytes ?? b.output.length,
            outputTruncated: b.outputTruncated ?? false,
            shellIntegrated: b.shellIntegrated ?? true,
          })),
          running: pending
            ? {
              blockId: pending.blockId,
              command: pending.command,
              outputTotalBytes: pending.outputTotalBytes,
            }
            : null,
        });
      } catch (err) {
        logService.error('[TerminalTools]', 'list_blocks failed:', err);
        return jsonError(`Failed to list blocks: ${formatError(err)}`);
      }
    },
  };
}

function createReadBlockTool(
  commandBlockService: ICommandBlockService,
  logService: ILogService
): IAgentTool {
  return {
    name: 'termlnk_terminal_read_block',
    label: 'Read Command Block',
    category: 'terminal',
    description: 'Read the full output (or a line range) of a completed command block. Use when termlnk_terminal_run reports outputTruncated=true, or to revisit an earlier block. For running blocks, use termlnk_terminal_poll_block.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'The terminal session ID.' },
        blockId: { type: 'string', description: 'Block UUID. Mutually exclusive with seq and last.' },
        seq: { type: 'number', description: 'Block seq (monotonic within session). Mutually exclusive with blockId and last.' },
        last: { type: 'number', description: 'Read the N-th most recent block (1 = most recent). Mutually exclusive with blockId and seq.' },
        lineStart: { type: 'number', description: 'Optional 1-based start line (inclusive). Default 1.' },
        lineEnd: { type: 'number', description: 'Optional 1-based end line (inclusive). Default = full.' },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      try {
        const sessionId = String(args.sessionId ?? '');
        if (!sessionId) {
          return jsonError('sessionId is required.');
        }

        const blockIdArg = typeof args.blockId === 'string' ? args.blockId : null;
        const seqArg = typeof args.seq === 'number' ? args.seq : null;
        const lastArg = typeof args.last === 'number' ? args.last : null;

        let block: ITerminalCommand | null = null;
        if (blockIdArg) {
          block = commandBlockService.getBlockById(sessionId, blockIdArg);
        } else if (seqArg !== null) {
          const blocks = commandBlockService.getBlocks(sessionId);
          block = blocks.find((b) => b.seq === seqArg) ?? null;
        } else if (lastArg !== null) {
          const n = Math.max(1, Math.floor(lastArg));
          const blocks = commandBlockService.getBlocks(sessionId);
          block = blocks.length >= n ? blocks[blocks.length - n] : null;
        } else {
          block = commandBlockService.getLastBlock(sessionId);
        }

        if (!block) {
          return jsonError('No matching command block found for the given selector.');
        }

        const lineStart = typeof args.lineStart === 'number' ? Math.max(1, Math.floor(args.lineStart)) : 1;
        const lineEnd = typeof args.lineEnd === 'number' ? Math.max(lineStart, Math.floor(args.lineEnd)) : undefined;

        const allLines = block.output.split('\n');
        const totalLines = allLines.length;
        const slice = allLines.slice(lineStart - 1, lineEnd ?? totalLines);

        return jsonOk({
          sessionId,
          blockId: block.id,
          seq: block.seq,
          command: block.command,
          exitCode: block.exitCode,
          cwd: block.cwd,
          durationMs: block.duration,
          output: slice.join('\n'),
          lineStart,
          lineEnd: lineEnd ?? totalLines,
          totalLines,
          outputTotalBytes: block.outputTotalBytes ?? block.output.length,
          outputTruncated: block.outputTruncated ?? false,
          shellIntegrated: block.shellIntegrated ?? true,
        });
      } catch (err) {
        logService.error('[TerminalTools]', 'read_block failed:', err);
        return jsonError(`Failed to read block: ${formatError(err)}`);
      }
    },
  };
}

function createPollBlockTool(
  commandBlockService: ICommandBlockService,
  logService: ILogService
): IAgentTool {
  return {
    name: 'termlnk_terminal_poll_block',
    label: 'Poll Command Block',
    category: 'terminal',
    description: 'Poll a running command block. Returns the current ANSI-stripped output, a running flag, and exitCode (only when finished). Use after termlnk_terminal_run waitForExit=false. Waits up to maxWaitMs for new data.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'The terminal session ID.' },
        blockId: { type: 'string', description: 'The blockId returned by termlnk_terminal_run.' },
        maxWaitMs: { type: 'number', description: 'Max ms to wait for the block to finish. Default 2000, max 30000.', default: 2000 },
        outputPreviewLines: { type: 'number', description: 'Max lines of output returned inline. Default 200.', default: 200 },
      },
      required: ['sessionId', 'blockId'],
    },
    handler: async (args) => {
      try {
        const sessionId = String(args.sessionId ?? '');
        const blockId = String(args.blockId ?? '');
        const maxWaitMs = Math.min(Math.max(Number(args.maxWaitMs) || 2000, 100), 30000);
        const outputPreviewLines = Math.min(Math.max(Number(args.outputPreviewLines) || 200, 1), 10000);

        if (!sessionId || !blockId) {
          return jsonError('Both sessionId and blockId are required.');
        }

        const finishedBlock = commandBlockService.getBlockById(sessionId, blockId);
        if (finishedBlock) {
          return formatBlockResult(finishedBlock, outputPreviewLines, true);
        }

        const pending = commandBlockService.getPendingSnapshot(sessionId);
        if (!pending || pending.blockId !== blockId) {
          return jsonError(`Block "${blockId}" not found for session "${sessionId}". It may have been evicted or the sessionId is wrong.`);
        }

        try {
          const block = await firstValueFrom(
            commandBlockService.blockFinished$.pipe(
              filter((b) => b.sessionId === sessionId && b.id === blockId),
              take(1),
              timeout(maxWaitMs)
            )
          );
          return formatBlockResult(block, outputPreviewLines, true);
        } catch {
          const latest = commandBlockService.getPendingSnapshot(sessionId);
          if (!latest || latest.blockId !== blockId) {
            const finished = commandBlockService.getBlockById(sessionId, blockId);
            if (finished) {
              return formatBlockResult(finished, outputPreviewLines, true);
            }
            return jsonError(`Block "${blockId}" is no longer being tracked. It may have been aborted.`);
          }
          const truncated = truncateToLines(latest.output, outputPreviewLines);
          return jsonOk({
            status: 'running',
            sessionId,
            blockId: latest.blockId,
            command: latest.command,
            output: truncated.text,
            outputTotalBytes: latest.outputTotalBytes,
            outputTruncated: truncated.truncated,
            isRunning: true,
          });
        }
      } catch (err) {
        logService.error('[TerminalTools]', 'poll_block failed:', err);
        return jsonError(`Failed to poll block: ${formatError(err)}`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveHeuristicDataStream(
  sessionId: string,
  sshToolService: ISSHToolService,
  ptySessionService?: IPTYSessionService
): Observable<NodeBuffer | Uint8Array | string> | null {
  const sshData$ = sshToolService.getSessionData$(sessionId);
  if (sshData$) {
    return sshData$ as Observable<NodeBuffer | Uint8Array | string>;
  }
  if (ptySessionService) {
    const ptySession = ptySessionService.getSession(sessionId);
    if (ptySession) {
      return ptySession.data$ as unknown as Observable<NodeBuffer | Uint8Array | string>;
    }
  }
  return null;
}

function commandEchoPattern(command: string): RegExp {
  const escaped = command.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*\\n`);
}

async function writeCommandToSession(
  sessionId: string,
  text: string,
  sshToolService: ISSHToolService,
  ptySessionService?: IPTYSessionService
): Promise<{ ok: true; type: 'ssh' | 'local' } | { ok: false; error: string }> {
  const sshStatus = sshToolService.getSessionStatus(sessionId);
  if (sshStatus !== null) {
    if (sshStatus !== 'ready') {
      return { ok: false, error: `Session "${sessionId}" is not ready (status: ${sshStatus}).` };
    }
    await sshToolService.writeToSession(sessionId, text);
    return { ok: true, type: 'ssh' };
  }
  if (ptySessionService) {
    const ptySession = ptySessionService.getSession(sessionId);
    if (ptySession) {
      if (ptySession.status !== PTYSessionStatus.READY) {
        return { ok: false, error: `Session "${sessionId}" is not ready (status: ${ptySession.status}).` };
      }
      await ptySessionService.write(sessionId, text);
      return { ok: true, type: 'local' };
    }
  }
  return { ok: false, error: `Session "${sessionId}" not found.` };
}

function formatBlockResult(block: ITerminalCommand, maxPreviewLines: number, fromPoll: boolean): IAgentToolResult {
  const truncated = truncateToLines(block.output, maxPreviewLines);
  const wasTruncated = (block.outputTruncated ?? false) || truncated.truncated;
  const hintSuffix = 'Use termlnk_terminal_read_block with a lineRange to fetch more, or re-run with grep/head/tail piped.';
  return jsonOk({
    status: 'completed',
    sessionId: block.sessionId,
    blockId: block.id,
    seq: block.seq,
    command: block.command,
    exitCode: block.exitCode,
    cwd: block.cwd,
    durationMs: block.duration,
    output: truncated.text,
    outputTotalBytes: block.outputTotalBytes ?? block.output.length,
    outputTruncated: wasTruncated,
    shellIntegrated: block.shellIntegrated ?? true,
    isRunning: fromPoll ? false : undefined,
    ...(wasTruncated ? { truncationHint: hintSuffix } : {}),
  });
}

function truncateToLines(text: string, maxLines: number): { text: string; truncated: boolean } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return { text, truncated: false };
  }
  return { text: `${lines.slice(0, maxLines).join('\n')}\n… [truncated ${lines.length - maxLines} more lines]`, truncated: true };
}

function firstLine(text: string): string {
  const idx = text.indexOf('\n');
  const line = idx === -1 ? text : text.slice(0, idx);
  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
}

function jsonOk(data: Record<string, unknown>): IAgentToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function jsonError(message: string): IAgentToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
