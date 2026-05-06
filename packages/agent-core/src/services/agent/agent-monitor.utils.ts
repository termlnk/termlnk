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

import type { AgentSessionSource } from '@termlnk/agent';

/** How often to scan for zombie agent sessions (ms) */
export const ZOMBIE_CHECK_INTERVAL_MS = 30_000;

/**
 * Idle window after which a session lacking `agentPid` is evicted.
 * Fallback when PID-based zombie detection cannot apply — e.g. Codex emits
 * no `session-end` and no pid, and the helper's ppid-chain walk failed.
 */
export const SESSION_IDLE_GC_MS = 10 * 60 * 1000;

/** Config key shared with settings-ui for the Dynamic Island settings. */
export const ISLAND_SETTINGS_CONFIG_KEY = 'island.settings';

export interface IIslandSettingsStored {
  enabled?: boolean;
}

/**
 * Derive where an agent session is running from the sessionId on the event.
 *
 * - `internal`: the agent inherited a Termlnk-assigned session id from PTY
 *   env vars.
 * - `external`: the helper synthesized an `external-<hash>` id because no
 *   env was present, or a legacy payload arrived with a literal `unknown`
 *   (treat as external — best-effort tracking).
 */
export function resolveSource(sessionId: string): AgentSessionSource {
  if (!sessionId || sessionId === 'unknown' || sessionId.startsWith('external-')) {
    return 'external';
  }
  return 'internal';
}

export function truncate(str: string | undefined, maxLen: number): string {
  if (!str) {
    return '';
  }
  if (str.length <= maxLen) {
    return str;
  }
  return `${str.slice(0, maxLen)}...`;
}

/**
 * Detect "needs-input" keywords in notification payloads.
 */
export function isNeedsInputNotification(payload: Record<string, unknown>): boolean {
  const keywords = ['permission', 'approve', 'approval', 'input', 'attention'];
  const text = [
    payload.message as string,
    payload.body as string,
    payload.text as string,
    (payload.notification as Record<string, unknown>)?.message as string,
    payload.type as string,
  ].filter(Boolean).join(' ').toLowerCase();

  return keywords.some((kw) => text.includes(kw));
}
