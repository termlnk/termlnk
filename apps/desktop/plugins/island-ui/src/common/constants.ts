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

// ---------------------------------------------------------------------------
// Sound system
// ---------------------------------------------------------------------------

/** Minimum interval (ms) between two sounds of the same CESP category. */
export const SOUND_DEBOUNCE_MS = 500;

/** Window (ms) within which rapid-fire prompt submissions count toward spam detection. */
export const SPAM_WINDOW_MS = 10_000;

/** Number of task.acknowledge events within SPAM_WINDOW_MS to trigger user.spam. */
export const SPAM_THRESHOLD = 3;
