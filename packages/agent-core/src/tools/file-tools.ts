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
import type { IDisposable, ILogService } from '@termlnk/core';
import { Buffer } from 'node:buffer';
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export function registerFileTools(
  toolRegistry: IAgentToolRegistryService,
  logService: ILogService
): IDisposable[] {
  return [
    toolRegistry.registerTool(createFileReadTool(logService)),
    toolRegistry.registerTool(createFileEditTool(logService)),
    toolRegistry.registerTool(createFileWriteTool(logService)),
  ];
}

function createFileReadTool(logService: ILogService): IAgentTool {
  return {
    name: 'termlnk_file_read',
    label: 'File Read',
    category: 'file',
    description: 'Read the content of a local file. Only works on the local machine — for remote files, use termlnk_sftp_read instead. Supports text files up to 1MB. For large files, use startLine/endLine to read specific portions. Requires an absolute file path.',
    isReadOnly: true,
    maxResultChars: 200000,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file.' },
        encoding: { type: 'string', description: 'File encoding. Default: utf-8.' },
        startLine: { type: 'number', description: 'Start reading from this line (1-based). Optional.' },
        endLine: { type: 'number', description: 'Stop reading at this line (inclusive). Optional.' },
      },
      required: ['path'],
    },
    handler: async (args) => {
      const filePath = String(args.path ?? '');
      const encoding = (String(args.encoding || 'utf-8')) as BufferEncoding;
      const startLine = args.startLine ? Number(args.startLine) : undefined;
      const endLine = args.endLine ? Number(args.endLine) : undefined;

      if (!filePath || !isAbsolute(filePath)) {
        return createErrorResult('An absolute file path is required.');
      }

      try {
        const resolvedPath = resolve(filePath);
        const stat = statSync(resolvedPath);

        if (!stat.isFile()) {
          return createErrorResult(`"${filePath}" is not a file.`);
        }

        if (stat.size > MAX_FILE_SIZE) {
          return createErrorResult(`File is too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB. Use startLine/endLine to read portions.`);
        }

        let content = readFileSync(resolvedPath, encoding);

        if (startLine !== undefined || endLine !== undefined) {
          const lines = content.split('\n');
          const start = Math.max((startLine ?? 1) - 1, 0);
          const end = endLine ? Math.min(endLine, lines.length) : lines.length;
          content = lines.slice(start, end).join('\n');
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              path: resolvedPath,
              size: stat.size,
              lines: content.split('\n').length,
              content,
            }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[FileReadTool]', 'read failed:', err);
        return createErrorResult(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createFileEditTool(logService: ILogService): IAgentTool {
  return {
    name: 'termlnk_file_edit',
    label: 'File Edit',
    category: 'file',
    description: 'Edit a local file by replacing exact text. The oldText must match exactly (including whitespace and newlines). Only works on the local machine — for remote files, use termlnk_sftp_edit instead. Requires an absolute file path.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file.' },
        oldText: { type: 'string', description: 'Exact text to find and replace (must match exactly).' },
        newText: { type: 'string', description: 'New text to replace the old text with.' },
      },
      required: ['path', 'oldText', 'newText'],
    },
    handler: async (args) => {
      const filePath = String(args.path ?? '');
      const oldText = String(args.oldText ?? '');
      const newText = String(args.newText ?? '');

      if (!filePath || !isAbsolute(filePath)) {
        return createErrorResult('An absolute file path is required.');
      }

      try {
        const resolvedPath = resolve(filePath);
        const stat = statSync(resolvedPath);

        if (!stat.isFile()) {
          return createErrorResult(`"${filePath}" is not a file.`);
        }

        if (stat.size > MAX_FILE_SIZE) {
          return createErrorResult(`File is too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB.`);
        }

        const content = readFileSync(resolvedPath, 'utf-8');

        const normalizedContent = content.replace(/\r\n/g, '\n');
        const normalizedOld = oldText.replace(/\r\n/g, '\n');
        const normalizedNew = newText.replace(/\r\n/g, '\n');

        const index = normalizedContent.indexOf(normalizedOld);
        if (index === -1) {
          return createErrorResult(`Could not find the exact text in ${filePath}. The old text must match exactly including all whitespace and newlines.`);
        }

        const secondIndex = normalizedContent.indexOf(normalizedOld, index + 1);
        if (secondIndex !== -1) {
          return createErrorResult(`Found multiple occurrences of the text in ${filePath}. Please provide more context to make it unique.`);
        }

        const newContent = normalizedContent.substring(0, index)
          + normalizedNew
          + normalizedContent.substring(index + normalizedOld.length);

        if (normalizedContent === newContent) {
          return createErrorResult(`No changes made to ${filePath}. The replacement produced identical content.`);
        }

        const finalContent = content.includes('\r\n') ? newContent.replace(/\n/g, '\r\n') : newContent;
        writeFileSync(resolvedPath, finalContent, 'utf-8');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: resolvedPath,
            }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[FileEditTool]', 'edit failed:', err);
        return createErrorResult(`Failed to edit file: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createFileWriteTool(logService: ILogService): IAgentTool {
  return {
    name: 'termlnk_file_write',
    label: 'File Write',
    category: 'file',
    description: 'Write content to a local file. Creates the file if it does not exist. WARNING: By default this overwrites the entire file — use append=true to add content to the end instead. Only works on the local machine — for remote files, use termlnk_sftp_write instead. Requires an absolute file path. Do not write sensitive data (passwords, API keys) to files.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file.' },
        content: { type: 'string', description: 'Content to write.' },
        append: { type: 'boolean', description: 'Append to existing file instead of overwriting. Default: false.' },
      },
      required: ['path', 'content'],
    },
    handler: async (args) => {
      const filePath = String(args.path ?? '');
      const content = String(args.content ?? '');
      const append = Boolean(args.append);

      if (!filePath || !isAbsolute(filePath)) {
        return createErrorResult('An absolute file path is required.');
      }

      try {
        const resolvedPath = resolve(filePath);

        if (append) {
          appendFileSync(resolvedPath, content, 'utf-8');
        } else {
          writeFileSync(resolvedPath, content, 'utf-8');
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: resolvedPath,
              mode: append ? 'append' : 'write',
              bytesWritten: Buffer.byteLength(content, 'utf-8'),
            }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[FileWriteTool]', 'write failed:', err);
        return createErrorResult(`Failed to write file: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createErrorResult(message: string): IAgentToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
