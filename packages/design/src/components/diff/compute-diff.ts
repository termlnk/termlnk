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

import type { IDiffHunk, IDiffLine } from './types';
import { diffLines } from 'diff';

/** Build structured hunks from a pair of full-file texts (ACP tool-call shape). */
export function computeDiffFromTexts(
  oldText: string | null | undefined,
  newText: string,
  path?: string
): IDiffHunk[] {
  const changes = diffLines(oldText ?? '', newText);
  const lines: IDiffLine[] = [];
  let oldNo = 1;
  let newNo = 1;

  for (const change of changes) {
    // diffLines keeps the trailing newline on each hunk; splitting after
    // stripping it avoids a phantom empty final row.
    const rows = change.value.replace(/\n$/, '').split('\n');

    for (const row of rows) {
      if (change.added) {
        lines.push({ kind: 'add', text: row, newLineNo: newNo++ });
      } else if (change.removed) {
        lines.push({ kind: 'remove', text: row, oldLineNo: oldNo++ });
      } else {
        lines.push({ kind: 'context', text: row, oldLineNo: oldNo++, newLineNo: newNo++ });
      }
    }
  }

  const header = path
    ? `@@ ${path} @@`
    : `@@ -1,${oldNo - 1} +1,${newNo - 1} @@`;

  return [{ header, lines }];
}
