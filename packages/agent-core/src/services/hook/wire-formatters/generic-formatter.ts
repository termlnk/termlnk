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
import type { IAgentWireFormatter, IWireFormatContext } from './wire-formatter';
import { denyReasonFor } from './wire-formatter';

/**
 * Default wire formatter for agents without a documented AskUserQuestion
 * answer path (OpenCode, Codex, Kimi Code today). Encodes the decision as
 * the lowest-common-denominator `decision: 'block' | undefined` shape:
 *
 * - `allow` — empty object (accept).
 * - `deny` / `answer` — `{ decision: "block", reason: "…" }` so the
 *   assistant sees the reason as the tool_result and can read the user's
 *   selected label from the text.
 */
export class GenericWireFormatter implements IAgentWireFormatter {
  formatResponse(decision: IPermissionDecision, _ctx: IWireFormatContext): string {
    if (decision.kind === 'allow') {
      return '{}';
    }
    return JSON.stringify({ decision: 'block', reason: denyReasonFor(decision) });
  }
}
