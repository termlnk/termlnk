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

import type { IChatMessage } from '@termlnk/agent';

const NO_TOOLS_PREAMBLE = 'You are producing a conversation summary. DO NOT invoke any tools. DO NOT attempt to continue any pending work. Your output must be plain text only.\n\n';

const BASE_COMPACT_PROMPT = `Your task is to create a detailed summary of the conversation so far. Read through the entire conversation and produce a structured summary covering the following sections. Be precise and concrete — use real filenames, symbols, values, and quotes from the actual conversation rather than paraphrasing.

1. Primary Request and Intent
   Capture the user's overall goal and all explicit sub-requests in order. Quote relevant user phrases when useful.

2. Key Technical Concepts
   List the frameworks, libraries, patterns, protocols, or domain concepts central to the work.

3. Files and Code Sections
   For each file that was read or edited, include:
   - Absolute or workspace-relative path.
   - Why this file matters.
   - The critical code snippets (not the entire file, just the load-bearing portions with enough surrounding context to understand them).

4. Errors and Fixes
   Describe each error encountered and the fix or workaround. Include error messages verbatim when available.

5. Problem Solving
   Trace the reasoning and approach taken — dead ends, pivots, and final strategies. Include design trade-offs that were explicitly discussed.

6. All User Messages
   Enumerate every non-tool-result user message in order. A short paraphrase is fine, but never skip one.

7. Pending Tasks
   Every task the user asked for that has not been completed yet. If nothing is pending, say so explicitly.

8. Current Work
   Describe in detail what was being worked on immediately before this summary, including which file/function was being edited and what the intent was.

9. Optional Next Step
   If there is an obvious next step that directly continues the current work, state it concisely and include a direct quote from the most recent user or assistant message that grounds this step. If the current work has completed, state that instead.

Write the sections in order. Use clear Markdown headings. Keep the summary exhaustive on load-bearing detail and terse on pleasantries.`;

const NO_TOOLS_TRAILER = '\n\nRemember: output the summary only. No tool calls, no follow-up questions.';

export function getCompactPrompt(customInstructions?: string): string {
  let prompt = NO_TOOLS_PREAMBLE + BASE_COMPACT_PROMPT;
  const trimmed = customInstructions?.trim();
  if (trimmed) {
    prompt += `\n\nAdditional Instructions:\n${trimmed}`;
  }
  prompt += NO_TOOLS_TRAILER;
  return prompt;
}

function formatToolCalls(calls: NonNullable<IChatMessage['toolCalls']>): string {
  if (calls.length === 0) {
    return '';
  }
  const lines = calls.map((c) => {
    const status = c.status ? ` [${c.status}]` : '';
    const err = c.error ? ` error=${JSON.stringify(c.error)}` : '';
    const args = (() => {
      try {
        return JSON.stringify(c.args);
      } catch {
        return '"<unserializable>"';
      }
    })();
    return `  tool_call ${c.name}${status} args=${args}${err}`;
  });
  return `\n${lines.join('\n')}`;
}

export function formatMessagesForCompaction(messages: IChatMessage[]): string {
  const segments: string[] = [];
  for (const msg of messages) {
    if (msg.role === 'compact_boundary') {
      continue;
    }
    const header = `### ${msg.role.toUpperCase()}`;
    const body = msg.content?.trim() ?? '';
    const thinking = msg.thinking ? `\n<thinking>\n${msg.thinking.trim()}\n</thinking>` : '';
    const tools = msg.toolCalls ? formatToolCalls(msg.toolCalls) : '';
    const error = msg.error ? `\n[error]: ${msg.error}` : '';
    segments.push(`${header}\n${body}${thinking}${tools}${error}`.trim());
  }
  return segments.join('\n\n');
}

export function buildCompactUserPrompt(
  messages: IChatMessage[],
  customInstructions?: string
): string {
  const transcript = formatMessagesForCompaction(messages);
  const instructions = getCompactPrompt(customInstructions);
  return `${instructions}\n\n---\n\n<conversation>\n${transcript}\n</conversation>`;
}

export function buildSummaryUserMessage(summary: string, customInstructions?: string): string {
  const instructionsBlock = customInstructions?.trim()
    ? `\n\nThe user's original compaction instructions were: ${customInstructions.trim()}`
    : '';
  return `This session is being continued from a previous conversation that was compacted. The summary below covers the earlier portion of the conversation.${instructionsBlock}\n\n<previous-conversation-summary>\n${summary.trim()}\n</previous-conversation-summary>\n\nContinue the conversation from where it left off, using the summary as context. Do not re-ask the user anything already answered in the summary.`;
}
