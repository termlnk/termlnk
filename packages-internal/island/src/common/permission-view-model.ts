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

import type { IPermissionRequestPayload } from '@termlnk/agent';

/**
 * Maximum length for the primary-target text rendered alongside the tool
 * tag in the permission header. Long values get middle-ellipsised.
 */
const PRIMARY_TARGET_MAX = 60;

/**
 * View-model consumed by `PermissionRequestView`. Permission-only now —
 * AskUserQuestion no longer surfaces a picker in the island, so the
 * view-model only needs to cover the classic allow/deny shape.
 */
export interface IPermissionViewModel {
  readonly request: IPermissionRequestPayload;
  /**
   * Short inline string rendered next to the tool name (command, URL,
   * file, …). `undefined` when there is no sensible primary target.
   */
  readonly primaryTarget: string | undefined;
}

export function toPermissionViewModel(request: IPermissionRequestPayload): IPermissionViewModel {
  return {
    request,
    primaryTarget: getPrimaryTarget(request),
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
