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

const HUNK_RE = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/;

/** Parse a unified diff text into structured hunks. */
export function parseUnifiedDiff(text: string): IDiffHunk[] {
  const hunks: IDiffHunk[] = [];
  let current: IDiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  for (const raw of text.split(/\r?\n/)) {
    const hunkMatch = HUNK_RE.exec(raw);
    if (hunkMatch) {
      current = { header: raw, lines: [] };
      hunks.push(current);
      oldNo = Number(hunkMatch[1]);
      newNo = Number(hunkMatch[3]);
      continue;
    }

    if (!current) {
      // File headers (---/+++/diff --git) are ignored for rendering.
      continue;
    }

    if (raw.startsWith('+')) {
      current.lines.push({ kind: 'add', text: raw.slice(1), newLineNo: newNo++ });
    } else if (raw.startsWith('-')) {
      current.lines.push({ kind: 'remove', text: raw.slice(1), oldLineNo: oldNo++ });
    } else if (raw.startsWith(' ') || raw === '') {
      const textLine = raw.startsWith(' ') ? raw.slice(1) : raw;
      current.lines.push({
        kind: 'context',
        text: textLine,
        oldLineNo: oldNo++,
        newLineNo: newNo++,
      });
    } else if (raw.startsWith('\\')) {
      // "\ No newline at end of file"
      current.lines.push({ kind: 'header', text: raw });
    }
  }

  return hunks;
}

export function flattenHunks(hunks: IDiffHunk[]): IDiffLine[] {
  const lines: IDiffLine[] = [];
  for (const hunk of hunks) {
    lines.push({ kind: 'header', text: hunk.header });
    lines.push(...hunk.lines);
  }
  return lines;
}
