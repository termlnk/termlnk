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

import type { IDiffHunk } from './types';
import { useMemo } from 'react';
import { cn } from '../../common/cn';
import { VirtualList } from '../virtual-list/VirtualList';
import { computeDiffFromTexts } from './compute-diff';
import { DiffLineRow } from './DiffLine';
import { flattenHunks, parseUnifiedDiff } from './parse-unified';

export interface IDiffProps {
  /** Pre-structured hunks — preferred internal representation. */
  hunks?: IDiffHunk[];
  /** Unified diff text (from git). Ignored when `hunks` is set. */
  unified?: string;
  /** Pair of texts (from ACP tool calls). Ignored when `hunks`/`unified` set. */
  oldText?: string | null;
  newText?: string;
  path?: string;
  className?: string;
  /** Enable row virtualization above this many lines (default 200). */
  virtualizeThreshold?: number;
  maxHeight?: number;
  showLineNumbers?: boolean;
}

export function Diff({
  hunks: hunksProp,
  unified,
  oldText,
  newText,
  path,
  className,
  virtualizeThreshold = 200,
  maxHeight = 360,
  showLineNumbers = true,
}: IDiffProps) {
  const hunks = useMemo(() => {
    if (hunksProp) {
      return hunksProp;
    }
    if (unified) {
      return parseUnifiedDiff(unified);
    }
    if (newText !== undefined) {
      return computeDiffFromTexts(oldText, newText, path);
    }
    return [];
  }, [hunksProp, unified, oldText, newText, path]);

  const lines = useMemo(() => flattenHunks(hunks), [hunks]);

  if (lines.length === 0) {
    return (
      <div className={cn('tm:px-2 tm:py-1 tm:text-xs tm:text-grey', className)}>
        No changes
      </div>
    );
  }

  const useVirtual = lines.length >= virtualizeThreshold;
  const itemHeight = 20;

  if (useVirtual) {
    return (
      <div className={cn('tm:overflow-hidden tm:rounded-md tm:border tm:border-line', className)}>
        <VirtualList
          items={lines}
          itemHeight={itemHeight}
          height={Math.min(maxHeight, lines.length * itemHeight)}
          getItemKey={(line, i) => `${line.kind}-${i}-${line.oldLineNo ?? ''}-${line.newLineNo ?? ''}`}
          renderItem={(line) => (
            <DiffLineRow line={line} showLineNumbers={showLineNumbers} />
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'tm:overflow-auto tm:rounded-md tm:border tm:border-line',
        className
      )}
      style={{ maxHeight }}
    >
      {lines.map((line, i) => (
        <DiffLineRow
          key={`${line.kind}-${i}-${line.oldLineNo ?? ''}-${line.newLineNo ?? ''}`}
          line={line}
          showLineNumbers={showLineNumbers}
        />
      ))}
    </div>
  );
}
