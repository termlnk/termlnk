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

import type { DragEndEvent } from '@dnd-kit/core';
import type { HostFormItem } from '../../../../models/host-dialog.state';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { LocaleService } from '@termlnk/core';
import { cn, FieldDescription, useDependency } from '@termlnk/design';
import { HOST_CHAIN_MAX_DEPTH } from '@termlnk/terminal';
import { useCallback, useMemo } from 'react';
import { AddBastionNode } from './AddBastionNode';
import { SortableBastionNode } from './SortableBastionNode';
import { TimelineNode } from './TimelineNode';
import { useFlatHostList } from './use-flat-host-list';

export interface IHostChainTimelineProps {
  data: HostFormItem;
  onChange: (data: Partial<HostFormItem>) => void;
  chainError?: string;
}

export function HostChainTimeline(props: IHostChainTimelineProps) {
  const { data, onChange, chainError } = props;
  const localeService = useDependency(LocaleService);
  const { allHosts, hostMap, loaded } = useFlatHostList();

  const hostChainIds = useMemo(() => data.hostChainIds ?? [], [data.hostChainIds]);
  const reachedLimit = hostChainIds.length >= HOST_CHAIN_MAX_DEPTH;

  const availableHosts = useMemo(() => {
    const selected = new Set(hostChainIds);
    return allHosts.filter((h) => h.id !== data.id && !selected.has(h.id));
  }, [allHosts, hostChainIds, data.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateHostChainIds = useCallback((next: string[]) => {
    onChange({ hostChainIds: next.length === 0 ? undefined : next });
  }, [onChange]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = hostChainIds.indexOf(String(active.id));
    const newIndex = hostChainIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    updateHostChainIds(arrayMove(hostChainIds, oldIndex, newIndex));
  }, [hostChainIds, updateHostChainIds]);

  const handleAdd = useCallback((hostId: string) => {
    if (hostChainIds.length >= HOST_CHAIN_MAX_DEPTH) {
      return;
    }
    updateHostChainIds([...hostChainIds, hostId]);
  }, [hostChainIds, updateHostChainIds]);

  const handleRemove = useCallback((hostId: string) => {
    updateHostChainIds(hostChainIds.filter((id) => id !== hostId));
  }, [hostChainIds, updateHostChainIds]);

  const targetLabel = data.label || localeService.t('terminal-ui.host-dialog.hostChain.targetUnnamed');
  const targetAddr = data.addr ? `${data.addr}:${data.port ?? 22}` : '';

  return (
    <div className="tm:flex tm:flex-col tm:gap-3">
      {/* Header: title + usage badge */}
      <div className="tm:flex tm:items-center tm:justify-between">
        <div className="tm:flex tm:flex-col tm:gap-0.5">
          <span className="tm:text-xs tm:font-medium tm:text-white">
            {localeService.t('terminal-ui.host-dialog.hostChain.title')}
          </span>
          <span className="tm:text-[11px] tm:text-grey-fg2">
            {localeService.t('terminal-ui.host-dialog.hostChain.description')}
          </span>
        </div>
        <span
          className={cn(
            `
              tm:rounded-full tm:border tm:border-line tm:bg-one-bg tm:px-2 tm:py-0.5 tm:text-[11px] tm:font-medium
              tm:text-white
            `,
            {
              'tm:border-yellow/40 tm:bg-yellow/10 tm:text-yellow': reachedLimit,
            }
          )}
        >
          {localeService.t(
            'terminal-ui.host-dialog.hostChain.usage',
            String(hostChainIds.length),
            String(HOST_CHAIN_MAX_DEPTH)
          )}
        </span>
      </div>

      {/* Timeline body */}
      <div
        className="tm:rounded-md tm:border tm:border-line/60 tm:bg-black2/40 tm:px-3 tm:py-2"
      >
        {/* Local node */}
        <TimelineNode variant="local" showTopConnector={false}>
          <div className="tm:flex tm:items-center tm:gap-2 tm:py-0.5 tm:text-xs">
            <span className="tm:font-medium tm:text-white">
              {localeService.t('terminal-ui.host-dialog.hostChain.localNode')}
            </span>
          </div>
        </TimelineNode>

        {/* Bastion nodes */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={hostChainIds} strategy={verticalListSortingStrategy}>
            {hostChainIds.map((id, idx) => (
              <SortableBastionNode
                key={id}
                uid={id}
                hostId={id}
                index={idx}
                info={hostMap.get(id)}
                onRemove={() => handleRemove(id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add node (hidden when limit reached, replaced by hint) */}
        {!reachedLimit && (
          <AddBastionNode
            availableHosts={availableHosts}
            loaded={loaded}
            onAdd={handleAdd}
          />
        )}

        {/* Limit reached hint */}
        {reachedLimit && (
          <TimelineNode variant="add">
            <span className="tm:text-[11px] tm:text-yellow">
              {localeService.t(
                'terminal-ui.host-dialog.hostChain.maxReached',
                String(HOST_CHAIN_MAX_DEPTH)
              )}
            </span>
          </TimelineNode>
        )}

        {/* Target node */}
        <TimelineNode variant="target" showBottomConnector={false}>
          <div className="tm:flex tm:items-center tm:gap-2 tm:py-0.5 tm:text-xs">
            <span className="tm:font-medium tm:text-blue">
              {targetLabel}
            </span>
            {targetAddr && (
              <span className="tm:text-grey-fg2">{targetAddr}</span>
            )}
            <span className="tm:ml-auto tm:rounded-sm tm:bg-blue/15 tm:px-1.5 tm:py-0.5 tm:text-[10px] tm:text-blue">
              {localeService.t('terminal-ui.host-dialog.hostChain.targetNode')}
            </span>
          </div>
        </TimelineNode>
      </div>

      {/* Empty hint when no bastions */}
      {hostChainIds.length === 0 && (
        <FieldDescription>
          {localeService.t('terminal-ui.host-dialog.hostChain.empty')}
        </FieldDescription>
      )}

      {/* Validation error */}
      {chainError && (
        <FieldDescription className="tm:text-red">
          {chainError.startsWith('validation.')
            ? localeService.t(`terminal-ui.host-dialog.${chainError}`)
            : chainError}
        </FieldDescription>
      )}
    </div>
  );
}
