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

import type { IDisplayMenuItem, IMenuItem } from '../../../services/menu/menu';
import { ICommandService, LocaleService } from '@termlnk/core';
import { cn, Tooltip, TooltipContent, TooltipTrigger, useDependency, useObservable } from '@termlnk/design';
import { useMemo } from 'react';
import { isObservable, Observable } from 'rxjs';
import { ComponentManagerService } from '../../../services/component/component-manager.service';
import { ResizableService } from '../../../services/resizable/resizable.service';

export function TabItem(props: IDisplayMenuItem<IMenuItem>) {
  const { id, commandId, activated$, tooltip, icon, shortcut } = props;

  const commandService = useDependency(ICommandService);
  const resizableService = useDependency(ResizableService);
  const componentManagerService = useDependency(ComponentManagerService);
  const localeService = useDependency(LocaleService);

  const tooltipTitle = localeService.t(tooltip ?? '') + (shortcut ? ` (${shortcut})` : '');
  const activated = useObservable(activated$, false);
  // const _disabled = useObservable(disabled$, false);
  const expand = useObservable(resizableService.getExpand$('left'), false);

  const icon$ = useMemo(() => {
    if (isObservable(icon)) {
      return icon;
    }
    return new Observable<typeof icon>((subscribe) => {
      subscribe.next(icon);
    });
  }, [icon]);
  const iconReal = useObservable(icon$, undefined, true);
  const Icon = componentManagerService.get(iconReal ?? '');

  const executeCommand = (commandId: string, params?: Record<string, unknown>) => {
    commandService.executeCommand(commandId, params);
  };

  const renderButtonItem = () => (
    <div
      className={cn(`
        tm:grid tm:h-[2.8rem] tm:w-full tm:grid-cols-[2px_1fr_2px] tm:items-center tm:overflow-hidden tm:text-center
        tm:hover:text-white
      `, {
        'tm:text-white': activated && expand,
      })}
      onClick={() => executeCommand(commandId ?? id)}
    >
      <span
        aria-hidden
        className={cn('tm:h-full tm:w-0.5 tm:self-stretch tm:bg-transparent tm:transition-all', {
          'tm:bg-blue': activated && expand,
        })}
      />
      {iconReal && (
        <span className="tm:flex tm:items-center tm:justify-center">
          <Icon
            className={cn('tm:flex tm:size-[1.333rem] tm:items-center tm:text-center')}
          />
        </span>
      )}
      {!iconReal && <span />}
      <span aria-hidden />
    </div>
  );
  if (!tooltip) {
    return renderButtonItem();
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {renderButtonItem()}
      </TooltipTrigger>
      <TooltipContent side="right">
        {tooltipTitle}
      </TooltipContent>
    </Tooltip>
  );
}
