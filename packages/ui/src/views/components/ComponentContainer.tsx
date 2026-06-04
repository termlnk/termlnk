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

import type { Injector } from '@termlnk/core';
import type { ComponentType, ReactNode } from 'react';
import type { ComponentRenderer } from '../../services/parts/parts.service';
import { useDependency, useObservable } from '@termlnk/design';
import { createElement, useMemo, useRef } from 'react';
import { debounceTime, filter, map, startWith } from 'rxjs';
import { IUIPartsService } from '../../services/parts/parts.service';

export interface IComponentContainerProps {
  components?: ComponentType[] | ComponentType;
  fallback?: ReactNode;
  sharedProps?: Record<string, unknown>;
}

export function ComponentContainer(props: IComponentContainerProps): ReactNode {
  const { components, fallback, sharedProps } = props;
  if (!components || (Array.isArray(components) && components.length === 0)) {
    return fallback ?? null;
  }

  const values = Array.isArray(components) ? components : [components];
  return values.map((component, index) => {
    return createElement(component, { key: `${component.displayName ?? index}`, ...sharedProps });
  });
}

/**
 * Get a set of render functions to render components of a part.
 *
 * @param part The part name.
 * @param injector The injector to get the service. It is optional. However, you should not change this prop in a given
 * component.
 */
export function useComponentsOfPart(part: string, injector?: Injector): ComponentRenderer[] {
  const uiPartsService = injector?.get(IUIPartsService) ?? useDependency(IUIPartsService);
  const uiVisibleChange$ = useMemo(() => uiPartsService.uiVisibleChange$.pipe(filter((ui) => ui.ui === part)), [part, uiPartsService]);
  const changeInfo = useObservable(uiVisibleChange$);

  const updateCounterRef = useRef<number>(0);
  const componentPartUpdateCount = useObservable(
    () => uiPartsService.componentRegistered$.pipe(
      filter((key) => key === part),
      debounceTime(200),
      map(() => updateCounterRef.current += 1),
      startWith(updateCounterRef.current += 1) // trigger update when subscribe
    ),
    undefined,
    undefined,
    [uiPartsService, part, changeInfo]
  );

  return useMemo(() => uiPartsService.isUIVisible(part) ? uiPartsService.getComponents(part) : [], [componentPartUpdateCount]);
}
