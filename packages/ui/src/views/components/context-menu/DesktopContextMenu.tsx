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

import type { IMenuItem, IMenuSchema } from '../../../services/menu/menu';
import { ICommandService, LocaleService } from '@termlnk/core';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger, useDependency, useObservable } from '@termlnk/design';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IContextMenuService } from '../../../services/contextmenu/contextmenu.service';
import { IMenuManagerService } from '../../../services/menu/menu-manager.service';
import { IShortcutService } from '../../../services/shortcut/shortcut.service';

interface IMenuState {
  menuType: string;
  schemas: IMenuSchema[];
  x: number;
  y: number;
}

export function DesktopContextMenu() {
  const contextMenuService = useDependency(IContextMenuService);
  const menuManagerService = useDependency(IMenuManagerService);
  const commandService = useDependency(ICommandService);
  const localeService = useDependency(LocaleService);
  const shortcutService = useDependency(IShortcutService);

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<IMenuState | null>(null);

  const visibleRef = useRef(false);
  visibleRef.current = open;

  useEffect(() => {
    const disposable = contextMenuService.registerContextMenuHandler({
      get visible() {
        return visibleRef.current;
      },
      handleContextMenu(event: MouseEvent, menuType: string) {
        const schemas = menuManagerService.getMenuByPosition(menuType);
        if (!schemas || schemas.length === 0) {
          return;
        }
        setState({
          menuType,
          schemas,
          x: event.clientX,
          y: event.clientY,
        });
        setOpen(true);
      },
      hideContextMenu() {
        setOpen(false);
      },
    });
    return () => disposable.dispose();
  }, [contextMenuService, menuManagerService]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setState(null);
    }
  }, []);

  const handleItemSelect = useCallback((item: IMenuItem) => {
    if (item.commandId) {
      commandService.executeCommand(item.commandId);
    }
    setOpen(false);
  }, [commandService]);

  if (!state) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="tm:pointer-events-none tm:fixed tm:size-px tm:opacity-0"
          style={{ left: state.x, top: state.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={0}
        className="tm:max-w-[280px] tm:min-w-[160px]"
      >
        {state.schemas.map((schema) => (
          <ContextMenuItemNode
            key={schema.key}
            schema={schema}
            localeService={localeService}
            shortcutService={shortcutService}
            onSelect={handleItemSelect}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface IContextMenuItemNodeProps {
  schema: IMenuSchema;
  localeService: LocaleService;
  shortcutService: IShortcutService;
  onSelect: (item: IMenuItem) => void;
}

function ContextMenuItemNode({ schema, localeService, shortcutService, onSelect }: IContextMenuItemNodeProps) {
  const item = schema.item;

  const hidden = useObservable(item?.hidden$, false);
  const disabled = useObservable(item?.disabled$, false);
  const shortcutChanged = useObservable(shortcutService.shortcutChanged$);

  const shortcut = useMemo(() => {
    if (!item?.commandId) {
      return null;
    }
    return shortcutService.getShortcutDisplayOfCommand(item.commandId);
    // `shortcutChanged` is read only to force recomputation when shortcut
    // registrations change; its value itself is not used.
    // eslint-disable-next-line react/exhaustive-deps
  }, [item?.commandId, shortcutService, shortcutChanged]);

  if (!item || hidden) {
    return null;
  }

  const label = item.title ? localeService.t(item.title) : item.id;

  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => onSelect(item)}
    >
      {label}
      {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );
}
