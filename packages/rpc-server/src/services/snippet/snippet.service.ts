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

import type { ISSHSessionService } from '@termlnk/rpc';
import type { ISnippet, ISnippetChangeEvent, ISnippetPackage, ISnippetService, ISnippetUpdate, SnippetItem, SnippetTree } from '@termlnk/snippet';
import type { Observable } from 'rxjs';
import type { ISnippetEntity } from '@termlnk/database';
import { Disposable, Inject } from '@termlnk/core';
import { SnippetRepository } from '@termlnk/database';
import { SnippetType } from '@termlnk/snippet';
import { ISSHSessionService as ISSHSessionServiceId } from '@termlnk/rpc';

export class SnippetService extends Disposable implements ISnippetService {
  constructor(
    @Inject(SnippetRepository) private readonly _repo: SnippetRepository,
    @ISSHSessionServiceId private readonly _sshSessionService: ISSHSessionService
  ) {
    super();
  }

  async getAll(): Promise<ISnippet[]> {
    const entities = await this._repo.getAllSnippets();
    return entities.map(toSnippet);
  }

  async getById(id: string): Promise<ISnippet | undefined> {
    const entity = await this._repo.getSnippetById(id);
    if (!entity || entity.type !== SnippetType.SNIPPET) {
      return undefined;
    }
    return toSnippet(entity);
  }

  async getItem(id: string): Promise<SnippetItem | undefined> {
    const entity = await this._repo.getItemById(id);
    if (!entity) {
      return undefined;
    }
    return entity.type === SnippetType.PACKAGE ? toPackage(entity) : toSnippet(entity);
  }

  async getChildrenList(pid: string): Promise<SnippetItem[]> {
    const entities = await this._repo.getByPid(pid);
    return entities.map((e) => e.type === SnippetType.PACKAGE ? toPackage(e) : toSnippet(e));
  }

  async create(snippet: Omit<ISnippet, 'id' | 'type'>): Promise<string> {
    return this._repo.createSnippet({
      label: snippet.label,
      pid: snippet.pid,
      content: snippet.content,
      description: snippet.description ?? null,
      targetHostIds: snippet.targetHostIds ?? null,
      sort: snippet.sort,
      favorite: snippet.favorite,
    });
  }

  async update(id: string, updates: ISnippetUpdate): Promise<void> {
    await this._repo.updateSnippet(id, updates);
  }

  async delete(id: string): Promise<void> {
    await this._repo.deleteSnippet(id);
  }

  async getAllPackages(): Promise<ISnippetPackage[]> {
    const entities = await this._repo.getAllPackages();
    return entities.map(toPackage);
  }

  async getPackageById(id: string): Promise<ISnippetPackage | undefined> {
    const entity = await this._repo.getPackageById(id);
    return entity ? toPackage(entity) : undefined;
  }

  async createPackage(pkg: Pick<ISnippetPackage, 'label' | 'pid'> & { sort?: number }): Promise<string> {
    return this._repo.createPackage({
      label: pkg.label,
      pid: pkg.pid,
      sort: pkg.sort,
    });
  }

  async updatePackage(id: string, updates: Partial<Omit<ISnippetPackage, 'id' | 'type'>>): Promise<void> {
    await this._repo.updatePackage(id, updates);
  }

  async deletePackage(id: string): Promise<void> {
    await this._repo.deletePackage(id);
  }

  async getExpandedPackageIds(): Promise<string[]> {
    return this._repo.getExpandedPackageIds();
  }

  async setExpandedPackageIds(ids: string[]): Promise<void> {
    await this._repo.setExpandedPackageIds(ids);
  }

  async getTree(): Promise<SnippetTree[]> {
    return this._repo.getTree();
  }

  async move(id: string, targetPid: string, targetSort: number): Promise<void> {
    await this._repo.move(id, targetPid, targetSort);
  }

  async paste(sessionId: string, content: string): Promise<void> {
    await this._sshSessionService.write(sessionId, content);
  }

  async run(sessionId: string, content: string): Promise<void> {
    await this._sshSessionService.write(sessionId, `${content}\r`);
  }

  onChanged$(): Observable<ISnippetChangeEvent> {
    return this._repo.changed$;
  }
}

function toSnippet(e: ISnippetEntity): ISnippet {
  return {
    id: e.id,
    pid: e.pid,
    label: e.label,
    type: SnippetType.SNIPPET,
    content: e.content ?? '',
    description: e.description ?? undefined,
    targetHostIds: e.targetHostIds ?? undefined,
    sort: e.sort,
    favorite: e.favorite,
  };
}

function toPackage(e: ISnippetEntity): ISnippetPackage {
  return {
    id: e.id,
    pid: e.pid,
    label: e.label,
    type: SnippetType.PACKAGE,
    sort: e.sort,
    expanded: e.expanded,
  };
}
