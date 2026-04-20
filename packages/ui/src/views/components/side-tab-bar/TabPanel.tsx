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
import type { IMenuItem } from '../../../services/menu/menu';
import { useDependency, useObservable } from '@termlnk/design';
import { useMemo } from 'react';
import { ComponentManagerService } from '../../../services/component/component-manager.service';
import { SideTabBarService } from '../../../services/side-tab-bar/side-tab-bar.service';
import { ComponentContainer } from '../ComponentContainer';

export interface ITabPanelProps {

}

export function TabPanel(_props: ITabPanelProps) {
  const sideTabBarService = useDependency(SideTabBarService);
  const componentManagerService = useDependency(ComponentManagerService);

  const active = useObservable(sideTabBarService.active$);
  const tabItem: Nullable<IMenuItem> = useMemo(() => {
    return sideTabBarService.tabs.find((v) => v.id === active);
  }, [active]);

  if (!tabItem) {
    return <></>;
  }

  const customComp = componentManagerService.get(tabItem.componentId ?? '');

  return (
    <ComponentContainer key="side-tab-panel" components={customComp} />
  );
}
