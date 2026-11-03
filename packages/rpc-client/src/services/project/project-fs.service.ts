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

import type { IProjectContext, IProjectFileEntry, IProjectFsService } from '@termlnk/project';
import { Disposable } from '@termlnk/core';
import { IRPCClientService } from '../rpc-client.service';

export class ProjectFsService extends Disposable implements IProjectFsService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().project;
  }

  list(context: IProjectContext, path: string): Promise<IProjectFileEntry[]> {
    return this._client.list.query({ context, path });
  }

  readFile(context: IProjectContext, path: string): Promise<string> {
    return this._client.readFile.query({ context, path });
  }

  async writeFile(context: IProjectContext, path: string, content: string): Promise<void> {
    await this._client.writeFile.mutate({ context, path, content });
  }

  stat(context: IProjectContext, path: string): Promise<IProjectFileEntry> {
    return this._client.stat.query({ context, path });
  }

  findGitRoot(context: IProjectContext, path: string): Promise<string | null> {
    return this._client.findGitRoot.query({ context, path });
  }
}
