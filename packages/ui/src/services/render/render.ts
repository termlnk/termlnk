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

import type { UnitType } from '@termlnk/core';
import type { Observable } from 'rxjs';

export interface IRender {
  id: string;
  type: UnitType;

  /**
   * Whether the render unit is activated. It should emit value when subscribed immediately.
   * When created, the render unit is activated by default.
   */
  activated$: Observable<boolean>;

  /**
   * Deactivate the render unit, means the render unit would be freezed and not updated,
   * even removed from the webpage. However, the render unit is still in the memory and
   * could be activated again.
   */
  deactivate(): void;

  /**
   * Activate the render unit, means the render unit would be updated and rendered.
   */
  activate(): void;
}
