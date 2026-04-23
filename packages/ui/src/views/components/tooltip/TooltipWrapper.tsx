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

import type { ReactNode } from 'react';
import { LocaleService } from '@termlnk/core';
import { Kbd, KbdGroup, Tooltip, TooltipContent, TooltipTrigger, useDependency, useUpdateBinder } from '@termlnk/design';
import { useMemo } from 'react';
import { IShortcutService } from '../../../services/shortcut/shortcut.service';

export interface ITooltipWrapperProps {
  children: ReactNode;
  labelKey?: string;
  labelArgs?: string[];
  title?: string;
  commandId?: string;
  shortcut?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
}

export function TooltipWrapper(props: ITooltipWrapperProps) {
  const { children, labelKey, labelArgs, title, commandId, shortcut, side = 'top', sideOffset } = props;

  const localeService = useDependency(LocaleService);
  const shortcutService = useDependency(IShortcutService);

  useUpdateBinder(localeService.localeChanged$);
  useUpdateBinder(shortcutService.shortcutChanged$);

  const text = useMemo(() => {
    if (title !== undefined) {
      return title;
    }
    if (labelKey) {
      return localeService.t(labelKey, ...(labelArgs ?? []));
    }
    return '';
  }, [title, labelKey, labelArgs, localeService]);

  const shortcutParts = useMemo(() => {
    const display = shortcut ?? (commandId ? shortcutService.getShortcutDisplayOfCommand(commandId) : null);
    if (!display) {
      return [];
    }
    return display.split('+').map((part) => part.trim()).filter(Boolean);
  }, [shortcut, commandId, shortcutService]);

  const hasShortcut = shortcutParts.length > 0;
  const hasText = Boolean(text);

  if (!hasText && !hasShortcut) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset}>
        <div className="tm:flex tm:items-center tm:gap-2">
          {hasText && <span>{text}</span>}
          {hasShortcut && (
            <KbdGroup>
              {shortcutParts.map((key) => (
                <Kbd key={key}>
                  {key}
                </Kbd>
              ))}
            </KbdGroup>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
