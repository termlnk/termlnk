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

export type CompactTrigger = 'manual' | 'auto';

export interface ICompactConfig {
  enabled: boolean;
  thresholdPercent: number;
  keepRecentMessages: number;
}

export interface ICompactMetadata {
  trigger: CompactTrigger;
  preTokens: number;
  messagesSummarized: number;
  summary: string;
  userInstructions?: string;
}

export interface ICompactOptions {
  trigger: CompactTrigger;
  instructions?: string;
}

export const COMPACT_CONFIG_MIN_THRESHOLD_PERCENT = 5;
export const COMPACT_CONFIG_MAX_THRESHOLD_PERCENT = 95;
export const COMPACT_CONFIG_MIN_KEEP_RECENT = 2;
export const COMPACT_CONFIG_MAX_KEEP_RECENT = 20;

export const DEFAULT_COMPACT_CONFIG: ICompactConfig = {
  enabled: true,
  thresholdPercent: 80,
  keepRecentMessages: 4,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function normalizeCompactConfig(
  input: Partial<ICompactConfig> | null | undefined
): ICompactConfig {
  if (!input) {
    return { ...DEFAULT_COMPACT_CONFIG };
  }
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_COMPACT_CONFIG.enabled,
    thresholdPercent: clamp(
      Math.round(input.thresholdPercent ?? DEFAULT_COMPACT_CONFIG.thresholdPercent),
      COMPACT_CONFIG_MIN_THRESHOLD_PERCENT,
      COMPACT_CONFIG_MAX_THRESHOLD_PERCENT
    ),
    keepRecentMessages: clamp(
      Math.round(input.keepRecentMessages ?? DEFAULT_COMPACT_CONFIG.keepRecentMessages),
      COMPACT_CONFIG_MIN_KEEP_RECENT,
      COMPACT_CONFIG_MAX_KEEP_RECENT
    ),
  };
}
