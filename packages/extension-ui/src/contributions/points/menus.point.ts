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

import type { IContributedMenuItem, IContributionPoint, IExtensionDescription } from '@termlnk/extension';
import type { IMenuItemFactory, MenuSchemaType } from '@termlnk/ui';
import type { z } from 'zod';
import { contributedMenusSchema } from '@termlnk/extension';
import { IMenuManagerService, MenuItemType } from '@termlnk/ui';

/**
 * `menus` contribution point.
 *
 * Each top-level key is a menu position (matches `MenuPosition` on the host)
 * and its value is an array of items that should appear there. The point
 * translates the declarative spec into a `MenuSchemaType` and calls
 * `mergeMenu()` — the disposable returned by the menu manager performs the
 * exact rollback when this extension deactivates.
 */
export class MenusPoint implements IContributionPoint<Record<string, IContributedMenuItem[]>> {
  readonly name = 'menus';
  readonly schema: z.ZodType<Record<string, IContributedMenuItem[]>> = contributedMenusSchema;

  constructor(
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService
  ) {}

  apply(_description: IExtensionDescription, value: Record<string, IContributedMenuItem[]>): ReturnType<IContributionPoint<Record<string, IContributedMenuItem[]>>['apply']> {
    const schema = this._buildSchema(value);
    return this._menuManagerService.mergeMenu(schema);
  }

  private _buildSchema(menus: Record<string, IContributedMenuItem[]>): MenuSchemaType {
    const schema: Record<string, Record<string, { order: number; menuItemFactory: IMenuItemFactory }>> = {};

    for (const [position, items] of Object.entries(menus)) {
      schema[position] = {};
      for (const item of items) {
        const factory: IMenuItemFactory = () => ({
          id: `menu.${position}.${item.command}`,
          commandId: item.command,
          type: MenuItemType.BUTTON,
          title: item.title ?? item.command,
          tooltip: item.title,
          icon: item.icon,
        });
        schema[position][item.command] = {
          order: item.order ?? 0,
          menuItemFactory: factory,
        };
      }
    }

    return schema as MenuSchemaType;
  }
}
