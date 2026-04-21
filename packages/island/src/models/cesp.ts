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

// ---------------------------------------------------------------------------
// Island settings schema (shared by island-ui runtime + settings-ui panel)
// ---------------------------------------------------------------------------

export const ISLAND_SETTINGS_CONFIG_KEY = 'island.settings';

export interface IIslandSoundEventConfig {
  enabled: boolean;
}

export interface IIslandSoundConfig {
  enabled: boolean;
  volume: number;

  // Session events
  sessionStart: IIslandSoundEventConfig;
  taskComplete: IIslandSoundEventConfig;
  taskError: IIslandSoundEventConfig;

  // Interaction events
  needsApproval: IIslandSoundEventConfig;
  taskConfirmed: IIslandSoundEventConfig;

  // System events
  contextLimit: IIslandSoundEventConfig;
  rapidSubmitDetection: IIslandSoundEventConfig;
}

/**
 * Default sound config applied on first install and whenever a field is missing
 * from the persisted settings payload.
 */
export const DEFAULT_ISLAND_SOUND_CONFIG: IIslandSoundConfig = {
  enabled: true,
  volume: 25,
  sessionStart: { enabled: true },
  taskComplete: { enabled: true },
  taskError: { enabled: true },
  needsApproval: { enabled: true },
  taskConfirmed: { enabled: true },
  contextLimit: { enabled: true },
  rapidSubmitDetection: { enabled: true },
};

/** Outer settings payload persisted under {@link ISLAND_SETTINGS_CONFIG_KEY}. */
export interface IIslandSettings {
  enabled: boolean;
  sound: IIslandSoundConfig;
}

function normalizeSoundEvent(
  value: Partial<IIslandSoundEventConfig> | null | undefined,
  fallback: IIslandSoundEventConfig
): IIslandSoundEventConfig {
  if (!value) {
    return { ...fallback };
  }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
  };
}

/** Fill missing fields on a persisted sound config with {@link DEFAULT_ISLAND_SOUND_CONFIG}. */
export function normalizeIslandSoundConfig(
  value: Partial<IIslandSoundConfig> | null | undefined
): IIslandSoundConfig {
  if (!value) {
    return { ...DEFAULT_ISLAND_SOUND_CONFIG };
  }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_ISLAND_SOUND_CONFIG.enabled,
    volume: typeof value.volume === 'number' ? Math.max(0, Math.min(100, value.volume)) : DEFAULT_ISLAND_SOUND_CONFIG.volume,
    sessionStart: normalizeSoundEvent(value.sessionStart, DEFAULT_ISLAND_SOUND_CONFIG.sessionStart),
    taskComplete: normalizeSoundEvent(value.taskComplete, DEFAULT_ISLAND_SOUND_CONFIG.taskComplete),
    taskError: normalizeSoundEvent(value.taskError, DEFAULT_ISLAND_SOUND_CONFIG.taskError),
    needsApproval: normalizeSoundEvent(value.needsApproval, DEFAULT_ISLAND_SOUND_CONFIG.needsApproval),
    taskConfirmed: normalizeSoundEvent(value.taskConfirmed, DEFAULT_ISLAND_SOUND_CONFIG.taskConfirmed),
    contextLimit: normalizeSoundEvent(value.contextLimit, DEFAULT_ISLAND_SOUND_CONFIG.contextLimit),
    rapidSubmitDetection: normalizeSoundEvent(value.rapidSubmitDetection, DEFAULT_ISLAND_SOUND_CONFIG.rapidSubmitDetection),
  };
}
