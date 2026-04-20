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

import type { CSSProperties } from 'react';
import type { IDiffLine } from './diff-utils';
import { cn } from '@termlnk/design';
import { computeDiffLines, computeDiffStats } from './diff-utils';

const LINE_STYLES: Record<IDiffLine['type'], CSSProperties> = {
  context: { color: 'rgba(255,255,255,0.35)' },
  add: { color: 'var(--color-idle, #22c55e)', background: 'rgba(34,197,94,0.08)' },
  remove: { color: 'rgb(252,165,165)', background: 'rgba(249,115,22,0.08)' },
};

const LINE_PREFIX: Record<IDiffLine['type'], string> = {
  remove: '- ',
  add: '+ ',
  context: '  ',
};

interface IDiffViewProps {
  oldString?: string;
  newString?: string;
}

export function DiffView({ oldString = '', newString = '' }: IDiffViewProps) {
  const lines = computeDiffLines(oldString, newString);
  const stats = computeDiffStats(lines);

  if (lines.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn('tm:overflow-hidden tm:rounded-sm tm:font-mono')}
        style={{
          background: 'rgba(255,255,255,0.04)',
          padding: '3px 0',
          marginBottom: 3,
          maxHeight: 68,
          fontSize: 9,
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn('tm:flex tm:items-baseline tm:gap-1')}
            style={{
              padding: '0 6px',
              lineHeight: 1.6,
              whiteSpace: 'nowrap',
              ...LINE_STYLES[line.type],
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.2)', minWidth: 14, textAlign: 'right' }}>
              {line.lineNumber}
            </span>
            {LINE_PREFIX[line.type]}
            {line.content}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
        +
        {stats.added}
        {' '}
        -
        {stats.removed}
      </div>
    </>
  );
}
