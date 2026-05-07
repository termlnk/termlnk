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

import type { IFlatHostInfo } from './use-flat-host-list';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LocaleService } from '@termlnk/core';
import { Button, cn, useDependency } from '@termlnk/design';
import { GripVerticalIcon, XIcon } from 'lucide-react';
import { TimelineNode } from './TimelineNode';

export interface ISortableBastionNodeProps {
  uid: string;
  hostId: string;
  index: number;
  info: IFlatHostInfo | undefined;
  onRemove: () => void;
}

export function SortableBastionNode(props: ISortableBastionNodeProps) {
  const { uid, hostId, info, onRemove } = props;
  const localeService = useDependency(LocaleService);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: uid });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const missing = !info;
  const displayLabel = info?.label ?? hostId;
  const displayAddr = info ? `${info.addr}:${info.port}` : localeService.t('terminal-ui.host-dialog.hostChain.missing');

  return (
    <TimelineNode
      ref={setNodeRef}
      variant="bastion"
      style={style}
      className={cn({ 'tm:z-10 tm:opacity-60': isDragging })}
    >
      <div
        className={cn(
          `
            tm:group
            tm:flex tm:items-center tm:gap-2 tm:rounded-md tm:border tm:border-line tm:bg-one-bg tm:px-2 tm:py-1.5
            tm:text-xs tm:transition-colors
            tm:hover:bg-one-bg2
          `,
          {
            'tm:border-red/40 tm:bg-red/5': missing,
          }
        )}
      >
        {/* drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={localeService.t('terminal-ui.host-dialog.hostChain.dragHandle')}
          className={cn(
            `
              tm:flex tm:size-5 tm:flex-none tm:items-center tm:justify-center tm:rounded-sm tm:text-white
              tm:hover:bg-one-bg
            `,
            {
              'tm:cursor-grabbing': isDragging,
              'tm:cursor-grab': !isDragging,
            }
          )}
        >
          <GripVerticalIcon className="tm:size-3.5" />
        </button>

        {/* content */}
        <div className="tm:min-w-0 tm:flex-1 tm:truncate">
          <span
            className={cn('tm:font-medium tm:text-white', {
              'tm:text-red': missing,
            })}
          >
            {displayLabel}
          </span>
          <span
            className={cn('tm:ml-2 tm:text-grey-fg2', {
              'tm:text-red/80': missing,
            })}
          >
            {displayAddr}
          </span>
        </div>

        {/* delete */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={localeService.t('terminal-ui.host-dialog.hostChain.removeBastion')}
          className={`
            tm:size-6 tm:text-white
            tm:hover:bg-transparent tm:hover:text-red
          `}
          onClick={onRemove}
        >
          <XIcon className="tm:size-3" />
        </Button>
      </div>
    </TimelineNode>
  );
}
