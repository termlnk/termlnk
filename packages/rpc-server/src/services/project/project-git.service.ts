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
  IGitBranch,
  IGitCommit,
  IGitDiffOptions,
  IGitLogOptions,
  IGitStatus,
  IProjectContext,
  IProjectGitService,
} from '@termlnk/project';
import type { ISSHExecResult } from '@termlnk/rpc';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Disposable, ILogService } from '@termlnk/core';
import {
  branchesCommand,
  buildRemoteGitCommand,
  commitCommand,
  diffCommand,
  logCommand,
  parseBranches,
  parseLog,
  parseStatus,
  stageCommand,
  statusCommand,
  unstageCommand,
} from '@termlnk/project';
import { ISSHSessionService } from '@termlnk/rpc';

const execFileAsync = promisify(execFile);

/**
 * Git operations for project panels.
 * Local: child_process. Remote: one-shot exec on an open SSH session's socket.
 */
export class ProjectGitService extends Disposable implements IProjectGitService {
  constructor(
    @ILogService private readonly _logService: ILogService,
    @ISSHSessionService private readonly _sshSessions: ISSHSessionService
  ) {
    super();
  }

  async status(context: IProjectContext): Promise<IGitStatus> {
    const { stdout } = await this._exec(context, statusCommand());
    return parseStatus(stdout);
  }

  async log(context: IProjectContext, options: IGitLogOptions = {}): Promise<IGitCommit[]> {
    const { stdout } = await this._exec(
      context,
      logCommand(options.limit ?? 50, options.skip ?? 0)
    );
    return parseLog(stdout);
  }

  async diff(context: IProjectContext, options: IGitDiffOptions = {}): Promise<string> {
    const { stdout } = await this._exec(context, diffCommand(options));
    return stdout;
  }

  async branches(context: IProjectContext): Promise<IGitBranch[]> {
    const { stdout } = await this._exec(context, branchesCommand());
    return parseBranches(stdout);
  }

  async stage(context: IProjectContext, paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    await this._exec(context, stageCommand(paths));
  }

  async unstage(context: IProjectContext, paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    await this._exec(context, unstageCommand(paths));
  }

  async commit(context: IProjectContext, message: string): Promise<void> {
    await this._exec(context, commitCommand(message));
  }

  private async _exec(context: IProjectContext, argv: string[]): Promise<ISSHExecResult> {
    if (context.scope === 'remote') {
      return this._execRemote(context, argv);
    }
    return this._execLocal(context.rootPath || context.cwd, argv);
  }

  private async _execLocal(cwd: string, argv: string[]): Promise<ISSHExecResult> {
    try {
      const { stdout, stderr } = await execFileAsync('git', argv, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      });
      return { stdout: stdout ?? '', stderr: stderr ?? '', code: 0 };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: number };
      if (typeof e.stdout === 'string' || typeof e.stderr === 'string') {
        return {
          stdout: e.stdout ?? '',
          stderr: e.stderr ?? '',
          code: typeof e.code === 'number' ? e.code : 1,
        };
      }
      this._logService.warn('[ProjectGit] local exec failed', err);
      throw err;
    }
  }

  private async _execRemote(context: IProjectContext, argv: string[]): Promise<ISSHExecResult> {
    if (!context.hostId) {
      throw new Error('Remote git context requires hostId');
    }

    const sessionId = this._sshSessions.findSessionIdByHostId(context.hostId);
    if (!sessionId) {
      throw new Error(
        'No open SSH session for this host. Connect a terminal to the host first.'
      );
    }

    const command = buildRemoteGitCommand(context.rootPath || context.cwd, argv);
    return this._sshSessions.execCommand(sessionId, command);
  }
}
