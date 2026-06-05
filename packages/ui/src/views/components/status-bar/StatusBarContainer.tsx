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

import type { IStatusBarItem } from '../../../services/status-bar/status-bar.service';
import { ICommandService } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { useMemo } from 'react';
import { IStatusBarService } from '../../../services/status-bar/status-bar.service';

export function StatusBarContainer() {
  const statusBarService = useDependency(IStatusBarService);
  const commandService = useDependency(ICommandService);
  const items = useObservable(statusBarService.items$, statusBarService.items);

  const { left, right } = useMemo(() => groupByAlignment(items ?? []), [items]);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(`
        tm:flex tm:h-[22px] tm:w-full tm:items-center tm:justify-between tm:gap-2 tm:px-2 tm:text-xs tm:text-light-grey
        tm:select-none
      `)}
      data-u-comp="status-bar"
    >
      <div className="tm:flex tm:min-w-0 tm:flex-1 tm:items-center tm:gap-2">
        {left.map((item) => (
          <StatusBarItemView
            key={item.id}
            item={item}
            onInvoke={() => item.command && commandService.executeCommand(item.command)}
          />
        ))}
      </div>
      <div className="tm:flex tm:items-center tm:gap-2">
        {right.map((item) => (
          <StatusBarItemView
            key={item.id}
            item={item}
            onInvoke={() => item.command && commandService.executeCommand(item.command)}
          />
        ))}
      </div>
    </div>
  );
}

function StatusBarItemView(props: { item: IStatusBarItem; onInvoke: () => void }) {
  const { item, onInvoke } = props;
  const interactive = !!item.command;

  return (
    <button
      type="button"
      disabled={!interactive}
      title={item.tooltip}
      onClick={interactive ? onInvoke : undefined}
      className={cn('tm:flex tm:items-center tm:gap-1 tm:rounded-sm tm:px-1.5 tm:py-0.5', {
        'tm:hover:bg-one-bg2': interactive,
        'tm:cursor-default': !interactive,
      })}
      style={item.color ? { color: item.color } : undefined}
    >
      {item.icon && <span className="tm:text-[10px]">{item.icon}</span>}
      <span className="tm:truncate">{item.text}</span>
    </button>
  );
}

function groupByAlignment(items: ReadonlyArray<IStatusBarItem>) {
  const left: IStatusBarItem[] = [];
  const right: IStatusBarItem[] = [];
  for (const item of items) {
    if (item.alignment === 'right') {
      right.push(item);
    } else {
      left.push(item);
    }
  }
  return { left, right };
}
