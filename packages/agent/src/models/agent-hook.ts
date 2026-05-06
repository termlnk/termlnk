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

/**
 * Known external AI agents that can be monitored via hooks.
 */
export type ExternalAgentType =
  | 'claude-code'
  | 'codex'
  | 'cursor'
  | 'gemini'
  | 'copilot'
  | 'codebuddy'
  | 'opencode'
  | 'kimi-code'
  | 'unknown';

/**
 * Hook event types fired by external agents.
 *
 * Organised into four tiers so the monitor/UI can discriminate by need:
 *
 * - **Lifecycle**: session begin/end, per-turn boundaries, compaction.
 * - **Tool**: pre / post / post-failure — pure monitoring, non-blocking.
 * - **Blocking Q&A**: `ask-user-question` unifies every agent's "AI needs a
 *   structured answer" case; `permission-request` is the generic approval
 *   dialog. Both pause the agent until the user resolves the pending
 *   interaction via `IAgentHookServerService.respondPermission`.
 * - **Ambient**: notification / subagent lifecycle / MCP elicitation —
 *   low-value signals kept for future UI integrations.
 */
export type AgentHookEventType =
  // Lifecycle
  | 'session-start'
  | 'session-end'
  | 'prompt-submit'
  | 'stop'
  | 'stop-failure'
  | 'pre-compact'
  | 'post-compact'
  // Tool monitoring
  | 'pre-tool-use'
  | 'post-tool-use'
  | 'post-tool-use-failure'
  // Blocking Q&A
  | 'permission-request'
  | 'ask-user-question'
  // Ambient
  | 'notification'
  | 'subagent-start'
  | 'subagent-stop'
  | 'elicitation';

/**
 * Agent session status.
 */
export type AgentSessionStatus =
  | 'running'
  | 'idle'
  | 'needs-input'
  | 'waiting-approval'
  | 'compacting'
  | 'stopped';

/** Tri-state lifecycle of a task entry. */
export type AgentTodoStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Single entry in the session-level task plan. Normalized across Claude Code,
 * Kimi Code and OpenCode so the Dynamic Island can render a uniform todo list.
 */
export interface IAgentTodo {
  /** Stable id; agents that emit unordered lists get a synthetic `idx-<n>` id. */
  readonly id: string;

  /** Primary text (Claude `content` / Kimi `title` / OpenCode `text`). */
  readonly content: string;

  readonly status: AgentTodoStatus;

  /** Present-continuous phrasing (Claude Code only); shown while `in_progress`. */
  readonly activeForm?: string;
}

/**
 * Helper-collected metadata carried by hook events dispatched from external
 * terminals (iTerm, Ghostty, system Terminal, ...). Populated by
 * `@termlnk/agent-hook-cli`'s helper before POSTing to `/hook`, so the
 * monitor can correlate multiple external agent invocations to distinct
 * terminal windows without relying on a termlnk-injected session id.
 */
export interface IAgentHookEventMeta {
  /** PID of the process that invoked the helper (usually the agent CLI) */
  readonly ppid: number;

  /** Best-effort agent CLI pid; helper walks the ppid chain to skip shell wrappers. Undefined when not identifiable. */
  readonly agentPid?: number;

  /** Controlling TTY path (e.g., `/dev/ttys001`); empty when unavailable */
  readonly tty: string;

  /** Current working directory of the invoking shell */
  readonly cwd: string;

  /** `$TERM_PROGRAM` from the host terminal (e.g., `iTerm.app`, `ghostty`) */
  readonly termProgram: string;
}

/**
 * Payload for an agent hook event received via HTTP.
 */
export interface IAgentHookEvent {
  /** Which event occurred */
  readonly event: AgentHookEventType;

  /**
   * termlnk PTY session ID (injected via TERMLNK_SESSION_ID), or a
   * synthesized `external-<hash>` id produced by the hook helper when the
   * agent is running outside a termlnk PTY.
   */
  readonly sessionId: string;

  /** Agent-assigned session/conversation ID (optional) */
  readonly agentSessionId?: string;

  /** Which agent sent this */
  readonly agent: ExternalAgentType;

  /** Timestamp (ISO 8601) */
  readonly timestamp: string;

  /** Event-specific payload from the agent */
  readonly payload?: Record<string, unknown>;

  /**
   * Hook-helper-collected metadata. Present only for events dispatched
   * through `@termlnk/agent-hook-cli`; absent for legacy direct-curl events.
   */
  readonly meta?: IAgentHookEventMeta;
}

/**
 * Source of an agent session.
 *
 * - `internal`: the agent was started from a Termlnk PTY tab (the helper
 *   inherited `TERMLNK_SESSION_ID` via env vars).
 * - `external`: the agent was started from a terminal outside Termlnk (iTerm,
 *   system Terminal, VS Code integrated terminal, ...). Discovered via the
 *   shared `<configPath>/runtime.json` file and tracked using a synthesized
 *   `external-<hash>` session id.
 */
export type AgentSessionSource = 'internal' | 'external';

/**
 * Tracked external agent session state.
 */
