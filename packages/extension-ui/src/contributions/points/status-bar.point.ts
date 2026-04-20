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

import type { IContributedStatusBarItem, IContributionPoint, IExtensionDescription } from '@termlnk/extension';
import type { z } from 'zod';
import { DisposableCollection, toDisposable } from '@termlnk/core';
import { contributedStatusBarSchema } from '@termlnk/extension';
import { IStatusBarService } from '@termlnk/ui';

/**
 * `statusBar` contribution point.
 *
 * Each item is forwarded to the host `IStatusBarService`, namespacing ids
 * under `ext.<extension>.<id>` to prevent collisions between extensions
 * and between extensions and built-in plugins.
 */
export class StatusBarPoint implements IContributionPoint<IContributedStatusBarItem[]> {
  readonly name = 'statusBar';
  readonly schema: z.ZodType<IContributedStatusBarItem[]> = contributedStatusBarSchema;

  constructor(
    @IStatusBarService private readonly _statusBarService: IStatusBarService
  ) {}

  apply(description: IExtensionDescription, items: IContributedStatusBarItem[]): ReturnType<IContributionPoint<IContributedStatusBarItem[]>['apply']> {
    const collection = new DisposableCollection();
    for (const item of items) {
      const namespacedId = `ext.${description.id}.${item.id}`;
      collection.add(this._statusBarService.registerItem({
        ...item,
        id: namespacedId,
      }));
    }
    return toDisposable(() => collection.dispose());
  }
}
