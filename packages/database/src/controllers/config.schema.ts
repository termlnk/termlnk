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

import type { Ctor, DependencyOverride } from '@termlnk/core';
import type { IDBAdaptorService } from '../services/db-adaptor.service';

export const DATABASE_PLUGIN_CONFIG_KEY = 'database.config';

export const configSymbol = Symbol(DATABASE_PLUGIN_CONFIG_KEY);

export interface IDatabaseConfig {
  override?: DependencyOverride;

  dbAdaptor?: Ctor<IDBAdaptorService>;
  migrationsFolder?: string;
}

export const defaultPluginConfig: IDatabaseConfig = {};
