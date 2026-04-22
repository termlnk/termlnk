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

import type { Observable } from 'rxjs';
import type { AgentHookEventType, ExternalAgentType, IAgentHookDefinition, IAskUserQuestion, IAskUserQuestionSet, IPermissionDecision } from '../models/agent-hook';

/**
 * Individual adapter interface for external AI agent hook integration.
 *
 * Each agent (Claude Code, Codex, Cursor, etc.) gets one adapter
 * implementation that encapsulates all agent-specific hook protocol knowledge.
 *
 * Adapters are **not** DI-registered singletons — they are managed as
 * instances by {@link IAgentHookRegistryService}.
 */
export interface IAgentHookAdapter {
  /** Which agent this adapter handles */
  readonly agentType: ExternalAgentType;

  /** Declarative definition for this agent */
  readonly definition: IAgentHookDefinition;

  /** Whether hooks are currently installed for this agent */
  readonly installed$: Observable<boolean>;

  /**
   * Install hooks into the agent's configuration.
   *
   * - Config-file agents: writes to `~/.agent/hooks.json`
   * - Wrapper-script agents: writes wrapper to `<configPath>/bin/`
   * - Plugin agents: writes plugin to `~/.config/opencode/plugins/`
   *
   * @param port - the HTTP hook server port
   * @param token - the bearer token for authentication
   */
  install(port: number, token: string): Promise<void>;

  /**
   * Uninstall hooks from the agent's configuration.
   * Removes or reverts the hook entries added by {@link install}.
   */
  uninstall(): Promise<void>;

  /**
   * Check if the agent is available on this system.
   * E.g., does `~/.codex/` exist? Is the `claude` binary in PATH?
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get environment variables that should be injected into PTY sessions
   * for this adapter to function.
   *
   * @param sessionId - PTY session ID for correlation
   * @param port - HTTP hook server port
   * @param token - bearer token
   */
  getEnvOverrides(sessionId: string, port: number, token: string): Record<string, string>;

  /**
   * Map an agent-specific event name to the unified termlnk event type.
   * Returns `undefined` if the event is not recognized (noop).
   */
  mapEvent(agentEventName: string): AgentHookEventType | undefined;

  /**
   * Parse an {@link IAskUserQuestionSet} out of a tool input for this agent,
   * or return `null` when the tool is not an AskUserQuestion-style picker.
   * Used by the hook server to decide between the "permission" and
   * "question" blocking paths without embedding agent-specific knowledge.
   *
   * Adapters normalise across Claude `AskUserQuestion`, Codex
   * `request_user_input`, Kimi `AskUserQuestion`, and opencode `question`.
   * Each question gets a stable `id` (agent-native when available, else
   * `idx-<n>`) so answers key back by index rather than by raw question
   * text.
   */
  parseQuestion(toolName: string, toolInput: Record<string, unknown>): IAskUserQuestionSet | null;

  /**
   * Serialise a user decision into the response body this agent's hook
   * runtime expects. The helper echoes whatever the server returns straight
   * back to stdout, so this method fully owns agent-specific wire format.
   *
   * `context.isQuestion` flips on when the originating request was an
   * AskUserQuestion-style picker — enables multi-question answer maps
   * (Claude `updatedInput.answers`, Codex `answers[id]`, …). `question`
   * is the deprecated single-question alias; new formatters should prefer
   * `questionSet`.
   */
  formatResponse(
    decision: IPermissionDecision,
    context: {
      readonly isQuestion: boolean;
      readonly toolInput?: Record<string, unknown>;
      readonly question?: IAskUserQuestion;
      readonly questionSet?: IAskUserQuestionSet;
    },
  ): string;

  /** Dispose resources held by this adapter */
  dispose(): void;
}
