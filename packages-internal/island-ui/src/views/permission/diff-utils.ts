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

export interface IDiffLine {
  readonly type: 'add' | 'remove' | 'context';
  readonly content: string;
  readonly lineNumber: number;
}

export interface IDiffStats {
  readonly added: number;
  readonly removed: number;
}

/**
 * Compute diff lines from the Edit tool's old_string → new_string.
 * Since Edit provides exact before/after strings, we show old lines as
 * removed and new lines as added. Shared prefix/suffix lines become context.
 */
export function computeDiffLines(oldStr: string, newStr: string): IDiffLine[] {
  const oldLines = oldStr ? oldStr.split('\n') : [];
  const newLines = newStr ? newStr.split('\n') : [];

  // Find shared prefix
  let prefixLen = 0;
  while (
    prefixLen < oldLines.length
    && prefixLen < newLines.length
    && oldLines[prefixLen] === newLines[prefixLen]
  ) {
    prefixLen++;
  }

  // Find shared suffix (from the remaining lines)
  let suffixLen = 0;
  while (
    suffixLen < oldLines.length - prefixLen
    && suffixLen < newLines.length - prefixLen
    && oldLines[oldLines.length - 1 - suffixLen] === newLines[newLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const result: IDiffLine[] = [];
  let lineNum = 1;

  // Context: shared prefix
  for (let i = 0; i < prefixLen; i++) {
    result.push({ type: 'context', content: oldLines[i], lineNumber: lineNum++ });
  }

  // Removed lines (old-only middle)
  for (let i = prefixLen; i < oldLines.length - suffixLen; i++) {
    result.push({ type: 'remove', content: oldLines[i], lineNumber: lineNum++ });
  }

  // Added lines (new-only middle)
  for (let i = prefixLen; i < newLines.length - suffixLen; i++) {
    result.push({ type: 'add', content: newLines[i], lineNumber: lineNum++ });
  }

  // Context: shared suffix
  for (let i = oldLines.length - suffixLen; i < oldLines.length; i++) {
    result.push({ type: 'context', content: oldLines[i], lineNumber: lineNum++ });
  }

  return result;
}

export function computeDiffStats(lines: readonly IDiffLine[]): IDiffStats {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === 'add') {
      added++;
    } else if (line.type === 'remove') {
      removed++;
    }
  }
  return { added, removed };
}
