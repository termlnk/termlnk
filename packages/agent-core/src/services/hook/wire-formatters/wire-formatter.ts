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

import type { IPermissionDecision } from '@termlnk/agent';

/**
 * Serialises a user's permission decision (allow / deny) into the response
 * body the agent's hook runtime expects on stdout.
 *
 * AskUserQuestion hooks no longer go through this path — they return `{}`
 * immediately in the hook server so each agent's CLI TUI handles the pick
 * natively. Only classic permission dialogs reach here.
 */
export interface IAgentWireFormatter {
  formatResponse(decision: IPermissionDecision): string;
}
