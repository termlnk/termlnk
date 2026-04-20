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

import type { IContributedConfiguration, IContributionPoint, IExtensionDescription } from '@termlnk/extension';
import type { z } from 'zod';
import { DisposableCollection, IConfigService, ILogService, toDisposable } from '@termlnk/core';
import { contributedConfigurationSchema } from '@termlnk/extension';

/**
 * `configuration` contribution point.
 *
 * Extension config keys are namespaced under `ext.<extension>.<key>` and
 * their default values are seeded into `IConfigService.registerConfig` only
 * when no prior user value exists. The returned disposable undoes the seeding
 * (restoring any previously-held value), which keeps configuration shape in
 * sync with which extensions are currently active.
 *
 * User-persisted values for the same keys live outside this contribution;
 * they are managed by the settings UI and survive extension deactivation.
 */
export class ConfigurationPoint implements IContributionPoint<IContributedConfiguration> {
  readonly name = 'configuration';
  readonly schema: z.ZodType<IContributedConfiguration> = contributedConfigurationSchema;

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {}

  apply(description: IExtensionDescription, value: IContributedConfiguration): ReturnType<IContributionPoint<IContributedConfiguration>['apply']> {
    const collection = new DisposableCollection();
    const prefix = `ext.${description.id}.`;

    for (const [key, prop] of Object.entries(value.properties)) {
      const fullKey = `${prefix}${key}`;
      const existing = this._configService.getConfig(fullKey);
      if ((existing === null || existing === undefined) && prop.default !== undefined) {
        collection.add(this._configService.registerConfig(fullKey, prop.default));
      }
      this._logService.debug(
        '[ConfigurationPoint]',
        `Registered config "${fullKey}" (type: ${prop.type}) from ${description.id}`
      );
    }

    return toDisposable(() => collection.dispose());
  }
}
