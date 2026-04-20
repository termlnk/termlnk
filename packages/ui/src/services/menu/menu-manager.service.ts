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

import type { IDisposable, Nullable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { IMenuItem, IMenuSchema, MenuSchemaType } from './menu';
import { createIdentifier, Disposable, generateRandomId, IConfigService, Inject, Injector, merge, toDisposable } from '@termlnk/core';
import { Subject } from 'rxjs';
import { MenuPosition } from './menu';
import { mergeMenuConfigs } from './menu-utils';

export interface IMenuManagerService {
  readonly menuChanged$: Observable<void>;

  /**
   * Register a menu schema at the root level. The returned disposable removes
   * this contribution from the merged menu when invoked, making the API safe
   * for dynamic contributors (extensions, runtime controllers).
   */
  appendRootMenu(source: MenuSchemaType): IDisposable;

  /**
   * Merge a menu contribution into the root menu tree. When a `target` is
   * provided, the merge is performed in-place against that subtree and **no
   * contribution record is created** — this path exists for internal recursion
   * only and callers should not rely on its return value for rollback.
   */
  mergeMenu(source: MenuSchemaType, target?: MenuSchemaType): IDisposable;

  getMenuByPosition(key: string): IMenuSchema[];
  getFlatMenuByPosition(key: string): IMenuSchema[];
}
export const IMenuManagerService = createIdentifier<IMenuManagerService>('ui.menu-manager-service');

export class MenuManagerService extends Disposable implements IMenuManagerService {
  private readonly _menuChanged$ = new Subject<void>();
  readonly menuChanged$: Observable<void> = this._menuChanged$.asObservable();

  /**
   * Active menu contributions keyed by a synthetic contribution id. The merged
   * view `_menu` is always derived from this map via `_rebuild()`; disposing a
   * contribution triggers a rebuild so its keys disappear from the tree
   * without affecting peer contributions.
   */
  private readonly _contributions = new Map<string, MenuSchemaType>();

  private _menu: MenuSchemaType = this._createBaseMenu();

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._menuChanged$.complete();
    this._contributions.clear();
  }

  appendRootMenu(source: MenuSchemaType): IDisposable {
    return this._registerContribution(source);
  }

  mergeMenu(source: MenuSchemaType, target?: MenuSchemaType): IDisposable {
    // In-place recursive merge for internal subtree walks. External callers
    // pass no target and get a proper rollback handle via the contribution
    // registry path below.
    if (target) {
      this._mergeInto(source, target);
      this._menuChanged$.next();
      return toDisposable(() => {
        // no-op: subtree mutations are owned by whoever supplied the target
      });
    }

    return this._registerContribution(source);
  }

  /**
   * Get menu schema by position key
   * @param key
   * @returns Menu schema array or empty array if not found
   */
  getMenuByPosition(key: string): IMenuSchema[] {
    const findKey = (obj: any): any => {
      if (key in obj) {
        return this._buildMenuSchema(obj[key]);
      }

      for (const k in obj) {
        if (k === key) {
          return this._buildMenuSchema(obj[k]);
        }
        if (typeof obj[k] === 'object') {
          const result = findKey(obj[k]);
          if (result) {
            return result;
          }
        }
      }
    };

    return findKey(this._menu);
  }

  /**
   * Get flat menu schema by position key
   * @param key
   * @returns Flat menu schema array or empty array if not found
   */
  getFlatMenuByPosition(key: string): IMenuSchema[] {
    const menu = this.getMenuByPosition(key);

    function flatMenuItems(items: IMenuSchema[]): IMenuSchema[] {
      return items.reduce((acc, item) => {
        if (item.children) {
          return [...acc, item, ...flatMenuItems(item.children)];
        }
        return [...acc, item];
      }, [] as IMenuSchema[]);
    }

    return flatMenuItems(menu);
  }

  private _registerContribution(source: MenuSchemaType): IDisposable {
    const id = generateRandomId();
    this._contributions.set(id, source);
    this._rebuild();
    return toDisposable(() => {
      if (this._contributions.delete(id)) {
        this._rebuild();
      }
    });
  }

  private _rebuild(): void {
    this._menu = this._createBaseMenu();
    for (const contribution of this._contributions.values()) {
      this._mergeInto(contribution, this._menu);
    }
    this._menuChanged$.next();
  }

  private _mergeInto(source: MenuSchemaType, target: MenuSchemaType): void {
    for (const [key, value] of Object.entries(target)) {
      if (key in source) {
        const _key = key as keyof MenuSchemaType;
        target[_key] = merge({}, target[_key], source[_key]);
      } else if (typeof value === 'object') {
        this._mergeInto(source, value);
      }
    }
    // Append any top-level keys from source that do not yet exist on target.
    for (const [key, value] of Object.entries(source)) {
      if (!(key in target)) {
        const _key = key as keyof MenuSchemaType;
        target[_key] = merge({}, value);
      }
    }
  }

  private _createBaseMenu(): MenuSchemaType {
    return {
      [MenuPosition.SIDE_TAB_BAR]: {
      },
    };
  }

  private _buildMenuSchema(data: MenuSchemaType): IMenuSchema[] {
    const result: IMenuSchema[] = [];

    for (const [key, value] of Object.entries(data)) {
      const menuItem: Partial<IMenuSchema> = {
        key,
        order: value.order,
      };

      if (value.menuItemFactory) {
        const item: IMenuItem = this._injector.invoke(value.menuItemFactory);

        if (item) {
          const menuItemConfig: Nullable<IMenuItem> = this._configService.getConfig<IMenuItem>('menu');

          if (menuItemConfig && item.id in menuItemConfig) {
            const _key = item.id as keyof IMenuItem;
            menuItem.item = mergeMenuConfigs(item, menuItemConfig[_key] as any);
          } else {
            menuItem.item = item;
          }
        }
      }
      if (typeof value === 'object') {
        const children = this._buildMenuSchema(value);
        if (children.length > 0) {
          menuItem.children = children.sort((a, b) => a.order - b.order);
        }

        if (menuItem.item || menuItem.children) {
          result.push(menuItem as IMenuSchema);
        }
      }
    }

    return result;
  }
}
