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

import type { IDiffFile } from '../views/project/diff-tree';
import { describe, expect, it } from 'vitest';
import { buildDiffRows, collectDirPaths } from '../views/project/diff-tree';

function file(path: string, additions = 1, deletions = 0): IDiffFile {
  return {
    path,
    index: 'modified',
    worktree: 'unknown',
    staged: true,
    additions,
    deletions,
    binary: false,
    statsUnavailable: false,
  };
}

describe('buildDiffRows', () => {
  it('compresses single-child directory chains into one row', () => {
    const rows = buildDiffRows([file('packages/project-ui/src/a.ts')]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      kind: 'folder',
      dirPath: 'packages/project-ui/src',
      displayName: 'packages/project-ui/src',
      depth: 0,
    });
    expect(rows[1]).toMatchObject({ kind: 'file', label: 'a.ts', depth: 1 });
  });

  it('stops compressing where the tree branches', () => {
    const rows = buildDiffRows([
      file('packages/a/src/x.ts'),
      file('packages/b/src/y.ts'),
    ]);

    const folders = rows.filter((r) => r.kind === 'folder');
    expect(folders.map((f) => f.kind === 'folder' && f.dirPath)).toEqual([
      'packages',
      'packages/a/src',
      'packages/b/src',
    ]);
  });

  it('aggregates line counts up the subtree', () => {
    const rows = buildDiffRows([
      file('src/a.ts', 10, 2),
      file('src/nested/b.ts', 5, 1),
    ]);

    expect(rows[0]).toMatchObject({
      kind: 'folder',
      dirPath: 'src',
      additions: 15,
      deletions: 3,
      fileCount: 2,
    });
  });

  it('hides the children of a collapsed directory but keeps its totals', () => {
    const rows = buildDiffRows(
      [file('src/a.ts', 10, 2), file('src/nested/b.ts', 5, 1)],
      { collapsed: new Set(['src']) }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ dirPath: 'src', additions: 15, collapsed: true });
  });

  it('drops folder rows and shows full paths in flat mode', () => {
    const rows = buildDiffRows([file('src/nested/b.ts'), file('src/a.ts')], { flat: true });

    expect(rows.map((r) => r.kind === 'file' && r.label)).toEqual([
      'src/a.ts',
      'src/nested/b.ts',
    ]);
  });
});

describe('collectDirPaths', () => {
  it('returns the compressed directory identities, not every segment', () => {
    expect(collectDirPaths([file('packages/a/src/x.ts'), file('packages/b/y.ts')]))
      .toEqual(['packages', 'packages/a/src', 'packages/b']);
  });
});
