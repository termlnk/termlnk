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

import type { IChatMessage, IToolPart } from '@termlnk/agent';

export const SUMMARIZATION_SYSTEM_PROMPT = 'You are a context summarization assistant. Your task is to read a conversation between a user and an AI assistant, then produce a structured summary following the exact format specified.\n\nDo NOT continue the conversation. Do NOT respond to any questions in the conversation. Do NOT invoke any tools. ONLY output the structured summary.';

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

const UPDATE_COMPACT_PROMPT = `The messages below are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE section 7 (Pending Tasks): move completed items out, add new ones
- UPDATE section 8 (Current Work): reflect the latest state
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it

Use the same 9-section format as the original summary. Keep each section concise.`;

const COMPACT_TRAILER = '\n\nRemember: output the summary only. No tool calls, no follow-up questions.';

function buildPromptWithInstructions(base: string, customInstructions?: string): string {
  let prompt = base;
  const trimmed = customInstructions?.trim();
  if (trimmed) {
    prompt += `\n\nAdditional Instructions:\n${trimmed}`;
  }
  prompt += COMPACT_TRAILER;
  return prompt;
}

export function getCompactPrompt(customInstructions?: string): string {
  return buildPromptWithInstructions(BASE_COMPACT_PROMPT, customInstructions);
}

export function getUpdateCompactPrompt(customInstructions?: string): string {
  return buildPromptWithInstructions(UPDATE_COMPACT_PROMPT, customInstructions);
}

function formatToolCalls(calls: IToolPart[]): string {
  if (calls.length === 0) {
    return '';
  }
  const lines = calls.map((c) => {
    const status = c.state ? ` [${c.state}]` : '';
    const errorBlock = c.output?.isError && c.output?.text
      ? ` error=${JSON.stringify(c.output.text)}`
      : '';
    const args = (() => {
      try {
        return JSON.stringify(c.input ?? {});
      } catch {
        return '"<unserializable>"';
      }
    })();
    return `  tool_call ${c.toolName}${status} args=${args}${errorBlock}`;
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
    const textChunks: string[] = [];
    const thinkingChunks: string[] = [];
    const toolCalls: IToolPart[] = [];
    const errors: string[] = [];

    for (const part of msg.parts) {
      switch (part.type) {
        case 'text': {
          textChunks.push(part.text);
          break;
        }
        case 'thinking': {
          thinkingChunks.push(part.thinking);
          break;
        }
        case 'tool': {
          toolCalls.push(part);
          break;
        }
        case 'error': {
          errors.push(part.message);
          break;
        }
        default: {
          break;
        }
      }
    }

    const body = textChunks.join('').trim();
    const thinking = thinkingChunks.length > 0
      ? `\n<thinking>\n${thinkingChunks.join('').trim()}\n</thinking>`
      : '';
    const tools = formatToolCalls(toolCalls);
    const error = errors.length > 0 ? `\n[error]: ${errors.join('; ')}` : '';
    segments.push(`${header}\n${body}${thinking}${tools}${error}`.trim());
  }
  return segments.join('\n\n');
}

export function buildCompactUserPrompt(
  messages: IChatMessage[],
  customInstructions?: string,
  previousSummary?: string
): string {
  const transcript = formatMessagesForCompaction(messages);
  const instructions = previousSummary
    ? getUpdateCompactPrompt(customInstructions)
    : getCompactPrompt(customInstructions);

  let prompt = `${instructions}\n\n---\n\n<conversation>\n${transcript}\n</conversation>`;

  if (previousSummary) {
    prompt += `\n\n<previous-summary>\n${previousSummary}\n</previous-summary>`;
  }

  const fileOps = extractFileOperationsFromMessages(messages);
  const fileOpsBlock = formatFileOperations(fileOps);
  if (fileOpsBlock) {
    prompt += `\n\n${fileOpsBlock}`;
  }

  return prompt;
}

export function buildSummaryUserMessage(summary: string, customInstructions?: string): string {
  const instructionsBlock = customInstructions?.trim()
    ? `\n\nThe user's original compaction instructions were: ${customInstructions.trim()}`
    : '';
  return `This session is being continued from a previous conversation that was compacted. The summary below covers the earlier portion of the conversation.${instructionsBlock}\n\n<previous-conversation-summary>\n${summary.trim()}\n</previous-conversation-summary>\n\nContinue the conversation from where it left off, using the summary as context. Do not re-ask the user anything already answered in the summary.`;
}

interface IFileOperations {
  readFiles: Set<string>;
  modifiedFiles: Set<string>;
}

const READ_TOOL_PATTERNS = /^(termlnk_file_read|termlnk_sftp_read|mcp_.*_read|read)$/;
const WRITE_TOOL_PATTERNS = /^(termlnk_file_write|termlnk_file_edit|termlnk_sftp_write|termlnk_sftp_edit|write|edit)$/;

function extractPathFromToolInput(input: Record<string, unknown>): string | undefined {
  const candidate = input.path ?? input.file_path ?? input.filePath;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
}

export function extractFileOperationsFromMessages(messages: IChatMessage[]): IFileOperations {
  const ops: IFileOperations = { readFiles: new Set(), modifiedFiles: new Set() };

  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type !== 'tool') {
        continue;
      }
      const filePath = extractPathFromToolInput(part.input ?? {});
      if (!filePath) {
        continue;
      }
      if (WRITE_TOOL_PATTERNS.test(part.toolName)) {
        ops.modifiedFiles.add(filePath);
      } else if (READ_TOOL_PATTERNS.test(part.toolName)) {
        ops.readFiles.add(filePath);
      }
    }
  }

  return ops;
}

export function formatFileOperations(ops: IFileOperations): string {
  const blocks: string[] = [];

  if (ops.readFiles.size > 0) {
    const entries = [...ops.readFiles].sort().map((f) => `- ${f}`).join('\n');
    blocks.push(`<read-files>\n${entries}\n</read-files>`);
  }

  if (ops.modifiedFiles.size > 0) {
    const entries = [...ops.modifiedFiles].sort().map((f) => `- ${f}`).join('\n');
    blocks.push(`<modified-files>\n${entries}\n</modified-files>`);
  }

  return blocks.join('\n\n');
}
