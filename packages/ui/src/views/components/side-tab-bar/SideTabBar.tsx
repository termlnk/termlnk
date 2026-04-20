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

import type { CSSProperties } from 'react';
import type { IMenuItem } from '../../../services/menu/menu';
import { useDependency, useObservable } from '@termlnk/design';
import { BuiltInUIPart } from '../../../services/parts/parts.service';
import { SideTabBarService } from '../../../services/side-tab-bar/side-tab-bar.service';
import { ComponentContainer, useComponentsOfPart } from '../ComponentContainer';
import { TabItem } from './TabItem';

export interface ISideTabBarProps {
  className?: string;
  style?: CSSProperties;
}

export function SideTabBar(props: ISideTabBarProps) {
  const { className, style } = props;

  const sideTabBarService = useDependency(SideTabBarService);

  const sideTabBarComponents = useComponentsOfPart(BuiltInUIPart.SIDE_TAB_BAR);
  const tabs = useObservable(sideTabBarService.tabs$) as IMenuItem[];

  return (
    <section
      data-comp="side-tab-bar"
      className={className}
      style={style}
    >
      {tabs.map((tab) => <TabItem key={tab.id} {...tab} />)}

      <div className="tm:mt-auto">
        <ComponentContainer components={sideTabBarComponents} />
      </div>
    </section>
  );
}
