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

import type { IAddSkillRepositoryInput, ISkillRepository } from '@termlnk/agent';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { SKILL_REPOSITORY_CLONE_DIR } from '@termlnk/agent';

const GITHUB_HOST = 'github.com';

export function getSkillRepositoryRootDir(configPath: string): string {
  return join(configPath, SKILL_REPOSITORY_CLONE_DIR);
}

export function getSkillRepositoryDirectoryName(id: string): string {
  return id
    .replace(/^github:/, 'github__')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildSkillRepositoryLocalPath(configPath: string, id: string): string {
  return join(getSkillRepositoryRootDir(configPath), getSkillRepositoryDirectoryName(id));
}

export function normalizeGitHubRepositoryInput(input: IAddSkillRepositoryInput): Omit<ISkillRepository, 'addedAt' | 'localPath'> {
  const rawRepository = input.repository.trim();
  if (!rawRepository) {
    throw new Error('GitHub repository is required');
  }

  let owner = '';
  let repo = '';
  let branchFromUrl: string | undefined;
  let subdirectoryFromUrl: string | undefined;

  if (/^https?:\/\//i.test(rawRepository)) {
    const parsed = new URL(rawRepository);
    if (parsed.hostname !== GITHUB_HOST && parsed.hostname !== `www.${GITHUB_HOST}`) {
      throw new Error('Only github.com repositories are supported');
    }

    const segments = parsed.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
    if (segments.length < 2) {
      throw new Error('Invalid GitHub repository URL');
    }

    [owner, repo] = segments;

    if ((segments[2] === 'tree' || segments[2] === 'blob') && segments[3]) {
      branchFromUrl = segments[3].trim();
      const remaining = segments.slice(4);
      if (segments[2] === 'blob' && remaining.length > 0) {
        subdirectoryFromUrl = remaining.slice(0, -1).join('/');
      } else {
        subdirectoryFromUrl = remaining.join('/');
      }
    } else if (segments.length > 2) {
      subdirectoryFromUrl = segments.slice(2).join('/');
    }

    if (!branchFromUrl) {
      branchFromUrl = parseBranchFromUrl(parsed);
    }
  } else {
    const [repoPart, hashPart = ''] = rawRepository.split('#', 2);
    const segments = repoPart.split('/').filter(Boolean);
    if (segments.length !== 2) {
      throw new Error('Use owner/repo or a full GitHub URL');
    }

    [owner, repo] = segments;
    branchFromUrl = hashPart.trim();
  }

  repo = repo.replace(/\.git$/i, '');
  if (!owner || !repo) {
    throw new Error('Invalid GitHub repository');
  }

  const branch = normalizeOptionalText(input.branch) ?? normalizeOptionalText(branchFromUrl);
  const subdirectory = normalizeSubdirectory(input.subdirectory ?? subdirectoryFromUrl);
  const url = `https://${GITHUB_HOST}/${owner}/${repo}`;
  const displayName = [
    `${owner}/${repo}`,
    branch ? `#${branch}` : '',
    subdirectory ? `/${subdirectory}` : '',
  ].join('');
  const id = [
    `github:${owner}/${repo}`,
    branch ? `#${branch}` : '',
    subdirectory ? `:${subdirectory}` : '',
  ].join('');

  return {
    id,
    provider: 'github',
    owner,
    repo,
    branch,
    subdirectory,
    url,
    cloneUrl: `${url}.git`,
    displayName,
  };
}

export async function cloneGitHubRepository(configPath: string, repository: ISkillRepository, env?: Record<string, string>): Promise<void> {
  mkdirSync(getSkillRepositoryRootDir(configPath), { recursive: true });

  const branchCandidates = repository.branch
    ? uniqueValues([repository.branch, 'main', 'master'])
    : [undefined];

  let lastError: unknown = null;

  for (const branch of branchCandidates) {
    if (existsSync(repository.localPath)) {
      rmSync(repository.localPath, { recursive: true, force: true });
    }

    try {
      if (repository.subdirectory) {
        await runGitCommand(configPath, [
          'clone',
          '--depth',
          '1',
          '--filter=blob:none',
          '--sparse',
          ...(branch ? ['--branch', branch] : []),
          repository.cloneUrl,
          repository.localPath,
        ], undefined, env);
        await runGitCommand(configPath, ['sparse-checkout', 'set', '--no-cone', repository.subdirectory], repository.localPath, env);
      } else {
        await runGitCommand(configPath, [
          'clone',
          '--depth',
          '1',
          ...(branch ? ['--branch', branch] : []),
          repository.cloneUrl,
          repository.localPath,
        ], undefined, env);
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to clone GitHub repository');
}

export async function runGitCommand(configPath: string, args: string[], cwd?: string, env?: Record<string, string>): Promise<void> {
  mkdirSync(getSkillRepositoryRootDir(configPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : undefined,
    });

    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `git exited with code ${code ?? 'unknown'}`));
    });
  });
}

export function getSkillRepositoryScanRoot(repository: ISkillRepository): string {
  return repository.subdirectory ? join(repository.localPath, repository.subdirectory) : repository.localPath;
}

export function createRepositoryDiscoveryKey(repository: ISkillRepository, skillDirectory: string): string {
  const relativeDirectory = normalizeRelativePath(relative(repository.localPath, skillDirectory));
  return `${repository.id}:${relativeDirectory || repository.repo}`;
}

export function isSkillPathManagedByRepository(skillPath: string, repositories: ISkillRepository[]): boolean {
  return repositories.some((repository) => isPathInRepository(skillPath, repository.localPath));
}

export function isPathInRepository(targetPath: string, repositoryPath: string): boolean {
  const normalizedTarget = normalizePath(targetPath);
  const normalizedRepository = normalizePath(repositoryPath);

  return normalizedTarget === normalizedRepository || normalizedTarget.startsWith(`${normalizedRepository}/`);
}

export interface IProxyConfig {
  enabled: boolean;
  type: 'socks5' | 'http';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export function buildProxyEnvVars(proxy: IProxyConfig): Record<string, string> {
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password ?? '')}@`
    : '';

  if (proxy.type === 'socks5') {
    const url = `socks5://${auth}${proxy.host}:${proxy.port}`;
    return { ALL_PROXY: url };
  }

  const url = `http://${auth}${proxy.host}:${proxy.port}`;
  return { HTTP_PROXY: url, HTTPS_PROXY: url };
}

function parseBranchFromUrl(url: URL): string | undefined {
  const fragment = normalizeOptionalText(url.hash ? decodeURIComponent(url.hash.slice(1)) : '');
  if (fragment) {
    return fragment;
  }

  const branch = normalizeOptionalText(url.searchParams.get('branch') ?? url.searchParams.get('ref') ?? '');
  return branch;
}

function normalizeOptionalText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeSubdirectory(value?: string | null): string | undefined {
  const normalized = normalizeOptionalText(value)?.replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return undefined;
  }

  const safeSegments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== '.' && segment !== '..');

  return safeSegments.length > 0 ? safeSegments.join('/') : undefined;
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/g, '');
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}
