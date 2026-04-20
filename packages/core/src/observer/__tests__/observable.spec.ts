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

import { describe, expect, it } from 'vitest';
import { EventState } from '../observable';

describe('EventState', () => {
  it('should initialize with skipNextObservers set to false', () => {
    const eventState = new EventState();
    expect(eventState.skipNextObservers).toBe(false);
  });

  it('should allow stopPropagation to be set', () => {
    const eventState = new EventState();
    eventState.stopPropagation();
    expect(eventState.isStopPropagation).toBe(true);
  });
});
