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

import type { IDiffLine } from './types';
import { memo } from 'react';
import { cn } from '../../common/cn';

export interface IDiffLineRowProps {
  line: IDiffLine;
  showLineNumbers?: boolean;
}

export const DiffLineRow = memo(function DiffLineRow({
  line,
  showLineNumbers = true,
}: IDiffLineRowProps) {
  const isHeader = line.kind === 'header';
  const prefix = line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : line.kind === 'header' ? '' : ' ';

  return (
    <div
      className={cn(
        'tm:flex tm:font-mono tm:text-[11px]/5',
        {
          'tm:bg-green/10 tm:text-green': line.kind === 'add',
          'tm:bg-red/10 tm:text-red': line.kind === 'remove',
          'tm:bg-one-bg2 tm:text-grey-fg': isHeader,
          'tm:text-light-grey': line.kind === 'context',
        }
      )}
    >
      {showLineNumbers && !isHeader && (
        <>
          <span className="tm:w-10 tm:shrink-0 tm:px-1 tm:text-right tm:text-grey tm:select-none">
            {line.oldLineNo ?? ''}
          </span>
          <span className="tm:w-10 tm:shrink-0 tm:px-1 tm:text-right tm:text-grey tm:select-none">
            {line.newLineNo ?? ''}
          </span>
        </>
      )}
      <span className="tm:w-4 tm:shrink-0 tm:text-center tm:text-grey tm:select-none">
        {prefix}
      </span>
      <span className="tm:min-w-0 tm:flex-1 tm:break-all tm:whitespace-pre-wrap">
        {line.text}
      </span>
    </div>
  );
});
