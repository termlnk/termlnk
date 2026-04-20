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

import type { ReactNode } from 'react';
import type { Observable } from 'rxjs';
import type { IMenuItem } from '../../../services/menu/menu';
import { LocaleService } from '@termlnk/core';
import { useDependency } from '@termlnk/design';
import { useEffect, useMemo, useState } from 'react';
import { isObservable } from 'rxjs';
import { ComponentManagerService } from '../../../services/component/component-manager.service';

export type ICustomWrapperProps<T = undefined> = {
  className?: string;
  value?: string | number | undefined;
  value$?: Observable<T>;
  onChange?(v: string | number): void;
  title?: ReactNode;
} & Pick<IMenuItem, 'componentId' | 'icon'>;

export function CustomWrapper(props: ICustomWrapperProps) {
  const { className, title, icon, componentId, value, value$ } = props;
  const localeService = useDependency(LocaleService);
  const componentManagerService = useDependency(ComponentManagerService);
  const [subscribedValue, setSubscribedValue] = useState(value);
  const [realIcon, setRealIcon] = useState('');

  const nodes = [];
  let index = 0;

  useEffect(() => {
    if (value$) {
      const subscription = value$.subscribe((v) => {
        setSubscribedValue(v);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [value$]);

  const realValue = useMemo(() => {
    return value ?? subscribedValue;
  }, [subscribedValue, value]);

  useEffect(() => {
    let subscription = null;
    if (isObservable(icon)) {
      subscription = icon.subscribe((v) => {
        setRealIcon(v);
      });
    } else {
      setRealIcon(icon || '');
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, [icon]);

  if (icon) {
    const Icon = componentManagerService.get(realIcon ?? '');
    if (Icon) {
      nodes.push(
        <Icon
          key={index++}
          className="tm:text-base"
        />
      );
    }
  }
  if (componentId) {
    const CustomComponent = componentManagerService.get(componentId);

    if (CustomComponent) {
      nodes.push(
        <CustomComponent
          key={index++}
          {...props}
          className={className}
          value={realValue}
        />
      );
    }
  }
  if (title) {
    nodes.push(
      <span key={index++} className={className}>
        {typeof title === 'string' ? localeService.t(title) : title}
      </span>
    );
  }

  return <>{nodes}</>;
}
