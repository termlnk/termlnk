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

import type { RequestPermissionRequest } from '@agentclientprotocol/sdk';
import type { IACPPermissionOption, IACPPermissionRequest } from '@termlnk/acp';

export function translatePermissionRequest(
  sessionId: string,
  requestId: string,
  params: RequestPermissionRequest
): IACPPermissionRequest {
  const options: IACPPermissionOption[] = (params.options ?? []).map((opt) => ({
    optionId: opt.optionId,
    name: opt.name,
    kind: opt.kind,
  }));

  return {
    requestId,
    sessionId,
    toolCallId: params.toolCall.toolCallId,
    toolName: params.toolCall.name || params.toolCall.title || params.toolCall.kind || 'tool',
    title: params.toolCall.title ?? undefined,
    options,
    input: params.toolCall.rawInput,
    createdAt: Date.now(),
  };
}
