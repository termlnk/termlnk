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

import type { IAgentToolPermissionRequest } from '@termlnk/agent';

const HIGHLIGHT_FALLBACK_KEYS = ['command', 'path', 'url', 'host'] as const;

export function pickPermissionHighlight(
  request: IAgentToolPermissionRequest
): { field: string; value: string } | null {
  if (request.highlight) {
    return request.highlight;
  }
  const input = request.input;
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const obj = input as Record<string, unknown>;
  for (const key of HIGHLIGHT_FALLBACK_KEYS) {
    const v = obj[key];
    if (typeof v === 'string' && v) {
      return { field: key, value: v };
    }
  }
  return null;
}
