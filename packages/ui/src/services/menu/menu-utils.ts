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

import type { MenuConfig, MenuItemConfig } from './menu';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';

export function mergeMenuConfigs<T = MenuConfig>(baseConfig: T, additionalConfig: MenuItemConfig | null): T {
  if (!additionalConfig || !baseConfig) {
    return baseConfig;
  }

  // Update properties directly if they exist in additionalConfig
  const properties: (keyof MenuItemConfig)[] = ['type', 'icon', 'title', 'tooltip'];
  properties.forEach((prop) => {
    if (additionalConfig[prop] !== undefined) {
      // Use type assertion to assure TypeScript about the operation's safety
      (baseConfig as any)[prop] = additionalConfig[prop];
    }
  });

  // Update reactive properties
  const observableProperties = ['hidden', 'disabled', 'activated'];
  observableProperties.forEach((prop) => {
    updateReactiveProperty(baseConfig, `${prop}$` as keyof typeof baseConfig, (additionalConfig as any)[prop]);
  });

  return baseConfig;
}

// Helper function to update reactive properties
function updateReactiveProperty<T, K extends keyof T>(baseConfig: T, key: K, value: any): void {
  if (value !== undefined) {
    if (baseConfig[key]) {
      const subject$ = (baseConfig[key] as any).pipe(
        switchMap(() => new BehaviorSubject(value))
      );
      baseConfig[key] = subject$;
    } else {
      baseConfig[key] = new Observable((subscriber) => {
        subscriber.next(value);
      }) as any;
    }
  }
}
