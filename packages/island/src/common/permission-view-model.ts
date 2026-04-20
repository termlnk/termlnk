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

import type { IAskUserQuestionRequestPayload, IPendingInteractionPayload, IPermissionRequestPayload } from '@termlnk/agent';

/**
 * Maximum length for the primary-target text rendered alongside the tool
 * tag in the permission header. Long values get middle-ellipsised.
 */
const PRIMARY_TARGET_MAX = 60;

/**
 * View-model shape consumed by `PermissionRequestView`. Keeps the React
 * component pure — it just renders the fields, all derivation lives here.
 */
export interface IPermissionViewModel {
  readonly request: IPendingInteractionPayload;
  /**
   * Short inline string rendered next to the tool name (command, URL,
   * file, …). `undefined` when there is no sensible primary target.
   */
  readonly primaryTarget: string | undefined;
  /** Total option count, 0 when the request is not an AskUserQuestion. */
  readonly optionCount: number;
  /** Convenience: true when this is a structured AskUserQuestion. */
  readonly isQuestion: boolean;
}

export function toPermissionViewModel(request: IPendingInteractionPayload): IPermissionViewModel {
  const isQuestion = request.kind === 'question';
  return {
    request,
    primaryTarget: isQuestion ? undefined : getPrimaryTarget(request),
    optionCount: isQuestion ? (request as IAskUserQuestionRequestPayload).question.options.length : 0,
    isQuestion,
  };
}

/**
 * Extract a short, identifier-like target for the permission header.
 *
 * Each tool family has a canonical "what is this tool about?" field:
 * Bash → command, WebFetch → url, Read/Edit/Write → filename. The island
 * renders it in monospace next to the tool name so users can scan the
 * intent without opening the approval body.
 */
function getPrimaryTarget(request: IPermissionRequestPayload): string | undefined {
  const { toolName, toolInput } = request;
  switch (toolName) {
    case 'Bash': {
      const cmd = asString(toolInput.command);
      return cmd ? truncateMiddle(cmd, PRIMARY_TARGET_MAX) : undefined;
    }
    case 'WebFetch':
      return asString(toolInput.url);
    case 'WebSearch':
      return asString(toolInput.query);
    case 'Glob':
    case 'Grep':
      return asString(toolInput.pattern);
    default: {
      const fp = asString(toolInput.file_path);
      if (!fp) {
        return undefined;
      }
      return fp.split('/').pop() || fp;
    }
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function truncateMiddle(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}…`;
}
