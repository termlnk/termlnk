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

import type { Observable } from 'rxjs';
import type { IIslandState } from '../models/island-state';
import { createIdentifier } from '@termlnk/core';

/**
 * Island state service. Computes unified island display state from
 * agent monitor sessions and permission requests.
 */
export interface IIslandStateService {
  /** Computed island state stream */
  readonly state$: Observable<IIslandState>;
}

export const IIslandStateService = createIdentifier<IIslandStateService>(
  'island.island-state-service'
);
