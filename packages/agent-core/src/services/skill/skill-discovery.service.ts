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

import type { IDiscoveredSkill, ISkillDiscoveryService, ISkillRepository, ISkillRepositoryMarketplaceItem, SkillSource } from '@termlnk/agent';
import type { IAgentCorePluginConfig } from '../../controllers/config.schema';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_PLUGIN_CONFIG_KEY, SKILL_CONFIG_KEY, SKILL_USER_DIR } from '@termlnk/agent';
import { Disposable, IConfigService, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { resolveConfigPath } from '@termlnk/rpc';
import { BehaviorSubject } from 'rxjs';
import { parseSkillFrontmatter } from './skill-parser';
import { createRepositoryDiscoveryKey, getSkillRepositoryScanRoot } from './skill-repository.utils';

export class SkillDiscoveryService extends Disposable implements ISkillDiscoveryService {
  private readonly _discovered$ = new BehaviorSubject<IDiscoveredSkill[]>([]);
  readonly discovered$ = this._discovered$.asObservable();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository
  ) {
    super();
  }

  async discover(): Promise<IDiscoveredSkill[]> {
    const all: IDiscoveredSkill[] = [];
    const config = this._configService.getConfig<IAgentCorePluginConfig>(SKILL_CONFIG_KEY);

    if (config?.bundledSkillsDir) {
      all.push(...await this.discoverAt(config.bundledSkillsDir, 'builtin'));
    }

    const userSkillsDir = config?.userSkillsDir ?? join(resolveConfigPath(this._configService), SKILL_USER_DIR);
    all.push(...await this.discoverAt(userSkillsDir, 'user'));

    // De-duplicate by discovery key so same-name skills can coexist across paths
    const deduped = new Map<string, IDiscoveredSkill>();
    for (const skill of all) {
      deduped.set(skill.discoveryKey, skill);
    }

    const result = [...deduped.values()];
    this._discovered$.next(result);
    return result;
  }

  async discoverRepositorySkills(repositoryId?: string): Promise<ISkillRepositoryMarketplaceItem[]> {
    const repositories = await this._configRepository.getField<ISkillRepository[]>(AGENT_PLUGIN_CONFIG_KEY, 'skillRepositories');
    if (!Array.isArray(repositories) || repositories.length === 0) {
      return [];
    }

    const targetRepositories = repositoryId
      ? repositories.filter((repository) => repository.id === repositoryId)
      : repositories;

    const skills: ISkillRepositoryMarketplaceItem[] = [];
    for (const repository of targetRepositories) {
      const repositorySkills = await this.discoverRepository(repository);
      skills.push(...repositorySkills);
    }

    return skills.sort((left, right) => {
      const repositoryCompare = left.repositoryName.localeCompare(right.repositoryName);
      if (repositoryCompare !== 0) {
        return repositoryCompare;
      }

      return left.name.localeCompare(right.name);
    });
  }

  async discoverAt(path: string, source: SkillSource): Promise<IDiscoveredSkill[]> {
    const skills: IDiscoveredSkill[] = [];

    if (!existsSync(path)) {
      return skills;
    }

    try {
      const entries = readdirSync(path);
      for (const entry of entries) {
        const skillDir = join(path, entry);
        if (!statSync(skillDir).isDirectory()) {
          continue;
        }

        const skillFile = join(skillDir, 'SKILL.md');
        if (!existsSync(skillFile)) {
          continue;
        }

        try {
          const content = readFileSync(skillFile, 'utf-8');
          const parsed = parseSkillFrontmatter(content);
          if (!parsed) {
            this._logService.warn(`[SkillDiscovery] Invalid SKILL.md in ${skillDir}: missing frontmatter or required fields`);
            continue;
          }

          // Validate name matches directory name
          if (parsed.frontmatter.name !== entry) {
            this._logService.warn(`[SkillDiscovery] Skill name "${parsed.frontmatter.name}" doesn't match directory "${entry}" in ${skillDir}`);
          }

          const checksum = createHash('md5').update(content).digest('hex');

          // Store path relative to per-source root so DB rows stay portable across devices.
          skills.push({
            discoveryKey: `${source}:${entry}`,
            name: parsed.frontmatter.name,
            path: entry,
            source,
            frontmatter: parsed.frontmatter,
            checksum,
            content: parsed.body,
          });
        } catch (err) {
          this._logService.warn(`[SkillDiscovery] Failed to parse skill in ${skillDir}: ${err}`);
        }
      }
    } catch (err) {
      this._logService.warn(`[SkillDiscovery] Failed to scan directory ${path}: ${err}`);
    }

    return skills;
  }

  private async discoverRepository(repository: ISkillRepository): Promise<ISkillRepositoryMarketplaceItem[]> {
    const scanRoot = getSkillRepositoryScanRoot(repository);
    const skillDirectories = this.findRepositorySkillDirectories(scanRoot);
    const skills: ISkillRepositoryMarketplaceItem[] = [];

    for (const skillDir of skillDirectories) {
      const skillFile = join(skillDir, 'SKILL.md');

      try {
        const content = readFileSync(skillFile, 'utf-8');
        const parsed = parseSkillFrontmatter(content);
        if (!parsed) {
          this._logService.warn(`[SkillDiscovery] Invalid SKILL.md in ${skillDir}: missing frontmatter or required fields`);
          continue;
        }

        skills.push({
          id: createRepositoryDiscoveryKey(repository, skillDir),
          name: parsed.frontmatter.name,
          path: skillDir,
          description: parsed.frontmatter.description,
          version: parsed.frontmatter.version,
          author: parsed.frontmatter.author,
          homepage: parsed.frontmatter.homepage,
          license: parsed.frontmatter.license,
          tags: parsed.frontmatter.tags ?? [],
          allowedTools: parsed.frontmatter['allowed-tools'] ?? [],
          alwaysInject: parsed.frontmatter['always-inject'] ?? false,
          repositoryId: repository.id,
          repositoryName: repository.displayName,
          repositoryUrl: repository.url,
          repositoryBranch: repository.branch,
          repositorySubdirectory: repository.subdirectory,
        });
      } catch (err) {
        this._logService.warn(`[SkillDiscovery] Failed to parse repository skill in ${skillDir}: ${err}`);
      }
    }

    return skills;
  }

  private findRepositorySkillDirectories(rootPath: string): string[] {
    if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
      return [];
    }

    const MAX_SCAN_DEPTH = 5;
    const MAX_SCANNED_DIRECTORIES = 1500;
    const IGNORED_DIRECTORIES = new Set([
      '.git',
      'node_modules',
      'dist',
      'build',
      '.next',
      '.turbo',
      '.cache',
      'coverage',
      'vendor',
      'target',
      'tmp',
      'temp',
      'out',
    ]);
    const ALLOWED_HIDDEN_DIRECTORIES = new Set(['.agents', '.claude']);

    const skillDirectories = new Set<string>();
    const visitedDirectories = new Set<string>();
    const stack: Array<{ path: string; depth: number }> = [{ path: rootPath, depth: 0 }];
    let scannedDirectories = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      const { path: currentPath, depth } = current;
      if (visitedDirectories.has(currentPath)) {
        continue;
      }
      visitedDirectories.add(currentPath);

      scannedDirectories += 1;
      if (scannedDirectories > MAX_SCANNED_DIRECTORIES) {
        this._logService.warn(`[SkillDiscovery] Repository scan limit reached for ${rootPath}; skipping remaining directories`);
        break;
      }

      const skillFile = join(currentPath, 'SKILL.md');
      if (existsSync(skillFile)) {
        skillDirectories.add(currentPath);
        continue;
      }

      if (depth >= MAX_SCAN_DEPTH) {
        continue;
      }

      try {
        const entries = readdirSync(currentPath);
        for (const entry of entries) {
          if (IGNORED_DIRECTORIES.has(entry)) {
            continue;
          }

          if (entry.startsWith('.') && !ALLOWED_HIDDEN_DIRECTORIES.has(entry)) {
            continue;
          }

          const nextPath = join(currentPath, entry);
          let stat;
          try {
            stat = lstatSync(nextPath);
          } catch {
            continue;
          }

          if (stat.isSymbolicLink() || !stat.isDirectory()) {
            continue;
          }

          stack.push({ path: nextPath, depth: depth + 1 });
        }
      } catch (err) {
        this._logService.warn(`[SkillDiscovery] Failed to scan repository directory ${currentPath}: ${err}`);
      }
    }

    return [...skillDirectories];
  }
}
