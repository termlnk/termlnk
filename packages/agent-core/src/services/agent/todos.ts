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

import type { AgentTodoStatus, IAgentTodo } from '@termlnk/agent';
import { truncate } from './agent-monitor.utils';

/** Max characters retained for a todo's content text. */
const TODO_CONTENT_MAX_LEN = 200;

/**
 * Tool names that manipulate a session's todo plan. Claude Code uses
 * `TodoWrite` (legacy, full replace) and the newer `TaskCreate` (append) /
 * `TaskUpdate` (id-patch); Kimi Code uses `SetTodoList`; OpenCode uses
 * `write_todos` via its plugin bridge.
 */
export const TODO_TOOL_NAMES = new Set<string>([
  'TodoWrite',
  'TaskCreate',
  'TaskUpdate',
  'SetTodoList',
  'write_todos',
]);

function normalizeStatus(raw: unknown): AgentTodoStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'in_progress' || s === 'in-progress' || s === 'running') {
    return 'in_progress';
  }
  if (s === 'completed' || s === 'done' || s === 'complete') {
    return 'completed';
  }
  return 'pending';
}

/**
 * Parse a full todo list from a tool input. Accepts field aliases
 * (`content`/`text`/`title`/`subject`, `status` or boolean `done`).
 * Returns null when no `todos` array is present (caller preserves existing list).
 */
function extractTodosList(raw: unknown): IAgentTodo[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  return raw
    .map((item, idx) => {
      const obj = (item ?? {}) as Record<string, unknown>;
      const content = (obj.content as string)
        || (obj.text as string)
        || (obj.title as string)
        || (obj.subject as string)
        || '';
      const rawId = obj.id ?? obj.taskId;
      const id = rawId != null ? String(rawId) : `idx-${idx}`;
      const statusRaw = obj.status ?? (obj.done === true ? 'completed' : 'pending');
      return {
        id,
        content: truncate(content, TODO_CONTENT_MAX_LEN),
        status: normalizeStatus(statusRaw),
        activeForm: obj.activeForm as string | undefined,
      } satisfies IAgentTodo;
    })
    .filter((t) => t.content);
}

/**
 * Project a todo-list tool call onto a new todos array. Pure — never mutates
 * `existing`. Returns null when the tool input carries no recognizable todo
 * data, signaling the caller to leave `session.todos` untouched.
 */
export function applyTodoTool(
  toolName: string,
  input: Record<string, unknown>,
  existing: IAgentTodo[] | undefined
): IAgentTodo[] | null {
  switch (toolName) {
    case 'TodoWrite':
    case 'SetTodoList':
    case 'write_todos': {
      return extractTodosList(input.todos) ?? [];
    }
    case 'TaskCreate': {
      const content = truncate(
        (input.subject as string) || (input.description as string) || '',
        TODO_CONTENT_MAX_LEN
      );
      if (!content) {
        return existing ?? null;
      }
      // Use sequential integer IDs ("1", "2", "3", ...) to match the
      // auto-incrementing IDs that Claude Code / agents assign. TaskUpdate
      // references these same numeric IDs. Coerce to string to guard
      // against numeric JSON values.
      const id = input.taskId != null
        ? String(input.taskId)
        : String((existing?.length ?? 0) + 1);
      const newTodo: IAgentTodo = {
        id,
        content,
        status: 'pending',
        activeForm: input.activeForm as string | undefined,
      };
      const list = [...(existing ?? []), newTodo];
      // Parallel TaskCreate PreToolUse hooks arrive over HTTP in
      // non-deterministic order, so a naive append can flip the plan
      // (observed: island showed tasks reversed vs. Claude Code's spinner).
      // Re-sort by numeric taskId when every entry is numeric — Claude
      // Code assigns sequential "1","2","3", so this reconstructs the
      // canonical order without touching user-supplied string IDs.
      if (list.every((t) => /^\d+$/.test(t.id))) {
        list.sort((a, b) => Number(a.id) - Number(b.id));
      }
      return list;
    }
    case 'TaskUpdate': {
      // Coerce taskId to string: JSON may deserialise numeric IDs as
      // numbers (e.g. 1 instead of "1"), and strict `!==` would miss.
      const taskId = input.taskId != null ? String(input.taskId) : undefined;
      if (!existing || !taskId) {
        return existing ?? null;
      }
      // A "deleted" / "removed" status means the task should be evicted
      // from the list rather than normalized to "pending".
      const rawStatus = input.status != null
        ? String(input.status).toLowerCase()
        : undefined;
      if (rawStatus === 'deleted' || rawStatus === 'removed') {
        return existing.filter((t) => t.id !== taskId);
      }
      return existing.map((t) => {
        if (t.id !== taskId) {
          return t;
        }
        return {
          ...t,
          status: input.status !== undefined ? normalizeStatus(input.status) : t.status,
          content: input.subject !== undefined
            ? truncate(input.subject as string, TODO_CONTENT_MAX_LEN)
            : t.content,
          activeForm: input.activeForm !== undefined
            ? (input.activeForm as string)
            : t.activeForm,
        };
      });
    }
    default:
      return null;
  }
}
