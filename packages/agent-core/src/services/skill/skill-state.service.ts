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

import type { IDiscoveredSkill, ISkill, ISkillState, ISkillStateService } from '@termlnk/agent';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ISkillDiscoveryService } from '@termlnk/agent';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { SkillRepository } from '@termlnk/database';
import { BehaviorSubject, map } from 'rxjs';

export class SkillStateService extends Disposable implements ISkillStateService {
  private readonly _state$ = new BehaviorSubject<ISkillState>({
    skills: [],
    totalCount: 0,
    enabledCount: 0,
  });

  readonly state$ = this._state$.asObservable();
  readonly skills$ = this._state$.pipe(map((s) => s.skills));

  private readonly _discoveredByKey = new Map<string, IDiscoveredSkill>();
  private readonly _discoveredByPath = new Map<string, IDiscoveredSkill>();
  private _refreshPromise: Promise<void> | null = null;

  constructor(
    @Inject(SkillRepository) private readonly _skillRepository: SkillRepository,
    @ISkillDiscoveryService private readonly _discoveryService: ISkillDiscoveryService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async refresh(): Promise<void> {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    this._refreshPromise = this._doRefresh();

    try {
      await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<void> {
    try {
      const discovered = await this._discoveryService.discover();
      this._discoveredByKey.clear();
      this._discoveredByPath.clear();
      for (const skill of discovered) {
        this._discoveredByKey.set(skill.discoveryKey, skill);
        this._discoveredByPath.set(skill.path, skill);
      }

      const dbSkills = await this._skillRepository.getAll();
      const dbByRegistryId = new Map(dbSkills.filter((skill) => skill.registryId).map((skill) => [skill.registryId as string, skill]));
      const dbByPath = new Map(dbSkills.map((skill) => [skill.path, skill]));

      for (const disc of discovered) {
        const existing = dbByRegistryId.get(disc.discoveryKey) ?? dbByPath.get(disc.path);
        if (!existing) {
          await this._skillRepository.create({
            name: disc.name,
            path: disc.path,
            source: disc.source,
            registryId: disc.discoveryKey,
            checksum: disc.checksum,
            enabled: true,
            sortOrder: 0,
          });
          continue;
        }

        const needsUpdate = existing.checksum !== disc.checksum
          || existing.path !== disc.path
          || existing.source !== disc.source
          || existing.registryId !== disc.discoveryKey
          || existing.name !== disc.name;

        if (needsUpdate) {
          await this._skillRepository.update(existing.id, {
            name: disc.name,
            path: disc.path,
            source: disc.source,
            registryId: disc.discoveryKey,
            checksum: disc.checksum,
          });
        }
      }

      const discoveredKeys = new Set(discovered.map((skill) => skill.discoveryKey));
      for (const dbSkill of dbSkills) {
        const currentKey = dbSkill.registryId ?? this._discoveredByPath.get(dbSkill.path)?.discoveryKey;
        if (!currentKey || !discoveredKeys.has(currentKey)) {
          await this._skillRepository.delete(dbSkill.id);
        }
      }

      await this._emitStateFromRepository();
    } catch (err) {
      this._logService.error(`[SkillState] Failed to refresh: ${err}`);
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this._skillRepository.updateEnabled(id, enabled);
    await this._emitStateFromRepository();
  }

  async setSortOrder(id: string, sortOrder: number): Promise<void> {
    await this._skillRepository.updateSortOrder(id, sortOrder);
    await this._emitStateFromRepository();
  }

  private async _emitStateFromRepository(): Promise<void> {
    const allSkills = await this._skillRepository.getAll();
    const skills: ISkill[] = allSkills.map((entity) => {
      const disc = (entity.registryId ? this._discoveredByKey.get(entity.registryId) : undefined) ?? this._discoveredByPath.get(entity.path);
      return {
        id: entity.id,
        name: entity.name,
        description: disc?.frontmatter.description ?? '',
        path: entity.path,
        source: entity.source,
        version: disc?.frontmatter.version ?? entity.version ?? undefined,
        author: disc?.frontmatter.author ?? undefined,
        tags: disc?.frontmatter.tags ?? [],
        allowedTools: disc?.frontmatter['allowed-tools'] ?? [],
        alwaysInject: disc?.frontmatter['always-inject'] ?? false,
        enabled: entity.enabled,
        sortOrder: entity.sortOrder,
        checksum: entity.checksum ?? undefined,
      };
    });

    this._state$.next({
      skills,
      totalCount: skills.length,
      enabledCount: skills.filter((s) => s.enabled).length,
    });
  }

  async getSkillContent(id: string): Promise<string> {
    const skill = await this._skillRepository.getById(id);
    if (!skill) {
      throw new Error(`Skill not found: ${id}`);
    }

    const skillFile = join(skill.path, 'SKILL.md');
    return readFileSync(skillFile, 'utf-8');
  }
}
