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

import type { Dependency, DependencyIdentifier, DependencyItem } from '../../common/di';

export type NullableDependencyPair<T> = [DependencyIdentifier<T>, DependencyItem<T> | null];

/**
 * Overrides the dependencies defined in the plugin. Only dependencies that are identified by `IdentifierDecorator` can be overridden.
 * If you override a dependency with `null`, the original dependency will be removed.
 */
export type DependencyOverride = NullableDependencyPair<any>[];

export function mergeOverrideWithDependencies(dependencies: Dependency[], override?: DependencyOverride): Dependency[] {
  if (!override) return dependencies;

  const result: Dependency[] = [];
  for (const dependency of dependencies) {
    const overrideItem = override.find(([identifier]) => identifier === dependency[0]);
    if (overrideItem) {
      if (overrideItem[1] === null) continue;
      result.push([dependency[0], overrideItem[1]]);
    } else {
      result.push(dependency);
    }
  }

  return result;
}
