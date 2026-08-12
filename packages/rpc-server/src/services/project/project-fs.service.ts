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
import { Buffer } from 'node:buffer';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { Disposable, ILogService } from '@termlnk/core';
import { ISFTPSessionService } from '../sftp/sftp-session.service';

/** Bound on the upward walk when looking for a repository root. */
const MAX_GIT_ROOT_DEPTH = 64;

/**
 * Local + remote FS for project panels. Remote uses SFTP sessions keyed by hostId.
 */
export class ProjectFsService extends Disposable implements IProjectFsService {
  constructor(
    @ILogService private readonly _logService: ILogService,
    @ISFTPSessionService private readonly _sftp: ISFTPSessionService
  ) {
    super();
  }

  async list(context: IProjectContext, path: string): Promise<IProjectFileEntry[]> {
    if (context.scope === 'local') {
      return this._listLocal(path);
    }
    return this._listRemote(context, path);
  }

  async readFile(context: IProjectContext, path: string): Promise<string> {
    if (context.scope === 'local') {
      return readFile(path, 'utf8');
    }
    const sessionId = await this._ensureRemote(context);
    const buf = await this._sftp.readFile(sessionId, path);
    return buf.toString('utf8');
  }

  async writeFile(context: IProjectContext, path: string, content: string): Promise<void> {
    if (context.scope === 'local') {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf8');
      return;
    }
    const sessionId = await this._ensureRemote(context);
    await this._sftp.writeFile(sessionId, path, Buffer.from(content, 'utf8'));
  }

  async stat(context: IProjectContext, path: string): Promise<IProjectFileEntry> {
    if (context.scope === 'local') {
      const s = await stat(path);
      const name = path.split(sep).filter(Boolean).at(-1) ?? path;
      return {
        name,
        path,
        type: s.isDirectory() ? 'directory' : s.isSymbolicLink() ? 'symlink' : 'file',
        size: s.size,
        modifiedAt: Math.floor(s.mtimeMs),
      };
    }
    const sessionId = await this._ensureRemote(context);
    const s = await this._sftp.stat(sessionId, path);
    const name = path.split('/').filter(Boolean).at(-1) ?? path;
    // mode bit S_IFDIR = 0o040000
    const isDir = (s.mode & 0o170000) === 0o040000;
    return {
      name,
      path,
      type: isDir ? 'directory' : 'file',
      size: s.size,
      modifiedAt: s.mtime ? s.mtime * 1000 : undefined,
    };
  }

  async findGitRoot(context: IProjectContext, path: string): Promise<string | null> {
    return context.scope === 'local'
      ? this._findGitRootLocal(path)
      : this._findGitRootRemote(context, path);
  }

  private async _findGitRootLocal(path: string): Promise<string | null> {
    let current = path;
    for (let i = 0; i < MAX_GIT_ROOT_DEPTH; i += 1) {
      try {
        const gitPath = join(current, '.git');
        const s = await stat(gitPath);
        if (s.isDirectory() || s.isFile()) {
          return current;
        }
      } catch {
        // continue
      }
      const parent = dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
    return null;
  }

  /**
   * Walks up over SFTP rather than shelling out to `git rev-parse`: the caller
   * only needs to know whether a work tree exists, and SFTP is already open for
   * the tree view. Remote paths are always POSIX, so join with '/'.
   */
  private async _findGitRootRemote(
    context: IProjectContext,
    path: string
  ): Promise<string | null> {
    const sessionId = await this._ensureRemote(context);
    let current = normalizePosixDir(path);

    for (let i = 0; i < MAX_GIT_ROOT_DEPTH; i += 1) {
      try {
        await this._sftp.stat(sessionId, `${current === '/' ? '' : current}/.git`);
        return current;
      } catch {
        // continue
      }
      const parent = current.slice(0, current.lastIndexOf('/')) || '/';
      if (parent === current) {
        break;
      }
      current = parent;
    }
    return null;
  }

  private async _listLocal(dir: string): Promise<IProjectFileEntry[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const results: IProjectFileEntry[] = [];
    for (const entry of entries) {
      const full = join(dir, entry.name);
      let size: number | undefined;
      let modifiedAt: number | undefined;
      try {
        const s = await stat(full);
        size = s.size;
        modifiedAt = Math.floor(s.mtimeMs);
      } catch {
        // ignore
      }
      results.push({
        name: entry.name,
        path: full,
        type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
        size,
        modifiedAt,
      });
    }
    return sortEntries(results);
  }

  private async _listRemote(context: IProjectContext, dir: string): Promise<IProjectFileEntry[]> {
    const sessionId = await this._ensureRemote(context);
    const entries = await this._sftp.list(sessionId, dir);
    const sepChar = '/';
    const base = dir.endsWith(sepChar) ? dir.slice(0, -1) : dir;
    return sortEntries(
      entries.map((e) => ({
        name: e.filename,
        path: `${base}${sepChar}${e.filename}`,
        type: e.isDirectory ? 'directory' as const : e.isSymlink ? 'symlink' as const : 'file' as const,
        size: e.attrs?.size,
        modifiedAt: e.attrs?.mtime ? e.attrs.mtime * 1000 : undefined,
      }))
    );
  }

  private async _ensureRemote(context: IProjectContext): Promise<string> {
    if (!context.hostId) {
      throw new Error('Remote project context is missing hostId');
    }
    try {
      return await this._sftp.createSession(context.hostId);
    } catch (err) {
      this._logService.error('[ProjectFs] failed to open SFTP session', err);
      throw err;
    }
  }
}

function sortEntries(entries: IProjectFileEntry[]): IProjectFileEntry[] {
  return entries.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') {
      return -1;
    }
    if (a.type !== 'directory' && b.type === 'directory') {
      return 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  });
}

/** Strip trailing slashes so the parent walk terminates at '/'. */
function normalizePosixDir(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed || '/';
}
