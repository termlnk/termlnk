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

import type { IDisposable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { ComponentType } from '../component/component-manager.service';
import { createIdentifier, Disposable, toDisposable } from '@termlnk/core';
import { Subject } from 'rxjs';

export type ComponentRenderer = () => ComponentType;
type ComponentPartKey = BuiltInUIPart | string;

interface IRegisteredComponent {
  component: ComponentType;
  order: number;
}

export enum BuiltInUIPart {
  GLOBAL = 'global',
  FLOATING = 'floating',

  HEADER = 'header',
  HEADER_ACTION = 'header-action',
  HEADER_TRAILING = 'header-trailing',
  CONTAINER = 'container',
  FOOTER = 'footer',

  CONTENT = 'content',
  SIDE_TAB_BAR = 'side-tab-bar',
  RIGHT_SIDEBAR = 'right-sidebar',
  TAB_BAR = 'tab-bar',
}

export interface IUIPartsService {
  componentRegistered$: Observable<ComponentPartKey>;
  uiVisibleChange$: Observable<{ ui: ComponentPartKey; visible: boolean }>;

  registerComponent(part: ComponentPartKey, componentFactory: () => ComponentType, order?: number): IDisposable;
  getComponents(part: ComponentPartKey): ComponentRenderer[];

  setUIVisible(part: ComponentPartKey, visible: boolean): void;

  isUIVisible(part: ComponentPartKey): boolean;
}

export const IUIPartsService = createIdentifier<IUIPartsService>('ui.parts-service');

export class UIPartsService extends Disposable implements IUIPartsService {
  private _componentsByPart = new Map<ComponentPartKey, IRegisteredComponent[]>();

  private readonly _componentRegistered$ = new Subject<ComponentPartKey>();
  readonly componentRegistered$ = this._componentRegistered$.asObservable();
  private readonly _uiVisible = new Map<ComponentPartKey, boolean>();
  private readonly _uiVisibleChange$ = new Subject<{ ui: ComponentPartKey; visible: boolean }>();
  readonly uiVisibleChange$ = this._uiVisibleChange$.asObservable();

  override dispose(): void {
    super.dispose();

    this._componentsByPart.clear();
    this._uiVisible.clear();
    this._componentRegistered$.complete();
    this._uiVisibleChange$.complete();
  }

  setUIVisible(part: ComponentPartKey, visible: boolean): void {
    this._uiVisible.set(part, visible);
    this._uiVisibleChange$.next({ ui: part, visible });
  }

  isUIVisible(part: ComponentPartKey): boolean {
    return this._uiVisible.get(part) ?? true;
  }

  registerComponent<T>(part: ComponentPartKey, componentFactory: () => React.ComponentType<T>, order = 0): IDisposable {
    const componentType = componentFactory();
    const entry: IRegisteredComponent = { component: componentType, order };
    const components = this._componentsByPart.get(part) ?? this._componentsByPart.set(part, []).get(part)!;
    components.push(entry);

    this._componentRegistered$.next(part);

    return toDisposable(() => {
      const index = components.indexOf(entry);
      if (index !== -1) {
        components.splice(index, 1);
      }
      if (components.length === 0) {
        this._componentsByPart.delete(part);
      }
      this._componentRegistered$.next(part);
    });
  }

  getComponents(part: ComponentPartKey): ComponentType[] {
    const components = this._componentsByPart.get(part);
    if (!components) {
      return [];
    }

    // Stable sort by ascending order, mirroring the menu schema sort in
    // menu-manager.service. Equal orders keep insertion order, so parts whose
    // components register without an explicit order (default 0) preserve their
    // legacy registration order.
    return [...components].sort((a, b) => a.order - b.order).map((c) => c.component);
  }
}
