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

import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core';
import type { AgentToolCategory, IAgentToolPermissionService, IGuardMetadata } from '@termlnk/agent';

/** Lookup back from a wrapped tool to its raw counterpart for D1 user-initiated bypass. */
const _RAW_BY_WRAPPED = new WeakMap<AgentTool, AgentTool>();

export interface IPermissionWrapContext {
  /** Provides the active chat session id at execution time. */
  getSessionId: () => string | null;
  permissionService: IAgentToolPermissionService;
  category: AgentToolCategory;
  metadata?: IGuardMetadata;
  /** Computes per-call metadata (e.g. SSH session type from input). */
  resolveMetadata?: (input: unknown) => IGuardMetadata | undefined;
}

/**
 * Wraps a pi-agent-core AgentTool with permission gating. The returned tool
 * delegates to permissionService.guard() before invoking the underlying
 * execute(). On 'deny', returns a structured tool error without calling raw.
 */
export function wrapToolWithPermission(raw: AgentTool, ctx: IPermissionWrapContext): AgentTool {
  const wrapped: AgentTool = {
    ...raw,
    execute: async (toolCallId, params, signal, onUpdate): Promise<AgentToolResult<unknown>> => {
      const sessionId = ctx.getSessionId() ?? '';
      const metadata = ctx.resolveMetadata
        ? { ...(ctx.metadata ?? {}), ...ctx.resolveMetadata(params) }
        : ctx.metadata;

      const guardResult = await ctx.permissionService.guard({
        sessionId,
        toolCallId,
        toolName: raw.name,
        toolCategory: ctx.category,
        input: params,
        signal,
        metadata,
      });

      if (guardResult.decision === 'deny') {
        return {
          content: [{ type: 'text', text: `[Permission denied] ${guardResult.reason}` }],
          details: { permissionDenied: true, reason: guardResult.reason } as unknown,
        };
      }

      const finalParams = (guardResult.updatedInput as typeof params | undefined) ?? params;
      return raw.execute(toolCallId, finalParams, signal, onUpdate);
    },
  };

  _RAW_BY_WRAPPED.set(wrapped, raw);
  return wrapped;
}

/**
 * Bypasses the permission guard and runs the underlying raw tool directly.
 * Used by AIAgentService.invokeTool() to honour the D1 decision: explicit
 * user-initiated invocations skip approval.
 *
 * If the given tool is not a wrapped tool, falls back to its execute().
 */
export function invokeWithUserIntent(
  wrapped: AgentTool,
  toolCallId: string,
  args: unknown
): Promise<AgentToolResult<unknown>> {
  const raw = _RAW_BY_WRAPPED.get(wrapped) ?? wrapped;
  return raw.execute(toolCallId, args as Parameters<AgentTool['execute']>[1]);
}
