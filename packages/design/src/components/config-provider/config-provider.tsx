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
import { createContext, useMemo } from 'react';
import { isBrowser } from '../../common/is-browser';

export interface IConfigProviderProps {
  children: ReactNode;
  locale?: any;
  mountContainer: HTMLElement | null;
}

export const ConfigContext = createContext<Omit<IConfigProviderProps, 'children'>>({
  mountContainer: isBrowser() ? document.body : null,
});

export function ConfigProvider(props: IConfigProviderProps) {
  const { children, locale, mountContainer } = props;

  const value = useMemo(() => {
    return {
      locale,
      mountContainer,
    };
  }, [locale, mountContainer]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}
