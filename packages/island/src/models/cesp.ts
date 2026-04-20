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

/**
 * CESP (Coding Event Sound Pack) event categories.
 *
 * Based on the CESP v1.0 specification (https://openpeon.com/spec).
 * Defines 9 standard event categories for coding tools.
 */
export enum CespEventCategory {
  // Core categories (6) — players MUST support all
  SessionStart = 'session.start',
  TaskAcknowledge = 'task.acknowledge',
  TaskComplete = 'task.complete',
  TaskError = 'task.error',
  InputRequired = 'input.required',
  ResourceLimit = 'resource.limit',

  // Extended categories (3) — players MAY support
  UserSpam = 'user.spam',
  SessionEnd = 'session.end',
  TaskProgress = 'task.progress',
}

/**
 * A single CESP event emitted by the island state service.
 */
export interface ICespEvent {
  /** CESP event category */
  readonly category: CespEventCategory;
  /** Terminal session ID that triggered this event */
  readonly sessionId: string;
  /** Event timestamp (ms since epoch) */
  readonly timestamp: number;
}

/**
 * CESP categories that have built-in sound files.
 * Excludes `session.end` and `task.progress` which have no audio.
 */
export const CESP_SOUND_CATEGORIES: readonly CespEventCategory[] = [
  CespEventCategory.SessionStart,
  CespEventCategory.TaskAcknowledge,
  CespEventCategory.TaskComplete,
  CespEventCategory.TaskError,
  CespEventCategory.InputRequired,
  CespEventCategory.ResourceLimit,
  CespEventCategory.UserSpam,
];
