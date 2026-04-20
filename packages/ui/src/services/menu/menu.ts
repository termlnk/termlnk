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
}

export interface IMenuItem {
  id: string;
  commandId?: string;

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
  order: number;
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
