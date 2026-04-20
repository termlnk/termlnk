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

import { isMacintosh } from '@termlnk/core';

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

export interface IIslandSettings {
  enabled: boolean;
  sound: IIslandSoundConfig;
}

const DEFAULT_SOUND_CONFIG: IIslandSoundConfig = {
  enabled: true,
  volume: 25,
  sessionStart: { enabled: true },
  taskComplete: { enabled: true },
  taskError: { enabled: true },
  needsApproval: { enabled: true },
  taskConfirmed: { enabled: false },
  contextLimit: { enabled: true },
  rapidSubmitDetection: { enabled: false },
};

const DEFAULT_ISLAND_SETTINGS: IIslandSettings = {
  enabled: isMacintosh,
  sound: { ...DEFAULT_SOUND_CONFIG },
};

function normalizeSoundEventConfig(value: Partial<IIslandSoundEventConfig> | null | undefined, fallback: IIslandSoundEventConfig): IIslandSoundEventConfig {
  if (!value) {
    return { ...fallback };
  }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
  };
}

function normalizeSoundConfig(value: Partial<IIslandSoundConfig> | null | undefined): IIslandSoundConfig {
  if (!value) {
    return { ...DEFAULT_SOUND_CONFIG };
  }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SOUND_CONFIG.enabled,
    volume: typeof value.volume === 'number' ? Math.max(0, Math.min(100, value.volume)) : DEFAULT_SOUND_CONFIG.volume,
    sessionStart: normalizeSoundEventConfig(value.sessionStart, DEFAULT_SOUND_CONFIG.sessionStart),
    taskComplete: normalizeSoundEventConfig(value.taskComplete, DEFAULT_SOUND_CONFIG.taskComplete),
    taskError: normalizeSoundEventConfig(value.taskError, DEFAULT_SOUND_CONFIG.taskError),
    needsApproval: normalizeSoundEventConfig(value.needsApproval, DEFAULT_SOUND_CONFIG.needsApproval),
    taskConfirmed: normalizeSoundEventConfig(value.taskConfirmed, DEFAULT_SOUND_CONFIG.taskConfirmed),
    contextLimit: normalizeSoundEventConfig(value.contextLimit, DEFAULT_SOUND_CONFIG.contextLimit),
    rapidSubmitDetection: normalizeSoundEventConfig(value.rapidSubmitDetection, DEFAULT_SOUND_CONFIG.rapidSubmitDetection),
  };
}

export function normalizeIslandSettings(value: Partial<IIslandSettings> | null): IIslandSettings {
  if (!value) {
    return { ...DEFAULT_ISLAND_SETTINGS, sound: { ...DEFAULT_SOUND_CONFIG } };
  }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_ISLAND_SETTINGS.enabled,
    sound: normalizeSoundConfig(value.sound),
  };
}
