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

import type { Nullable } from '@termlnk/core';
import type { Observable, Subscription } from 'rxjs';
import type { IMenuItem } from '../menu/menu';
import { Disposable, Inject } from '@termlnk/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { MenuPosition } from '../menu/menu';
import { IMenuManagerService } from '../menu/menu-manager.service';
import { ResizableService } from '../resizable/resizable.service';

export const SIDE_TAB_BAR_ACTIVE_KEY = 'ui:side-tab-bar:active';
export const SIDE_TAB_BAR_VISIBLE_KEY = 'ui:side-tab-bar:visible';
export const SIDE_TAB_BAR_PANEL_EXPANDED_KEY = 'ui:side-tab-bar:panel-expanded-on-hide';

export class SideTabBarService extends Disposable {
  private readonly _tabs$ = new BehaviorSubject<IMenuItem[]>([]);
  readonly tabs$: Observable<IMenuItem[]> = this._tabs$.asObservable();
  get tabs(): IMenuItem[] { return this._tabs$.getValue(); }

  private readonly _active$ = new BehaviorSubject<Nullable<string>>('');
  readonly active$: Observable<Nullable<string>> = this._active$.asObservable();
  get active(): Nullable<string> { return this._active$.getValue(); }

  private readonly _visible$ = new BehaviorSubject<boolean>(true);
  readonly visible$: Observable<boolean> = this._visible$.asObservable();
  get visible(): boolean { return this._visible$.getValue(); }

  private _panelExpandedOnHide = false;
  get panelExpandedOnHide(): boolean { return this._panelExpandedOnHide; }

  private _hiddenSubscription: Subscription | null = null;

  constructor(
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService,
    @Inject(ResizableService) private readonly _resizableService: ResizableService
  ) {
    super();

    this._init();
  }

  private _init() {
    this._ensure();

    this.disposeWithMe(
      this._active$.subscribe((id: Nullable<string>) => {
        this._record(id);

        if (id) {
          this._resizableService.expand('left');
        } else {
          this._resizableService.collapse('left');
        }
      })
    );

    this.disposeWithMe(
      this._resizableService.getExpand$('left').subscribe((value) => {
        if (value && !this.active) {
          if (this.tabs.length > 0) {
            this.activate(this.tabs[0].id);
          }
        }
      })
    );

    this.disposeWithMe(
      this._menuManagerService.menuChanged$.subscribe(() => {
        const schemas = this._menuManagerService.getMenuByPosition(MenuPosition.SIDE_TAB_BAR);

        const hiddenObservable: Observable<boolean>[] = [];
        const hiddenObservableKeys: string[] = [];
        for (const menu of schemas) {
          if (menu.item?.hidden$) {
            hiddenObservable.push(menu.item.hidden$);
            hiddenObservableKeys.push(menu.item.id);
          }
        }

        this._hiddenSubscription?.unsubscribe();

        if (hiddenObservable.length > 0) {
          this._hiddenSubscription = combineLatest(hiddenObservable).subscribe((hiddenMap) => {
            const newMenus: IMenuItem[] = [];

            const hiddenKeys = hiddenMap.map((hidden, index) => {
              if (hidden) {
                return hiddenObservableKeys[index];
              }
              return null;
            }).filter((v) => !!v) as string[];

            for (const menu of schemas) {
              if (hiddenKeys.some((v) => v === menu.key)) {
                continue;
              }
              newMenus.push(menu.item!);
            }

            this._tabs$.next(newMenus);
          });
        } else {
          this._hiddenSubscription = null;
          this._tabs$.next(schemas.filter((m) => m.item).map((m) => m.item!));
        }
      })
    );
  }

  activate(id: Nullable<string>): boolean {
    if (!this.tabs.some((tab) => tab.id === id)) {
      // If the id is not in tabs, cancel the active state
      id = '';
    }

    this._active$.next(id);
    return true;
  }

  setVisible(visible: boolean): void {
    if (!visible) {
      this._panelExpandedOnHide = !this._resizableService.isCollapsed('left');
      localStorage.setItem(SIDE_TAB_BAR_PANEL_EXPANDED_KEY, JSON.stringify(this._panelExpandedOnHide));
    }
    this._visible$.next(visible);
    localStorage.setItem(SIDE_TAB_BAR_VISIBLE_KEY, JSON.stringify(visible));
  }

  private _ensure() {
    const id = localStorage.getItem(SIDE_TAB_BAR_ACTIVE_KEY);
    this._active$.next(id || '');

    const visible = localStorage.getItem(SIDE_TAB_BAR_VISIBLE_KEY);
    if (visible !== null) {
      this._visible$.next(JSON.parse(visible) as boolean);
    }

    const panelExpanded = localStorage.getItem(SIDE_TAB_BAR_PANEL_EXPANDED_KEY);
    if (panelExpanded !== null) {
      this._panelExpandedOnHide = JSON.parse(panelExpanded) as boolean;
    }
  }

  private _record(id: Nullable<string>) {
    localStorage.setItem(SIDE_TAB_BAR_ACTIVE_KEY, id || '');
  }

  override dispose() {
    super.dispose();
    this._hiddenSubscription?.unsubscribe();
    this._hiddenSubscription = null;
    this._tabs$.complete();
    this._active$.complete();
    this._visible$.complete();
  }
}
