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

import type { IMenuSchema, IMenuSelectorItem, IValueOption } from '../../../services/menu/menu';
import { ICommandService, LocaleService } from '@termlnk/core';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger, useDependency, useObservable } from '@termlnk/design';
import { Check } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isObservable, of } from 'rxjs';
import { IContextMenuService } from '../../../services/contextmenu/contextmenu.service';
import { MenuItemType } from '../../../services/menu/menu';
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

  const handleCommand = useCallback((commandId: string | undefined, params?: object) => {
    if (commandId) {
      commandService.executeCommand(commandId, params);
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
        // The trigger above is a 1px invisible positioning anchor (aria-hidden,
        // tabIndex -1), so Radix's default focus restoration on close would move
        // focus to a meaningless element — and every outside focusin is treated
        // by other open layers (e.g. the icon picker popover a command just
        // opened) as an outside interaction that closes them.
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {state.schemas.map((schema) => (
          <ContextMenuItemNode
            key={schema.key}
            schema={schema}
            localeService={localeService}
            shortcutService={shortcutService}
            onCommand={handleCommand}
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
  onCommand: (commandId: string | undefined, params?: object) => void;
}

function ContextMenuItemNode({ schema, localeService, shortcutService, onCommand }: IContextMenuItemNodeProps) {
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

  if (item.type === MenuItemType.SELECTOR) {
    return <SelectorOptions item={item} onCommand={onCommand} />;
  }

  const label = item.title ? localeService.t(item.title) : item.id;

  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => onCommand(item.commandId, item.params)}
    >
      {label}
      {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );
}

interface ISelectorOptionsProps {
  item: IMenuSelectorItem;
  onCommand: (commandId: string | undefined, params?: object) => void;
}

function SelectorOptions({ item, onCommand }: ISelectorOptionsProps) {
  const selections$ = useMemo(
    () => (isObservable(item.selections) ? item.selections : of(item.selections ?? [])),
    [item.selections]
  );
  const options = useObservable<IValueOption[]>(selections$, []);
  const value = useObservable(item.value$);

  return (
    <>
      {options.map((option, index) => {
        const active = option.value !== undefined && option.value === value;
        return (
          <DropdownMenuItem
            key={option.value ?? `${option.label}-${index}`}
            disabled={option.disabled}
            onSelect={() => onCommand(option.commandId ?? item.selectionsCommandId, option.params)}
          >
            <span className="tm:truncate">{option.label}</span>
            {active && <Check size={14} className="tm:ml-auto" />}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
