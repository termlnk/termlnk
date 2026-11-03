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

import type { GitFileStatusCode } from '@termlnk/project';

/** One changed file as the Changes view needs it: status plus line counts. */
export interface IDiffFile {
  path: string;
  origPath?: string;
  index: GitFileStatusCode;
  worktree: GitFileStatusCode;
  /** True once the file is in the index and has no unstaged remainder. */
  staged: boolean;
  additions: number;
  deletions: number;
  binary: boolean;
  /** git diff cannot report counts for untracked files. */
  statsUnavailable: boolean;
}

export interface IDiffFolderRow {
  kind: 'folder';
  /** Full path of the deepest directory this row stands for; the collapse key. */
  dirPath: string;
  /** Compressed label, e.g. `packages/project-ui/src`. */
  displayName: string;
  depth: number;
  additions: number;
  deletions: number;
  fileCount: number;
  collapsed: boolean;
}

export interface IDiffFileRow {
  kind: 'file';
  file: IDiffFile;
  depth: number;
  /** Basename in tree mode, full path in flat mode. */
  label: string;
}

export type DiffRow = IDiffFolderRow | IDiffFileRow;

interface IDirNode {
  dirPath: string;
  dirs: Map<string, IDirNode>;
  files: IDiffFile[];
}

function emptyDir(dirPath: string): IDirNode {
  return { dirPath, dirs: new Map(), files: [] };
}

/** Directories before files, then plain ASCII order, so the list never jumps. */
function byName(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function buildTree(files: readonly IDiffFile[]): IDirNode {
  const root = emptyDir('');
  for (const file of files) {
    const segments = file.path.split('/');
    const name = segments.pop();
    if (!name) {
      continue;
    }
    let node = root;
    for (const segment of segments) {
      const dirPath = node.dirPath ? `${node.dirPath}/${segment}` : segment;
      let child = node.dirs.get(segment);
      if (!child) {
        child = emptyDir(dirPath);
        node.dirs.set(segment, child);
      }
      node = child;
    }
    node.files.push(file);
  }
  return root;
}

interface ISubtreeStats {
  additions: number;
  deletions: number;
  fileCount: number;
}

function statsOf(node: IDirNode): ISubtreeStats {
  let additions = 0;
  let deletions = 0;
  let fileCount = node.files.length;
  for (const file of node.files) {
    additions += file.additions;
    deletions += file.deletions;
  }
  for (const child of node.dirs.values()) {
    const childStats = statsOf(child);
    additions += childStats.additions;
    deletions += childStats.deletions;
    fileCount += childStats.fileCount;
  }
  return { additions, deletions, fileCount };
}

/**
 * Collapses a chain of single-child directories into one row, so a deep
 * `packages/project-ui/src/views` path does not cost four rows of indentation.
 * The row keeps the *deepest* directory as its identity: that path stays stable
 * while the diff mutates and siblings appear, so collapse state survives.
 */
function compress(node: IDirNode): { node: IDirNode; label: string } {
  let current = node;
  const segments: string[] = [lastSegment(node.dirPath)];
  while (current.files.length === 0 && current.dirs.size === 1) {
    const [only] = [...current.dirs.values()];
    segments.push(lastSegment(only.dirPath));
    current = only;
  }
  return { node: current, label: segments.join('/') };
}

function lastSegment(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? path : path.slice(index + 1);
}

export interface IBuildDiffRowsOptions {
  /** Directory paths the user has collapsed. */
  collapsed?: ReadonlySet<string>;
  /** Flat mode skips folder rows entirely and shows full paths. */
  flat?: boolean;
}

export function buildDiffRows(
  files: readonly IDiffFile[],
  options: IBuildDiffRowsOptions = {}
): DiffRow[] {
  if (options.flat) {
    return [...files]
      .sort((a, b) => byName(a.path, b.path))
      .map((file) => ({ kind: 'file' as const, file, depth: 0, label: file.path }));
  }

  const collapsed = options.collapsed ?? new Set<string>();
  const rows: DiffRow[] = [];

  const walk = (node: IDirNode, depth: number): void => {
    const dirEntries = [...node.dirs.values()].sort((a, b) => byName(a.dirPath, b.dirPath));
    for (const dir of dirEntries) {
      const { node: deepest, label } = compress(dir);
      const stats = statsOf(deepest);
      const isCollapsed = collapsed.has(deepest.dirPath);
      rows.push({
        kind: 'folder',
        dirPath: deepest.dirPath,
        displayName: label,
        depth,
        additions: stats.additions,
        deletions: stats.deletions,
        fileCount: stats.fileCount,
        collapsed: isCollapsed,
      });
      if (!isCollapsed) {
        walk(deepest, depth + 1);
      }
    }
    for (const file of [...node.files].sort((a, b) => byName(a.path, b.path))) {
      rows.push({ kind: 'file', file, depth, label: lastSegment(file.path) });
    }
  };

  walk(buildTree(files), 0);
  return rows;
}

/** Every directory path in the tree — what "collapse all" needs to collapse. */
export function collectDirPaths(files: readonly IDiffFile[]): string[] {
  const paths: string[] = [];
  const walk = (node: IDirNode): void => {
    for (const dir of node.dirs.values()) {
      const { node: deepest } = compress(dir);
      paths.push(deepest.dirPath);
      walk(deepest);
    }
  };
  walk(buildTree(files));
  return paths;
}
