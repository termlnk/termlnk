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

import type { IAgentTool, IAgentToolRegistryService, IAgentToolResult } from '@termlnk/agent';
import type { IDisposable, ILogService, Injector } from '@termlnk/core';
import { Buffer } from 'node:buffer';
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead } from '../common/truncate';
import { ISFTPSessionService } from '../services/sftp/sftp-session.service';

export function registerFileTools(toolRegistry: IAgentToolRegistryService, injector: Injector, logService: ILogService): IDisposable[] {
  const disposables: IDisposable[] = [];

  disposables.push(
    toolRegistry.registerTool(createRemoteReadTool(injector, logService))
  );

  disposables.push(
    toolRegistry.registerTool(createRemoteEditTool(injector, logService))
  );

  disposables.push(
    toolRegistry.registerTool(createRemoteWriteTool(injector, logService))
  );

  return disposables;
}

// ---------------------------------------------------------------------------
// Read tool — with truncation, offset/limit
// ---------------------------------------------------------------------------

function createRemoteReadTool(injector: Injector, logService: ILogService): IAgentTool {
  return {
    name: 'termlnk_sftp_read',
    label: 'SFTP Read',
    category: 'file',
    description: `Read the contents of a remote file via SFTP. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.`,
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'SFTP session ID for the remote host connection',
        },
        path: {
          type: 'string',
          description: 'Absolute path to the file to read',
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (1-indexed)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of lines to read',
        },
      },
      required: ['sessionId', 'path'],
    },
    handler: async (args) => {
      try {
        const sftpSessionService = injector.get(ISFTPSessionService);
        const sessionId = args.sessionId as string;
        const path = args.path as string;
        const offset = args.offset as number | undefined;
        const limit = args.limit as number | undefined;

        const buf = await sftpSessionService.readFile(sessionId, path);
        const textContent = buf.toString('utf-8');
        const allLines = textContent.split('\n');
        const totalFileLines = allLines.length;

        // Apply offset (1-indexed)
        const startLine = offset ? Math.max(0, offset - 1) : 0;
        const startLineDisplay = startLine + 1;

        if (startLine >= allLines.length) {
          return _textResult(`Offset ${offset} is beyond end of file (${allLines.length} lines total)`);
        }

        // Apply user limit
        let selectedContent: string;
        let userLimitedLines: number | undefined;
        if (limit !== undefined) {
          const endLine = Math.min(startLine + limit, allLines.length);
          selectedContent = allLines.slice(startLine, endLine).join('\n');
          userLimitedLines = endLine - startLine;
        } else {
          selectedContent = allLines.slice(startLine).join('\n');
        }

        // Apply truncation
        const truncation = truncateHead(selectedContent);
        let outputText: string;

        if (truncation.truncated) {
          const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
          const nextOffset = endLineDisplay + 1;
          outputText = truncation.content;

          if (truncation.truncatedBy === 'lines') {
            outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
          } else {
            outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
          }
        } else if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
          const remaining = allLines.length - (startLine + userLimitedLines);
          const nextOffset = startLine + userLimitedLines + 1;
          outputText = truncation.content;
          outputText += `\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
        } else {
          outputText = truncation.content;
        }

        return _textResult(outputText);
      } catch (err) {
        logService.error('[FileTools]', 'file_read failed:', err);
        return _errorResult(`Error reading file "${args.path}": ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Edit tool — find-and-replace
// ---------------------------------------------------------------------------

function createRemoteEditTool(injector: Injector, logService: ILogService): IAgentTool {
  return {
    name: 'termlnk_sftp_edit',
    label: 'SFTP Edit',
    category: 'file',
    description: 'Edit a remote file by replacing exact text via SFTP. The oldText must match exactly (including whitespace). Use this for precise, surgical edits.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'SFTP session ID for the remote host connection',
        },
        path: {
          type: 'string',
          description: 'Absolute path to the file to edit',
        },
        oldText: {
          type: 'string',
          description: 'Exact text to find and replace (must match exactly)',
        },
        newText: {
          type: 'string',
          description: 'New text to replace the old text with',
        },
      },
      required: ['sessionId', 'path', 'oldText', 'newText'],
    },
    handler: async (args) => {
      try {
        const sftpSessionService = injector.get(ISFTPSessionService);
        const sessionId = args.sessionId as string;
        const path = args.path as string;
        const oldText = args.oldText as string;
        const newText = args.newText as string;

        const buf = await sftpSessionService.readFile(sessionId, path);
        const content = buf.toString('utf-8');

        // Normalize line endings for matching
        const normalizedContent = content.replace(/\r\n/g, '\n');
        const normalizedOld = oldText.replace(/\r\n/g, '\n');
        const normalizedNew = newText.replace(/\r\n/g, '\n');
        const index = normalizedContent.indexOf(normalizedOld);
        if (index === -1) {
          return _errorResult(
            `Could not find the exact text in ${path}. The old text must match exactly including all whitespace and newlines.`
          );
        }

        // Check for multiple occurrences
        const secondIndex = normalizedContent.indexOf(normalizedOld, index + 1);
        if (secondIndex !== -1) {
          return _errorResult(
            `Found multiple occurrences of the text in ${path}. Please provide more context to make it unique.`
          );
        }

        const newContent = normalizedContent.substring(0, index)
          + normalizedNew
          + normalizedContent.substring(index + normalizedOld.length);

        if (normalizedContent === newContent) {
          return _errorResult(`No changes made to ${path}. The replacement produced identical content.`);
        }

        // Restore original line endings if file used CRLF
        const finalContent = content.includes('\r\n') ? newContent.replace(/\n/g, '\r\n') : newContent;
        await sftpSessionService.writeFile(sessionId, path, Buffer.from(finalContent, 'utf-8'));

        return _textResult(`Successfully replaced text in ${path}.`);
      } catch (err) {
        logService.error('[FileTools]', 'file_edit failed:', err);
        return _errorResult(`Error editing file "${args.path}": ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Write tool — create or overwrite
// ---------------------------------------------------------------------------

function createRemoteWriteTool(injector: Injector, logService: ILogService): IAgentTool {
  return {
    name: 'termlnk_sftp_write',
    label: 'SFTP Write',
    category: 'file',
    description: 'Write content to a remote file via SFTP. Creates the file if it doesn\'t exist, overwrites if it does.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'SFTP session ID for the remote host connection',
        },
        path: {
          type: 'string',
          description: 'Absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['sessionId', 'path', 'content'],
    },
    handler: async (args) => {
      try {
        const sftpSessionService = injector.get(ISFTPSessionService);
        const sessionId = args.sessionId as string;
        const path = args.path as string;
        const content = args.content as string;

        await sftpSessionService.writeFile(sessionId, path, Buffer.from(content, 'utf-8'));
        return _textResult(`Successfully wrote ${content.length} bytes to ${path}`);
      } catch (err) {
        logService.error('[FileTools]', 'file_write failed:', err);
        return _errorResult(`Error writing file "${args.path}": ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function _textResult(text: string): IAgentToolResult {
  return { content: [{ type: 'text', text }] };
}

function _errorResult(text: string): IAgentToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}
