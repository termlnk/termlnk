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

import { truncate } from './agent-monitor.utils';

/**
 * Per-tool formatter used by the Dynamic Island:
 * - `describe` returns the verb-first primary text ("Reading foo.ts").
 * - `detail` returns the raw detail (filename / command) shown next to the
 *   `[ToolTag]` pill; undefined when the tool has no meaningful detail.
 */
export interface IToolFormatter {
  describe: (input: Record<string, unknown>) => string;
  detail?: (input: Record<string, unknown>) => string | undefined;
}

function extractFilename(filePath: string | undefined): string {
  if (!filePath) {
    return 'file';
  }
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

export const TOOL_FORMATTERS: Record<string, IToolFormatter> = {
  Read: {
    describe: (input) => `Reading ${extractFilename(input.file_path as string)}`,
    detail: (input) => extractFilename(input.file_path as string),
  },
  Edit: {
    describe: (input) => `Editing ${extractFilename(input.file_path as string)}`,
    detail: (input) => extractFilename(input.file_path as string),
  },
  Write: {
    describe: (input) => `Writing ${extractFilename(input.file_path as string)}`,
    detail: (input) => extractFilename(input.file_path as string),
  },
  Bash: {
    describe: (input) => `Running \`${truncate(input.command as string, 40)}\``,
    detail: (input) => truncate(input.command as string, 80),
  },
  Shell: {
    describe: (input) => `Running \`${truncate(input.command as string, 40)}\``,
    detail: (input) => truncate(input.command as string, 80),
  },
  Glob: {
    describe: (input) => `Searching ${(input.pattern as string) || 'files'}`,
    detail: (input) => (input.pattern as string) || undefined,
  },
  Grep: {
    describe: (input) => `Grep ${truncate(input.pattern as string, 40)}`,
    detail: (input) => truncate(input.pattern as string, 60),
  },
  WebFetch: {
    describe: () => 'Fetching URL',
    detail: (input) => truncate(input.url as string, 60),
  },
  WebSearch: {
    describe: (input) => `Search: ${truncate(input.query as string, 40)}`,
    detail: (input) => truncate(input.query as string, 60),
  },
  Agent: {
    describe: (input) => truncate((input.description as string) || 'Subagent', 60),
    detail: (input) => truncate((input.description as string) || (input.prompt as string) || '', 80),
  },
  AskUserQuestion: {
    describe: (input) => truncate((input.question as string) || 'Question', 60),
    detail: (input) => truncate(input.question as string, 80),
  },
};
