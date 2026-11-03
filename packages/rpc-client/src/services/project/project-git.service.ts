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
  IGitFileDiffStat,
  IGitLogOptions,
  IGitStatus,
  IProjectContext,
  IProjectGitService,
} from '@termlnk/project';
import { Disposable } from '@termlnk/core';
import { IRPCClientService } from '../rpc-client.service';

export class ProjectGitService extends Disposable implements IProjectGitService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().project;
  }

  status(context: IProjectContext): Promise<IGitStatus> {
    return this._client.gitStatus.query(context);
  }

  log(context: IProjectContext, options: IGitLogOptions = {}): Promise<IGitCommit[]> {
    return this._client.gitLog.query({
      context,
      limit: options.limit,
      skip: options.skip,
    });
  }

  diff(context: IProjectContext, options: IGitDiffOptions = {}): Promise<string> {
    return this._client.gitDiff.query({
      context,
      path: options.path,
      staged: options.staged,
      commit: options.commit,
    });
  }

  branches(context: IProjectContext): Promise<IGitBranch[]> {
    return this._client.gitBranches.query(context);
  }

  numstat(context: IProjectContext, options: { commit?: string } = {}): Promise<IGitFileDiffStat[]> {
    return this._client.gitNumstat.query({ context, commit: options.commit });
  }

  async checkout(
    context: IProjectContext,
    branch: string,
    options: { remote?: boolean } = {}
  ): Promise<void> {
    await this._client.gitCheckout.mutate({ context, branch, remote: options.remote });
  }

  async stage(context: IProjectContext, paths: string[]): Promise<void> {
    await this._client.gitStage.mutate({ context, paths });
  }

  async unstage(context: IProjectContext, paths: string[]): Promise<void> {
    await this._client.gitUnstage.mutate({ context, paths });
  }

  async commit(context: IProjectContext, message: string): Promise<void> {
    await this._client.gitCommit.mutate({ context, message });
  }
}