export interface IExternalAgentSession {
  /**
   * termlnk PTY session ID, or `external-<hash>` for agents running in
   * terminals outside termlnk.
   *
   * Stable transport-layer identifier — used by the UI as a React key and
   * by `IPermissionRequestPayload` to correlate requests. For internal
   * routing inside `AgentMonitorService`, prefer `agentSessionId` (agent-
   * native) as the canonical key to avoid duplicates when the helper's
   * fallback fingerprint would otherwise change.
   */
  readonly terminalSessionId: string;

  /** Detected agent type */
  readonly agent: ExternalAgentType;

  /**
   * Whether the session was started inside a termlnk PTY or picked up
   * from an external terminal via the discovery file.
   */
  readonly source: AgentSessionSource;

  /** Current status */
  status: AgentSessionStatus;

  /** When the agent session started */
  readonly startedAt: number;

  /** Last event timestamp */
  lastEventAt: number;

  /**
   * Agent-assigned session ID. When present, serves as the canonical key
   * inside `AgentMonitorService._sessionMap` so that transient transport-
   * layer id changes (e.g. helper fingerprint shifts) don't create ghost
   * session entries. May be absent for adapters that don't propagate the
   * agent's native id (e.g. OpenCode `permission.ask`).
   */
  readonly agentSessionId?: string;

  /** Working directory reported by the agent */
  cwd?: string;

  /** PID of the agent process (for stale session detection) */
  agentPid?: number;

  /**
   * Most recent tool invocation in this turn. Kept until the next
   * `pre-tool-use` overwrites it or `user-prompt-submit` starts a new turn
   * — NOT cleared on `post-tool-use` or `stop`, so the island keeps showing
   * the last action after the agent finishes talking.
   */
  lastToolName?: string;

  /** Human-readable description of the most recent tool action. */
  lastToolDescription?: string;

  /**
   * Raw detail (no "Running" prefix, no backticks). Bash → command text;
   * Edit/Write/Read → file name; WebSearch → query. Rendered beside a
   * tool-name tag.
   */
  lastToolDetail?: string;

  /**
   * Task plan projected from the agent's todo-list tool calls by
   * `AgentMonitorService._onPreToolUse` (full replace or id-patch depending
   * on the tool). Preserved across `session-start` resumes.
   */
  todos?: IAgentTodo[];

  /** The last user prompt text (from prompt-submit payload) */
  lastPrompt?: string;

  /**
   * Session title — the first user prompt, set once and preserved across
   * resume (not overwritten by subsequent prompts).
   */
  title?: string;

  /** Project identifier (cwd basename). Used as a prefix in the island title. */
  project?: string;

  /** Helper-collected metadata for external sessions. */
  externalMeta?: IAgentHookEventMeta;
}

// ---------------------------------------------------------------------------
// Hook adapter definitions
// ---------------------------------------------------------------------------

/**
 * Hook format used by each agent's configuration.
 *
 * - `flat`: Cursor-style `{ "event": [{"command": "..."}] }`
 * - `nested`: Codex/Gemini/Copilot-style nested with type/command/timeout.
 *   `defaultTimeoutSec` is the per-hook cancellation timeout in **seconds**
 *   that we write into the agent's config file (Claude Code / Codex / Kimi
 *   all document the `timeout` field in seconds).
 * - `plugin-config`: OpenCode / Kimi / custom plugin systems — the adapter
 *   writes its own scripted config and ignores the format defaults.
 */
export type AgentHookFormat =
  | { readonly type: 'flat' }
  | { readonly type: 'nested'; readonly defaultTimeoutSec: number }
  | { readonly type: 'plugin-config' };

/**
 * Maps an agent-native event name to termlnk's unified event type.
 */
export interface IAgentHookEventMapping {
  /** The event name as the agent knows it (e.g., "SessionStart", "beforeSubmitPrompt") */
  readonly agentEvent: string;

  /** The termlnk-normalized event type */
  readonly termlnkEvent: AgentHookEventType;

  /**
   * Glob / regex matcher scoped by the agent's own matcher semantics
   * (tool name for Claude/Kimi, source for SessionStart, etc.).
   */
  readonly matcher?: string;

  /** Per-event timeout override, in seconds. */
  readonly timeoutSec?: number;

  /** Run hook asynchronously (does not block agent) */
  readonly async?: boolean;

  /**
   * Blocking hook — waits for user response before returning to agent.
   *
   * The helper will POST to a blocking endpoint (`/hook/permission` or
   * `/hook/ask-user-question` depending on the `termlnkEvent`) and stream
   * the server's JSON decision straight back to stdout so the agent can
   * consume it as its own hook response.
   */
  readonly blocking?: boolean;
}

/**
 * Declarative configuration for a single agent's hook integration.
 */
export interface IAgentHookDefinition {
  /** Machine name: "claude-code", "codex", "cursor", etc. */
  readonly name: ExternalAgentType;

  /** Human-readable display name: "Claude Code", "Codex", etc. */
  readonly displayName: string;

  /** Config directory relative to home: ".codex", ".cursor", ".gemini" */
  readonly configDir: string;

  /** Config file name within configDir: "hooks.json", "settings.json" */
  readonly configFile: string;

