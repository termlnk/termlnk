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

import type { IAgentTool, IAgentToolRegistryService, IAgentToolResult, ICommandPermissionService } from '@termlnk/agent';
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

const _outputBuffers = new OutputBufferManager();

export function registerTerminalTools(
  toolRegistry: IAgentToolRegistryService,
  sshToolService: ISSHToolService,
  logService: ILogService,
  ptySessionService?: IPTYSessionService,
  permissionService?: ICommandPermissionService,
  commandBlockService?: ICommandBlockService
): IDisposable[] {
  const disposables: IDisposable[] = [];

  if (ptySessionService) {
    disposables.push(
      toolRegistry.registerTool(createCreateSessionTool(ptySessionService, logService))
    );
  }

  disposables.push(
    toolRegistry.registerTool(createListSessionsTool(sshToolService, logService, ptySessionService))
  );

  disposables.push(
    toolRegistry.registerTool(createExecuteTool(sshToolService, logService, ptySessionService, permissionService))
  );

  disposables.push(
    toolRegistry.registerTool(createGetOutputTool(sshToolService, logService, ptySessionService))
  );

  if (commandBlockService) {
    disposables.push(
      toolRegistry.registerTool(createRunTool(commandBlockService, sshToolService, logService, ptySessionService, permissionService))
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
    toolRegistry.registerTool(createCloseSessionTool(sshToolService, logService, ptySessionService))
  );

  disposables.push({
    dispose: () => {
      _outputBuffers.cleanup();
    },
  });

  return disposables;
}

function createCreateSessionTool(
  ptySessionService: IPTYSessionService,
  logService: ILogService
): IAgentTool {
  return {
    name: 'termlnk_terminal_create_session',
    label: 'Create Terminal Session',
    category: 'terminal',
    description: 'Create a new local terminal (PTY) session. Opens a terminal tab in the UI. Returns the sessionId for use with termlnk_terminal_execute and termlnk_terminal_get_output.',
    inputSchema: {
      type: 'object',
      properties: {
        cols: {
          type: 'number',
          description: 'Terminal width in columns. Default: 80.',
          default: 80,
        },
        rows: {
          type: 'number',
          description: 'Terminal height in rows. Default: 24.',
          default: 24,
        },
      },
    },
    handler: async (args) => {
      try {
        const cols = Number(args.cols) || 80;
        const rows = Number(args.rows) || 24;

        const sessionId = await ptySessionService.createSession({ cols, rows });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, sessionId }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[TerminalTools]', 'create_session failed:', err);
        return createErrorResult(`Failed to create session: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createListSessionsTool(sshToolService: ISSHToolService, logService: ILogService, ptySessionService?: IPTYSessionService): IAgentTool {
  return {
    name: 'termlnk_terminal_list_sessions',
    label: 'List Terminal Sessions',
    category: 'terminal',
    description: 'List all active terminal sessions (SSH and local PTY). IMPORTANT: Always call this tool first before operating on any session — never assume a session ID. Returns each session\'s ID, type (ssh/local), host label, and connection status. Use the sessionId from results as input to termlnk_terminal_execute and termlnk_terminal_get_output.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter sessions by status. If omitted, all sessions are returned.',
          enum: ['idle', 'connecting', 'authenticating', 'opening_shell', 'ready', 'closed', 'error'],
        },
      },
    },
    handler: async (args) => {
      try {
        const statusFilter = args.status as string | undefined;

        // Collect SSH sessions via tool service
        const sshSessions = await sshToolService.listSessions(statusFilter);

        // Collect PTY sessions
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

        const filtered = [...sshSessions, ...ptyInfos];

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ sessions: filtered, count: filtered.length }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[TerminalTools]', 'list_sessions failed:', err);
        return createErrorResult(`Failed to list sessions: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createExecuteTool(
  sshToolService: ISSHToolService,
  logService: ILogService,
  ptySessionService?: IPTYSessionService,
  permissionService?: ICommandPermissionService
): IAgentTool {
  return {
    name: 'termlnk_terminal_execute',
    label: 'Terminal Execute',
    category: 'terminal',
    description: 'LOW-LEVEL: Write raw bytes to a terminal session. Prefer termlnk_terminal_run for normal command execution — it returns a structured result (exit code, clean output, duration) in one call. Use this tool only for: sending control characters (Ctrl-C = "\\u0003", Ctrl-D = "\\u0004"), typing interactive prompt responses, or writing partial input without a trailing Enter. The command string is sent as-is — include a trailing "\\r" to submit a line (do NOT use "\\n"). After this tool, call termlnk_terminal_get_output or termlnk_terminal_poll_block to see the effect. SAFETY: For destructive commands (rm -rf, dd, mkfs, DROP TABLE, git push --force, shutdown, etc.), warn the user and get explicit confirmation. For SSH, exercise extra caution — shutdown/reboot may lock you out of the remote host.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the terminal session to write to.',
        },
        command: {
          type: 'string',
          description: 'The command text to send to the terminal. Include \\r (carriage return) to submit.',
        },
      },
      required: ['sessionId', 'command'],
    },
    handler: async (args) => {
      try {
        const sessionId = args.sessionId as string;
        const command = args.command as string;

        if (!sessionId || !command) {
          return createErrorResult('Both sessionId and command are required.');
        }

        const denial = await checkCommandPermission(permissionService, sshToolService, sessionId, command);
        if (denial) {
          return denial;
        }

        // Try SSH session first
        const sshStatus = sshToolService.getSessionStatus(sessionId);
        if (sshStatus !== null) {
          if (sshStatus !== 'ready') {
            return createErrorResult(`Session "${sessionId}" is not ready (status: ${sshStatus}).`);
          }
          const sshData$ = sshToolService.getSessionData$(sessionId);
          if (sshData$) {
            _outputBuffers.ensureBuffering(sessionId, sshData$);
          }
          await sshToolService.writeToSession(sessionId, command);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, sessionId, bytesWritten: command.length }, null, 2),
            }],
          };
        }

        // Try PTY session
        if (ptySessionService) {
          const ptySession = ptySessionService.getSession(sessionId);
          if (ptySession) {
            if (ptySession.status !== PTYSessionStatus.READY) {
              return createErrorResult(`Session "${sessionId}" is not ready (status: ${ptySession.status}).`);
            }
            _outputBuffers.ensureBuffering(sessionId, ptySession.data$);
            await ptySessionService.write(sessionId, command);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, sessionId, bytesWritten: command.length }, null, 2),
              }],
            };
          }
        }

        return createErrorResult(`Session "${sessionId}" not found.`);
      } catch (err) {
        logService.error('[TerminalTools]', 'execute failed:', err);
        return createErrorResult(`Failed to execute command: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createGetOutputTool(
  sshToolService: ISSHToolService,
  logService: ILogService,
  ptySessionService?: IPTYSessionService
): IAgentTool {
  return {
    name: 'termlnk_terminal_get_output',
    label: 'Get Terminal Output',
    category: 'terminal',
    description: 'FALLBACK: Drain the raw (ANSI-laden) terminal byte stream since the last read. Prefer termlnk_terminal_run / termlnk_terminal_read_block / termlnk_terminal_poll_block — they return structured, ANSI-stripped, per-command results and use far fewer tokens. Use this tool only when shell integration is unavailable (reported as shellIntegrated=false) or when you need to see control characters / interactive prompts that are not bracketed by a command. Timeout guidance: 1000-2000ms for fast commands, 3000-5000ms for medium, 5000-10000ms for slow. Default: 2000ms.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the terminal session to read from.',
        },
        timeoutMs: {
          type: 'number',
          description: 'How long to wait for output in milliseconds. Default: 2000.',
          default: 2000,
        },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      try {
        const sessionId = args.sessionId as string;
        const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 2000, 100), 10000);

        if (!sessionId) {
          return createErrorResult('sessionId is required.');
        }

        // Try SSH session first
        const sshStatus = sshToolService.getSessionStatus(sessionId);
        if (sshStatus !== null) {
          const sshData$ = sshToolService.getSessionData$(sessionId);
          if (sshData$) {
            const output = await _outputBuffers.drainBuffer(sessionId, sshData$, timeoutMs);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ sessionId, output, length: output.length, status: sshStatus }, null, 2),
              }],
            };
          }
        }

        // Try PTY session
        if (ptySessionService) {
          const ptySession = ptySessionService.getSession(sessionId);
          if (ptySession) {
            const output = await _outputBuffers.drainBuffer(sessionId, ptySession.data$, timeoutMs);

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ sessionId, output, length: output.length, status: ptySession.status }, null, 2),
              }],
            };
          }
        }

        return createErrorResult(`Session "${sessionId}" not found.`);
      } catch (err) {
        logService.error('[TerminalTools]', 'get_output failed:', err);
        return createErrorResult(`Failed to get output: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createCloseSessionTool(
  sshToolService: ISSHToolService,
  logService: ILogService,
  ptySessionService?: IPTYSessionService
): IAgentTool {
  return {
    name: 'termlnk_terminal_close_session',
    label: 'Close Terminal Session',
    category: 'terminal',
    description: 'Close an active terminal session (SSH or local PTY) and its associated terminal tab. After closing, the sessionId becomes invalid.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the terminal session to close.',
        },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      try {
        const sessionId = args.sessionId as string;

        if (!sessionId) {
          return createErrorResult('sessionId is required.');
        }

        // Try SSH session first
        const sshStatus = sshToolService.getSessionStatus(sessionId);
        if (sshStatus !== null) {
          await sshToolService.closeSession(sessionId);
          _outputBuffers.removeBuffer(sessionId);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, sessionId, type: 'ssh' }, null, 2),
            }],
          };
        }

        // Try PTY session
        if (ptySessionService) {
          const ptySession = ptySessionService.getSession(sessionId);
          if (ptySession) {
            await ptySessionService.closeSession(sessionId);
            _outputBuffers.removeBuffer(sessionId);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, sessionId, type: 'local' }, null, 2),
              }],
            };
          }
        }

        return createErrorResult(`Session "${sessionId}" not found.`);
      } catch (err) {
        logService.error('[TerminalTools]', 'close_session failed:', err);
        return createErrorResult(`Failed to close session: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createRunTool(
  commandBlockService: ICommandBlockService,
  sshToolService: ISSHToolService,
  logService: ILogService,
  ptySessionService?: IPTYSessionService,
  permissionService?: ICommandPermissionService
): IAgentTool {
  return {
    name: 'termlnk_terminal_run',
    label: 'Run Terminal Command',
    category: 'terminal',
    description: 'PRIMARY command-execution tool. Writes a command to the terminal session, waits for it to finish, and returns a structured result — exit code, ANSI-stripped output, cwd, duration, blockId — in one call. Prefer this over termlnk_terminal_execute + termlnk_terminal_get_output: it uses shell integration (OSC 633) to detect precise command boundaries and typically uses ~10x fewer tokens. For streaming commands that should keep running (tail -f, watch, long builds), set waitForExit=false to get a blockId immediately and poll with termlnk_terminal_poll_block. If output exceeds outputPreviewLines, the result is truncated — do NOT re-run the command; use termlnk_terminal_read_block with a lineRange to fetch more, or re-run with grep/head/tail piped. SAFETY: For destructive commands (rm -rf, dd, mkfs, DROP TABLE, shutdown, git push --force), warn the user and get explicit confirmation before calling.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the terminal session to run the command in.',
        },
        command: {
          type: 'string',
          description: 'The command to execute. Do NOT include a trailing newline or carriage return — it is added automatically.',
        },
        timeoutMs: {
          type: 'number',
          description: 'Max time to wait for the command to finish. Default 15000 (15s). Max 120000. On timeout the tool returns the partial output and a blockId for polling.',
          default: 15000,
        },
        outputPreviewLines: {
          type: 'number',
          description: 'Max lines of output to return inline. Default 200. Output beyond this is truncated; use termlnk_terminal_read_block to fetch more.',
          default: 200,
        },
        waitForExit: {
          type: 'boolean',
          description: 'If false, return as soon as the command starts executing (with its blockId) without waiting for completion. Use for streaming / long-running commands. Default true.',
          default: true,
        },
      },
      required: ['sessionId', 'command'],
    },
    handler: async (args) => {
      try {
        const sessionId = args.sessionId as string;
        const command = args.command as string;
        const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 15000, 1000), 120000);
        const outputPreviewLines = Math.min(Math.max(Number(args.outputPreviewLines) || 200, 1), 10000);
        const waitForExit = args.waitForExit !== false;

        if (!sessionId || !command) {
          return createErrorResult('Both sessionId and command are required.');
        }

        const denial = await checkCommandPermission(permissionService, sshToolService, sessionId, command);
        if (denial) {
          return denial;
        }

        if (!commandBlockService.isAttached(sessionId)) {
          const sshData$ = sshToolService.getSessionData$(sessionId);
          if (sshData$) {
            commandBlockService.attachSession(sessionId, sshData$);
          }
        }

        // Arm the heuristic output buffer in parallel so that if shell
        // integration is inactive for this session we can still return a
        // best-effort, ANSI-stripped snapshot on timeout.
        const heuristicData$ = resolveHeuristicDataStream(sessionId, sshToolService, ptySessionService);
        if (heuristicData$) {
          _outputBuffers.ensureBuffering(sessionId, heuristicData$);
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
          return createErrorResult(writeResult.error);
        }

        if (!waitForExit && startedPromise) {
          try {
            const blockId = await startedPromise;
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'running',
                  blockId,
                  sessionId,
                  command,
                  hint: `Command started in background. Use termlnk_terminal_poll_block with blockId=${blockId} to read incremental output, or termlnk_terminal_read_block after it finishes.`,
                }, null, 2),
              }],
            };
          } catch {
            return createErrorResult('Command did not emit an OSC 633;C start event within 5s. Shell integration may not be active for this session; use termlnk_terminal_execute + termlnk_terminal_get_output as a fallback.');
          }
        }

        try {
          const block = await finishedPromise;
          return formatBlockResult(block, outputPreviewLines, false);
        } catch {
          const pending = commandBlockService.getPendingSnapshot(sessionId);
          if (pending) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'timeout',
                  blockId: pending.blockId,
                  sessionId,
                  command: pending.command,
                  output: truncateToLines(pending.output, outputPreviewLines).text,
                  outputTotalBytes: pending.outputTotalBytes,
                  outputTruncated: true,
                  hint: `Command has not finished after ${timeoutMs}ms. Use termlnk_terminal_poll_block with blockId=${pending.blockId} to continue reading, or send Ctrl-C via termlnk_terminal_execute (command="\\u0003") to interrupt.`,
                }, null, 2),
              }],
            };
          }

          // Heuristic fallback: shell integration is not active for this
          // session. Drain the parallel byte buffer, strip ANSI, return a
          // best-effort result with shellIntegrated=false.
          if (heuristicData$) {
            const rawOutput = await _outputBuffers.drainBuffer(sessionId, heuristicData$, 0);
            const clean = stripAnsi(rawOutput).replace(commandEchoPattern(command), '');
            const truncated = truncateToLines(clean.trimStart(), outputPreviewLines);
            const osc633Events = commandBlockService.getOsc633EventCount(sessionId);
            const shellIntegrationActive = osc633Events > 0;
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
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
                    : 'No OSC 633 events were observed for this session — shell integration injection likely did not take effect (unsupported shell, overridden PS1, or script not sourced). Returned a best-effort snapshot; you can also use termlnk_terminal_execute + termlnk_terminal_get_output for this session.',
                }, null, 2),
              }],
            };
          }

          return createErrorResult(`Command did not complete within ${timeoutMs}ms and no pending block was tracked. Shell integration may not be active for this session, and no fallback data stream is available.`);
        }
      } catch (err) {
        logService.error('[TerminalTools]', 'run failed:', err);
        return createErrorResult(`Failed to run command: ${err instanceof Error ? err.message : String(err)}`);
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
    description: 'List recent completed command blocks for a session. Returns metadata only (command, exitCode, durationMs, cwd, seq) plus a short outputPreview (first line). Use this to review a session\'s history without pulling full outputs. To fetch a full block output, call termlnk_terminal_read_block with a blockId or seq from this result.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The terminal session ID.',
        },
        limit: {
          type: 'number',
          description: 'Max number of blocks to return, newest last. Default 20.',
          default: 20,
        },
        sinceSeq: {
          type: 'number',
          description: 'Only return blocks with seq strictly greater than this value.',
        },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      try {
        const sessionId = args.sessionId as string;
        const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 200);
        const sinceSeq = typeof args.sinceSeq === 'number' ? args.sinceSeq : null;

        if (!sessionId) {
          return createErrorResult('sessionId is required.');
        }

        if (!commandBlockService.isAttached(sessionId)) {
          return createErrorResult(`Session "${sessionId}" has no command block tracker attached. Run a command with termlnk_terminal_run first, or ensure shell integration is active.`);
        }

        let blocks = commandBlockService.getBlocks(sessionId);
        if (sinceSeq !== null) {
          blocks = blocks.filter((b) => (b.seq ?? 0) > sinceSeq);
        }
        const sliced = blocks.slice(-limit);

        const pending = commandBlockService.getPendingSnapshot(sessionId);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
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
            }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[TerminalTools]', 'list_blocks failed:', err);
        return createErrorResult(`Failed to list blocks: ${err instanceof Error ? err.message : String(err)}`);
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
    description: 'Read the full (or a line range of the) output of a completed command block. Use this after termlnk_terminal_run reports outputTruncated=true, or to revisit an earlier block by seq or blockId. For blocks still running, use termlnk_terminal_poll_block instead.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The terminal session ID.',
        },
        blockId: {
          type: 'string',
          description: 'Block UUID (from a previous tool result). Mutually exclusive with seq and last.',
        },
        seq: {
          type: 'number',
          description: 'Block seq (monotonic within session). Mutually exclusive with blockId and last.',
        },
        last: {
          type: 'number',
          description: 'Read the N-th most recent block (1 = most recent). Mutually exclusive with blockId and seq.',
        },
        lineStart: {
          type: 'number',
          description: 'Optional 1-based start line (inclusive). Default 1.',
        },
        lineEnd: {
          type: 'number',
          description: 'Optional 1-based end line (inclusive). Default = full.',
        },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      try {
        const sessionId = args.sessionId as string;
        if (!sessionId) {
          return createErrorResult('sessionId is required.');
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
          return createErrorResult('No matching command block found for the given selector.');
        }

        const lineStart = typeof args.lineStart === 'number' ? Math.max(1, Math.floor(args.lineStart)) : 1;
        const lineEnd = typeof args.lineEnd === 'number' ? Math.max(lineStart, Math.floor(args.lineEnd)) : undefined;

        const allLines = block.output.split('\n');
        const totalLines = allLines.length;
        const slice = allLines.slice(lineStart - 1, lineEnd ?? totalLines);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
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
            }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[TerminalTools]', 'read_block failed:', err);
        return createErrorResult(`Failed to read block: ${err instanceof Error ? err.message : String(err)}`);
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
    description: 'Poll the output of a running command block. Returns the current output (ANSI-stripped), a running flag, and exitCode (only when the command has finished). Use for long-running / streaming commands started with termlnk_terminal_run waitForExit=false. The tool waits up to maxWaitMs for new output before returning, so it is safe to call in a short poll loop.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The terminal session ID.',
        },
        blockId: {
          type: 'string',
          description: 'The blockId returned by termlnk_terminal_run (or list_blocks / read_block).',
        },
        maxWaitMs: {
          type: 'number',
          description: 'Max time to wait for the block to finish before returning. Default 2000. Max 30000.',
          default: 2000,
        },
        outputPreviewLines: {
          type: 'number',
          description: 'Max lines of output to return inline. Default 200.',
          default: 200,
        },
      },
      required: ['sessionId', 'blockId'],
    },
    handler: async (args) => {
      try {
        const sessionId = args.sessionId as string;
        const blockId = args.blockId as string;
        const maxWaitMs = Math.min(Math.max(Number(args.maxWaitMs) || 2000, 100), 30000);
        const outputPreviewLines = Math.min(Math.max(Number(args.outputPreviewLines) || 200, 1), 10000);

        if (!sessionId || !blockId) {
          return createErrorResult('Both sessionId and blockId are required.');
        }

        const finishedBlock = commandBlockService.getBlockById(sessionId, blockId);
        if (finishedBlock) {
          return formatBlockResult(finishedBlock, outputPreviewLines, true);
        }

        const pending = commandBlockService.getPendingSnapshot(sessionId);
        if (!pending || pending.blockId !== blockId) {
          return createErrorResult(`Block "${blockId}" not found for session "${sessionId}". It may have been evicted or the sessionId is wrong.`);
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
            return createErrorResult(`Block "${blockId}" is no longer being tracked. It may have been aborted.`);
          }
          const truncated = truncateToLines(latest.output, outputPreviewLines);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'running',
                sessionId,
                blockId: latest.blockId,
                command: latest.command,
                output: truncated.text,
                outputTotalBytes: latest.outputTotalBytes,
                outputTruncated: truncated.truncated,
                isRunning: true,
              }, null, 2),
            }],
          };
        }
      } catch (err) {
        logService.error('[TerminalTools]', 'poll_block failed:', err);
        return createErrorResult(`Failed to poll block: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

async function checkCommandPermission(
  permissionService: ICommandPermissionService | undefined,
  sshToolService: ISSHToolService,
  sessionId: string,
  command: string
): Promise<IAgentToolResult | null> {
  if (!permissionService) {
    return null;
  }
  const sessionType = sshToolService.getSessionStatus(sessionId) !== null ? 'ssh' as const : 'local' as const;
  const evaluation = permissionService.evaluateCommand(sessionId, command, sessionType);
  if (evaluation.requiresApproval) {
    const decision = await permissionService.requestApproval({
      sessionId,
      command,
      riskLevel: evaluation.riskLevel,
      reason: evaluation.reason ?? '',
      suggestedAlternative: evaluation.suggestedAlternative,
    });
    if (decision === 'deny') {
      return createErrorResult(`Command denied by user: ${evaluation.reason}`);
    }
  }
  if (!evaluation.allowed && !evaluation.requiresApproval) {
    return createErrorResult(`Command blocked: ${evaluation.reason}`);
  }
  return null;
}

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
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
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
      }, null, 2),
    }],
  };
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

function createErrorResult(message: string): IAgentToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
