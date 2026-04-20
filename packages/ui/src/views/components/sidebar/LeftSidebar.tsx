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

import type { ComponentType } from 'react';
import type { Observable } from 'rxjs';
import type { IMenuItem } from '../../../services/menu/menu';
import { useDependency } from '@termlnk/design';
import { useEffect, useState } from 'react';
import { combineLatest } from 'rxjs';
import { MenuPosition } from '../../../services/menu/menu';
import { IMenuManagerService } from '../../../services/menu/menu-manager.service';
import { SidebarItem } from './SidebarItem';

export interface IDesktopLeftSidebarProps {
  menuComponents: Set<ComponentType>;
}

export function LeftSidebar(props: IDesktopLeftSidebarProps) {
  const { menuComponents, ..._restProps } = props;

  const menuManagerService = useDependency(IMenuManagerService);
  // const localeService = useDependency(LocaleService);

  const [sidebarMenus, setSidebarMenus] = useState<IMenuItem[]>([]);

  const [menuChangedTimes, setMenuChangedTimes] = useState(0);
  useEffect(() => {
    const subscription = menuManagerService.menuChanged$.subscribe(() => {
      setMenuChangedTimes((prev) => prev + 1);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const menus = menuManagerService.getMenuByPosition(MenuPosition.SIDE_TAB_BAR);

    const hiddenObservable: Observable<boolean>[] = [];
    const hiddenObservableKeys: string[] = [];
    for (const menu of menus) {
      if (menu.item?.hidden$) {
        hiddenObservable.push(menu.item?.hidden$);
        hiddenObservableKeys.push(menu.item.id);
      }
    }

    if (hiddenObservable.length === 0) {
      setSidebarMenus(menus.filter((m) => m.item).map((m) => m.item!));
      return;
    }

    const subscription = combineLatest(hiddenObservable)
      .subscribe((hiddenMap) => {
        const newMenus: IMenuItem[] = [];

        const hiddenKeys = hiddenMap.map((hidden, index) => {
          if (hidden) {
            return hiddenObservableKeys[index];
          }
          return null;
        }).filter((v) => !!v) as string[];

        for (const item of menus) {
          if (hiddenKeys.some((v) => v === item.key)) {
            continue;
          }

          newMenus.push(item.item!);
        }

        setSidebarMenus(newMenus);
      });

    return () => subscription.unsubscribe();
  }, [menuChangedTimes]);

  function renderMenuItem(menuItem: IMenuItem) {
    return (
      <SidebarItem>
        {/*{menuItem.icon}*/}
      </SidebarItem>
    );
  }

  return (
    <section
      data-u-comp="left-sidebar"
      className="tm:flex tm:h-full tm:flex-col"
    >
      <div data-u-comp="icons" className="tm:w-[48px]">
        {sidebarMenus.map((item) => renderMenuItem(item))}
      </div>
      <main />
    </section>
  );
}
