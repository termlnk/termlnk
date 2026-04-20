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
import type { IExtensionDescription } from '../models/extension-description';
import { createIdentifier } from '@termlnk/core';

/**
 * Registry that distributes manifest `contributes` slices into the
 * `IExtensionPointRegistry` for consumption by contribution adapters.
 *
 * The registry itself holds no business logic — it is only responsible for
 * enumerating the contributes object, locating the matching extension point,
 * validating the slice, and pushing the delta. Adapters do the real work.
 */
export interface IContributionRegistry {
  registerContributions(description: IExtensionDescription): IDisposable;
  unregisterContributions(extensionId: string): void;
}

export const IContributionRegistry = createIdentifier<IContributionRegistry>('extension.contribution-registry');
