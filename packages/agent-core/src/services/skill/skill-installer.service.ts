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

import type { IAddSkillRepositoryInput, ISkillInstallerService, ISkillRepository, IUpdateSkillRepositoryInput } from '@termlnk/agent';
import type { IAgentCorePluginConfig } from '../../controllers/config.schema';
import type { IProxyConfig } from './skill-repository.utils';
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_PLUGIN_CONFIG_KEY, SKILL_CONFIG_KEY, SKILL_USER_DIR } from '@termlnk/agent';
import { Disposable, IConfigService, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository, SkillRepository } from '@termlnk/database';
import { resolveConfigPath } from '@termlnk/rpc';
import { buildProxyEnvVars, buildSkillRepositoryLocalPath, cloneGitHubRepository, getSkillRepositoryScanRoot, isSkillPathManagedByRepository, normalizeGitHubRepositoryInput } from './skill-repository.utils';

export class SkillInstallerService extends Disposable implements ISkillInstallerService {
  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @Inject(SkillRepository) private readonly _skillRepository: SkillRepository,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository
  ) {
    super();
  }

  async getRepositories(): Promise<ISkillRepository[]> {
    const repositories = await this._configRepository.getField<ISkillRepository[]>(AGENT_PLUGIN_CONFIG_KEY, 'skillRepositories');
    return Array.isArray(repositories) ? repositories : [];
  }

  async addRepository(input: IAddSkillRepositoryInput): Promise<ISkillRepository> {
    const normalized = normalizeGitHubRepositoryInput(input);
    const repositories = await this.getRepositories();

    if (repositories.some((repository) => repository.id === normalized.id)) {
      throw new Error(`Skill repository already exists: ${normalized.displayName}`);
    }

    const repository: ISkillRepository = {
      ...normalized,
      localPath: buildSkillRepositoryLocalPath(resolveConfigPath(this._configService), normalized.id),
      addedAt: new Date().toISOString(),
    };

    if (existsSync(repository.localPath)) {
      rmSync(repository.localPath, { recursive: true, force: true });
    }

    try {
      const proxyEnv = await this._getProxyEnvVars();
      await cloneGitHubRepository(resolveConfigPath(this._configService), repository, proxyEnv);

      const scanRoot = getSkillRepositoryScanRoot(repository);
      if (!existsSync(scanRoot)) {
        throw new Error(`Skill path not found in repository: ${repository.subdirectory}`);
      }
    } catch (error) {
      if (existsSync(repository.localPath)) {
        rmSync(repository.localPath, { recursive: true, force: true });
      }

      throw error;
    }

    await this._configRepository.setField(AGENT_PLUGIN_CONFIG_KEY, 'skillRepositories', [...repositories, repository]);
    this._logService.log(`[SkillInstaller] Added skill repository: ${repository.displayName}`);
    return repository;
  }

  async updateRepository(input: IUpdateSkillRepositoryInput): Promise<ISkillRepository> {
    const repositories = await this.getRepositories();
    const currentRepository = repositories.find((item) => item.id === input.id);
    if (!currentRepository) {
      throw new Error(`Skill repository not found: ${input.id}`);
    }

    const normalized = normalizeGitHubRepositoryInput(input);
    if (repositories.some((repository) => repository.id === normalized.id && repository.id !== input.id)) {
      throw new Error(`Skill repository already exists: ${normalized.displayName}`);
    }

    const nextRepository: ISkillRepository = {
      ...normalized,
      localPath: buildSkillRepositoryLocalPath(resolveConfigPath(this._configService), normalized.id),
      addedAt: currentRepository.addedAt,
    };

    const stagingRepository: ISkillRepository = {
      ...nextRepository,
      localPath: `${nextRepository.localPath}__staging__${Date.now()}`,
    };

    if (existsSync(stagingRepository.localPath)) {
      rmSync(stagingRepository.localPath, { recursive: true, force: true });
    }

    try {
      const proxyEnv = await this._getProxyEnvVars();
      await cloneGitHubRepository(resolveConfigPath(this._configService), stagingRepository, proxyEnv);

      const scanRoot = getSkillRepositoryScanRoot(stagingRepository);
      if (!existsSync(scanRoot)) {
        throw new Error(`Skill path not found in repository: ${nextRepository.subdirectory}`);
      }

      if (existsSync(nextRepository.localPath)) {
        rmSync(nextRepository.localPath, { recursive: true, force: true });
      }

      renameSync(stagingRepository.localPath, nextRepository.localPath);
    } catch (error) {
      if (existsSync(stagingRepository.localPath)) {
        rmSync(stagingRepository.localPath, { recursive: true, force: true });
      }

      throw error;
    }

    if (currentRepository.localPath !== nextRepository.localPath && existsSync(currentRepository.localPath)) {
      rmSync(currentRepository.localPath, { recursive: true, force: true });
    }

    await this._configRepository.setField(
      AGENT_PLUGIN_CONFIG_KEY,
      'skillRepositories',
      repositories.map((repository) => (repository.id === input.id ? nextRepository : repository))
    );

    this._logService.log(`[SkillInstaller] Updated skill repository: ${currentRepository.displayName} -> ${nextRepository.displayName}`);
    return nextRepository;
  }

  async removeRepository(id: string): Promise<void> {
    const repositories = await this.getRepositories();
    const repository = repositories.find((item) => item.id === id);
    if (!repository) {
      throw new Error(`Skill repository not found: ${id}`);
    }

    if (existsSync(repository.localPath)) {
      rmSync(repository.localPath, { recursive: true, force: true });
    }

    await this._configRepository.setField(
      AGENT_PLUGIN_CONFIG_KEY,
      'skillRepositories',
      repositories.filter((item) => item.id !== id)
    );

    this._logService.log(`[SkillInstaller] Removed skill repository: ${repository.displayName}`);
  }

  private async _getProxyEnvVars(): Promise<Record<string, string> | undefined> {
    const proxy = await this._configRepository.getField<IProxyConfig>('network.config', 'proxy');
    if (!proxy?.enabled) {
      return;
    }
    return buildProxyEnvVars(proxy);
  }

  private _getInstallDir(): string {
    const config = this._configService.getConfig<IAgentCorePluginConfig>(SKILL_CONFIG_KEY);
    return config?.userSkillsDir ?? join(resolveConfigPath(this._configService), SKILL_USER_DIR);
  }

  async installFromPath(sourcePath: string): Promise<string> {
    const installDir = this._getInstallDir();
    mkdirSync(installDir, { recursive: true });

    const name = sourcePath.split('/').pop()!;
    const destDir = join(installDir, name);

    if (existsSync(destDir)) {
      rmSync(destDir, { recursive: true, force: true });
    }

    cpSync(sourcePath, destDir, { recursive: true });
    this._logService.log(`[SkillInstaller] Installed skill from path: ${sourcePath}`);

    return name;
  }

  async uninstall(id: string): Promise<void> {
    const skill = await this._skillRepository.getById(id);
    if (!skill) {
      throw new Error(`Skill not found: ${id}`);
    }

    const repositories = await this.getRepositories();
    if (isSkillPathManagedByRepository(skill.path, repositories)) {
      throw new Error('Repository-managed skills must be removed from the repository list');
    }

    if (skill.source === 'builtin') {
      throw new Error('Cannot uninstall builtin skills');
    }

    if (existsSync(skill.path)) {
      rmSync(skill.path, { recursive: true, force: true });
    }

    await this._skillRepository.delete(id);
    this._logService.log(`[SkillInstaller] Uninstalled skill: ${skill.name}`);
  }
}
