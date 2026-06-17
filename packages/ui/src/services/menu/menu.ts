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

import type { IAccessor } from '@termlnk/core';
import type { Observable } from 'rxjs';

export enum MenuItemType {
  BUTTON = 'button',
  /** Opens a dynamic, variable-length option list (e.g. data-driven choices). */
  SELECTOR = 'selector',
}

/** One option inside a SELECTOR menu item. `label` is display-ready text. */
export interface IValueOption {
  value?: string | number;
  label: string;
  icon?: string;
  /** Params forwarded to the executed command for this option. */
  params?: object;
  /** Overrides the parent item's `selectionsCommandId` for this option. */
  commandId?: string;
  disabled?: boolean;
}

interface IMenuItemBase {
  id: string;
  commandId?: string;
  /** Params forwarded to the command when this item is selected. */
  params?: object;

  type: MenuItemType;
  title?: string;
  description?: string;
  tooltip?: string;
  icon?: string | Observable<string>;
  componentId?: string;

  hidden$?: Observable<boolean>;
  disabled$?: Observable<boolean>;
  activated$?: Observable<boolean>;
}

export interface IMenuButtonItem extends IMenuItemBase {
  type: MenuItemType.BUTTON;
}

export interface IMenuSelectorItem extends IMenuItemBase {
  type: MenuItemType.SELECTOR;
  /** Static options or a stream of options for variable-length lists. */
  selections?: IValueOption[] | Observable<IValueOption[]>;
  /** Command run when an option is chosen (an option may override it). */
  selectionsCommandId?: string;
  /** Currently selected value; marks the matching option as active. */
  value$?: Observable<string | number>;
}

export type IMenuItem = IMenuButtonItem | IMenuSelectorItem;

export enum MenuPosition {
  CONTAINER = 'container',
  SIDE_TAB_BAR = 'side-tab-bar',
  CONTEXT_MENU = 'context-menu',
}

export type MenuSchemaType = {
  order?: number;
  menuItemFactory?: (accessor: IAccessor) => IMenuItem;
} | {
  [key: string]: MenuSchemaType;
};

export interface IMenuSchema {
  key: string;
  order?: number;
  item?: IMenuItem;
  children?: IMenuSchema[];
}

export type IDisplayMenuItem<T extends IMenuItem> = T & {
  shortcut?: string;
};

export type MenuItemConfig = Partial<Omit<IMenuItem, 'id' | 'hidden$' | 'disabled$' | 'activated$'> & {
  hidden?: boolean;
  disabled?: boolean;
  activated?: boolean;
}>;
export type MenuConfig = Record<string, MenuItemConfig>;
export type IMenuItemFactory = (accessor: IAccessor, menuConfig?: MenuConfig) => IMenuItem;