  /** Environment variable that overrides configDir (e.g., "CODEX_HOME") */
  readonly configDirEnvOverride?: string;

  /** Environment variable to disable hooks for this agent */
  readonly disableEnvVar: string;

  /** Hook format for this agent */
  readonly format: AgentHookFormat;

  /** Event mappings: agent-specific event names -> termlnk unified events */
  readonly events: readonly IAgentHookEventMapping[];
}

// ---------------------------------------------------------------------------
// Pending interactions (permission request / AskUserQuestion)
// ---------------------------------------------------------------------------

/**
 * Minimal descriptor for an AskUserQuestion hook event.
 *
 * The Dynamic Island renders the pet's Question state when any
 * AskUserQuestion-style tool is pending; it does NOT present a picker
 * because every supported agent (Claude Code / Codex / Kimi / OpenCode)
 * renders its own CLI TUI and cannot accept a hook-delivered answer while
 * the TUI is live. Consequently, we parse only the metadata needed to
 * identify the question (id + question text + optional header) and drop
 * options / multiSelect / allowCustom / isSecret.
 */
export interface IAskUserQuestion {
  readonly id: string;
  readonly question: string;
  readonly header?: string;
}

/**
 * 1-N questions bundled in a single AskUserQuestion-style tool call.
 * The 4 supported agents all allow up to 4 questions per invocation.
 */
export interface IAskUserQuestionSet {
  readonly questions: readonly IAskUserQuestion[];
}

/**
 * Discriminator for the two blocking interaction kinds. Picking by kind
 * drives the island scene (approval vs. question) and the wire-formatter
 * selection in the hook server.
 */
export type PendingInteractionKind = 'permission' | 'question';

/** Common fields shared by every pending interaction. */
interface IPendingInteractionBase {
  /** Unique ID for this request (generated by termlnk, used to correlate response) */
  readonly requestId: string;

  /** Tool being requested */
  readonly toolName: string;

  /** Tool input parameters as seen by the agent (kept raw for wire formatting) */
  readonly toolInput: Record<string, unknown>;

  /** Tool use ID from the agent, when the agent supplies one */
  readonly toolUseId?: string;

  /** The terminal session this request originated from */
  readonly terminalSessionId: string;

  /** The agent type */
  readonly agent: ExternalAgentType;

  /**
   * Whether the session originated inside termlnk or from an external
   * terminal — drives the `External` marker in the island permission UI.
   */
  readonly source: AgentSessionSource;

  /** Timestamp of the request (ms since epoch) */
  readonly timestamp: number;
}

/** Classic "approve / deny" request (shell command, edit, web fetch, …). */
export interface IPermissionRequestPayload extends IPendingInteractionBase {
  readonly kind: 'permission';
}

/** AskUserQuestion hook pending — island shows a visual hint only, no picker. */
export interface IAskUserQuestionRequestPayload extends IPendingInteractionBase {
  readonly kind: 'question';
  /** Parsed metadata for logging / future use; the island UI does not read it. */
  readonly questionSet: IAskUserQuestionSet;
}

/** Union rendered by the island UI. */
export type IPendingInteractionPayload =
  | IPermissionRequestPayload
  | IAskUserQuestionRequestPayload;

/**
 * The user's decision for a pending interaction.
 *
 * AskUserQuestion hooks no longer accept a decision — the agent's CLI TUI
 * is the sole responder. The island only renders allow/deny for classic
 * permission dialogs (Bash / Edit / WebFetch / …).
 */
export type IPermissionDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny' };

/**
 * Response to a pending interaction (permission or question).
 */
export interface IPermissionResponsePayload {
  readonly requestId: string;
  readonly decision: IPermissionDecision;
}

// ---------------------------------------------------------------------------
// Agent hook configuration (persisted via IConfigService)
// ---------------------------------------------------------------------------

/**
 * User-facing configuration for agent hook system.
 */
export interface IAgentHookConfig {
  /** Master enable/disable for all agent hooks */
  enabled: boolean;

  /** Per-agent enable/disable overrides */
  agents: Partial<Record<ExternalAgentType, boolean>>;
}

export const AGENT_HOOK_CONFIG_KEY = 'agent.hooks';

export const DEFAULT_AGENT_HOOK_CONFIG: IAgentHookConfig = {
  enabled: true,
  agents: {
    'claude-code': true,
    codex: true,
    cursor: true,
    gemini: true,
    copilot: true,
    codebuddy: true,
    opencode: true,
    'kimi-code': true,
  },
};

/**
 * Human-readable display names for each external agent type.
 */
export const AGENT_DISPLAY_NAMES: Record<ExternalAgentType, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  gemini: 'Gemini',
  copilot: 'Copilot',
  codebuddy: 'CodeBuddy',
  opencode: 'OpenCode',
  'kimi-code': 'Kimi Code',
  unknown: 'Unknown',
};

/**
 * Marker string embedded in all hook commands.
 * Used to identify and remove termlnk-managed entries during uninstall.
 */
export const TERMLNK_HOOK_MARKER = 'TERMLNK_HOOK';
