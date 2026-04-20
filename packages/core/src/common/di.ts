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

import type { Dependency, DependencyIdentifier, Injector } from '@wendellhu/redi';

export * from '@wendellhu/redi';

/**
 * Register the dependencies to the injector.
 * @param injector The injector to register the dependencies.
 * @param dependencies The dependencies to register.
 */
export function registerDependencies(injector: Injector, dependencies: Dependency[]): void {
  dependencies.forEach((d) => injector.add(d));
}

/**
 * Touch a group of dependencies to ensure they are instantiated.
 * @param injector The injector to touch the dependencies.
 * @param dependencies The dependencies to touch.
 */
export function touchDependencies(injector: Injector, dependencies: [DependencyIdentifier<unknown>][]): void {
  dependencies.forEach(([d]) => {
    if (injector.has(d)) {
      injector.get(d);
    }
  });
}
