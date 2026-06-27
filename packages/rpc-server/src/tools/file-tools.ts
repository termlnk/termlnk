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
import type { IDisposable, Injector } from '@termlnk/core';
import { Buffer } from 'node:buffer';
import { appendFile, readFile, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { ILogService } from '@termlnk/core';
import { ISSHSessionService, SFTPSessionStatus } from '@termlnk/rpc';
import { filter, firstValueFrom, take, timeout } from 'rxjs';
import { ISFTPSessionService } from '../services/sftp/sftp-session.service';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Unified file tools — local fs when sessionId is omitted, SFTP when sessionId is supplied.
 */
export function registerFileTools(toolRegistry: IAgentToolRegistryService, injector: Injector): IDisposable[] {
  const sftpSessionCache = new Map<string, Promise<string>>();

  return [
    toolRegistry.registerTool(createFileReadTool(injector, sftpSessionCache)),
    toolRegistry.registerTool(createFileEditTool(injector, sftpSessionCache)),
    toolRegistry.registerTool(createFileWriteTool(injector, sftpSessionCache)),
  ];
}

const SFTP_READY_TIMEOUT_MS = 30000;

async function resolveSftpSessionId(sessionId: string, injector: Injector, cache: Map<string, Promise<string>>): Promise<string> {
  const sftpService = injector.get(ISFTPSessionService);

  if (sftpService.getSession(sessionId)) {
    return sessionId;
  }

  if (!cache.has(sessionId)) {
    const promise = createSftpSessionForSSH(sessionId, injector).catch((err) => {
      cache.delete(sessionId);
      throw err;
    });
    cache.set(sessionId, promise);
  }

  let sftpSessionId: string;
  try {
    sftpSessionId = await cache.get(sessionId)!;
  } catch {
    cache.delete(sessionId);
    throw new Error(`Failed to resolve SFTP session for "${sessionId}". Retry the file operation.`);
  }

  if (!sftpService.getSession(sftpSessionId)) {
    cache.delete(sessionId);
    throw new Error('Auto-created SFTP session is no longer active. Retry the file operation.');
  }

  return sftpSessionId;
}

async function createSftpSessionForSSH(sessionId: string, injector: Injector): Promise<string> {
  const sftpService = injector.get(ISFTPSessionService);
  const sshSessionService = injector.get(ISSHSessionService);
  const logService = injector.get(ILogService);
  const sshSession = sshSessionService.getSession(sessionId);
  if (!sshSession) {
    throw new Error(`Session "${sessionId}" not found. It is neither an active SFTP session nor an SSH terminal session.`);
  }

  const hostId: string = sshSession.hostId;
  logService.log('[FileTools]', `Auto-creating SFTP session for SSH session ${sessionId} (host: ${hostId}).`);

  const sftpSessionId = await sftpService.createSession(hostId);

  try {
    const sftpSession = sftpService.getSession(sftpSessionId);
    if (!sftpSession) {
      throw new Error('SFTP session was created but immediately lost.');
    }

    const finalStatus = await firstValueFrom(
      sftpSession.status$.pipe(
        filter((s: SFTPSessionStatus) =>
          s === SFTPSessionStatus.READY
          || s === SFTPSessionStatus.ERROR
          || s === SFTPSessionStatus.AUTH_FAILED
          || s === SFTPSessionStatus.CLOSED
        ),
        take(1),
        timeout(SFTP_READY_TIMEOUT_MS)
      )
    );

    if (finalStatus !== SFTPSessionStatus.READY) {
      throw new Error(`SFTP session failed to connect (status: ${finalStatus}).`);
    }
  } catch (err) {
    await sftpService.closeSession(sftpSessionId).catch(() => {});
    throw err;
  }

  return sftpSessionId;
}

function createFileReadTool(injector: Injector, sftpSessionCache: Map<string, Promise<string>>): IAgentTool {
  const logService = injector.get(ILogService);
  return {
    name: 'termlnk_file_read',
    label: 'File Read',
    category: 'file',
    description: 'Read a file. Local when sessionId is omitted; remote (SFTP) when sessionId is set. Up to 1MB; use startLine/endLine for portions of large files. Path must be absolute.',
    isReadOnly: true,
    maxResultChars: 200000,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file.' },
        sessionId: { type: 'string', description: 'Terminal session ID (SSH or SFTP). Omit to read a local file.' },
        encoding: { type: 'string', description: 'Text encoding. Default: utf-8.' },
        startLine: { type: 'number', description: '1-based start line (inclusive). Optional.' },
        endLine: { type: 'number', description: '1-based end line (inclusive). Optional.' },
      },
      required: ['path'],
    },
    handler: async (args) => {
      const filePath = String(args.path ?? '');
      const sessionId = typeof args.sessionId === 'string' && args.sessionId ? args.sessionId : null;
      const encoding = String(args.encoding || 'utf-8') as BufferEncoding;
      const startLine = args.startLine ? Number(args.startLine) : undefined;
      const endLine = args.endLine ? Number(args.endLine) : undefined;

      if (!filePath || !isAbsolute(filePath)) {
        return jsonError('An absolute file path is required.');
      }

      try {
        let buffer: Buffer;
        let totalSize: number;
        let resolvedPath: string;

        if (sessionId) {
          const sftpId = await resolveSftpSessionId(sessionId, injector, sftpSessionCache);
          const sftp = injector.get(ISFTPSessionService);
          buffer = await sftp.readFile(sftpId, filePath);
          totalSize = buffer.byteLength;
          resolvedPath = filePath;
          if (totalSize > MAX_FILE_SIZE) {
            return jsonError(`File is too large (${(totalSize / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB. Use startLine/endLine to read portions.`);
          }
        } else {
          resolvedPath = resolve(filePath);
          const fileStat = await stat(resolvedPath);
          if (!fileStat.isFile()) {
            return jsonError(`"${filePath}" is not a file.`);
          }
          if (fileStat.size > MAX_FILE_SIZE) {
            return jsonError(`File is too large (${(fileStat.size / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB. Use startLine/endLine to read portions.`);
          }
          buffer = await readFile(resolvedPath);
          totalSize = fileStat.size;
        }

        let content = buffer.toString(encoding);
        const allLines = content.split('\n');
        const totalLines = allLines.length;

        if (startLine !== undefined || endLine !== undefined) {
          const start = Math.max((startLine ?? 1) - 1, 0);
          const end = endLine ? Math.min(endLine, allLines.length) : allLines.length;
          content = allLines.slice(start, end).join('\n');
        }

        return jsonOk({
          path: resolvedPath,
          remote: Boolean(sessionId),
          size: totalSize,
          totalLines,
          content,
        });
      } catch (err) {
        logService.error('[FileTools]', 'file_read failed:', err);
        return jsonError(`Failed to read file: ${formatError(err)}`);
      }
    },
  };
}

function createFileEditTool(injector: Injector, sftpSessionCache: Map<string, Promise<string>>): IAgentTool {
  const logService = injector.get(ILogService);
  return {
    name: 'termlnk_file_edit',
    label: 'File Edit',
    category: 'file',
    description: 'Edit a file by replacing exact text. Local when sessionId is omitted; remote (SFTP) when sessionId is set. oldText must match exactly (whitespace + newlines). Path must be absolute.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file.' },
        sessionId: { type: 'string', description: 'Terminal session ID (SSH or SFTP). Omit to edit a local file.' },
        oldText: { type: 'string', description: 'Exact text to find (must match exactly).' },
        newText: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'oldText', 'newText'],
    },
    handler: async (args) => {
      const filePath = String(args.path ?? '');
      const sessionId = typeof args.sessionId === 'string' && args.sessionId ? args.sessionId : null;
      const oldText = String(args.oldText ?? '');
      const newText = String(args.newText ?? '');

      if (!filePath || !isAbsolute(filePath)) {
        return jsonError('An absolute file path is required.');
      }

      try {
        let original: string;
        let resolvedPath: string;

        const sftpId = sessionId ? await resolveSftpSessionId(sessionId, injector, sftpSessionCache) : null;

        if (sftpId) {
          const sftp = injector.get(ISFTPSessionService);
          const buffer = await sftp.readFile(sftpId, filePath);
          if (buffer.byteLength > MAX_FILE_SIZE) {
            return jsonError(`File is too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB.`);
          }
          original = buffer.toString('utf-8');
          resolvedPath = filePath;
        } else {
          resolvedPath = resolve(filePath);
          const fileStat = await stat(resolvedPath);
          if (!fileStat.isFile()) {
            return jsonError(`"${filePath}" is not a file.`);
          }
          if (fileStat.size > MAX_FILE_SIZE) {
            return jsonError(`File is too large (${(fileStat.size / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB.`);
          }
          original = (await readFile(resolvedPath, 'utf-8')) as string;
        }

        const normalizedContent = original.replace(/\r\n/g, '\n');
        const normalizedOld = oldText.replace(/\r\n/g, '\n');
        const normalizedNew = newText.replace(/\r\n/g, '\n');

        const index = normalizedContent.indexOf(normalizedOld);
        if (index === -1) {
          return jsonError(`Could not find the exact text in ${filePath}. The old text must match exactly including all whitespace and newlines.`);
        }
        const secondIndex = normalizedContent.indexOf(normalizedOld, index + 1);
        if (secondIndex !== -1) {
          return jsonError(`Found multiple occurrences of the text in ${filePath}. Provide more context to make it unique.`);
        }

        const newContent = normalizedContent.substring(0, index)
          + normalizedNew
          + normalizedContent.substring(index + normalizedOld.length);

        if (normalizedContent === newContent) {
          return jsonError(`No changes made to ${filePath}. The replacement produced identical content.`);
        }

        // Preserve original line endings if file used CRLF
        const finalContent = original.includes('\r\n') ? newContent.replace(/\n/g, '\r\n') : newContent;

        if (sftpId) {
          const sftp = injector.get(ISFTPSessionService);
          await sftp.writeFile(sftpId, filePath, Buffer.from(finalContent, 'utf-8'));
        } else {
          await writeFile(resolvedPath, finalContent, 'utf-8');
        }

        return jsonOk({ success: true, path: resolvedPath, remote: Boolean(sessionId) });
      } catch (err) {
        logService.error('[FileTools]', 'file_edit failed:', err);
        return jsonError(`Failed to edit file: ${formatError(err)}`);
      }
    },
  };
}

function createFileWriteTool(injector: Injector, sftpSessionCache: Map<string, Promise<string>>): IAgentTool {
  const logService = injector.get(ILogService);
  return {
    name: 'termlnk_file_write',
    label: 'File Write',
    category: 'file',
    description: 'Write a file. Local when sessionId is omitted; remote (SFTP) when sessionId is set. Default overwrites; pass append=true to add to end. SFTP append is not supported. Path must be absolute. Do not write secrets.',
    isDestructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file.' },
        sessionId: { type: 'string', description: 'Terminal session ID (SSH or SFTP). Omit to write a local file.' },
        content: { type: 'string', description: 'Content to write.' },
        append: { type: 'boolean', description: 'Append to existing file instead of overwriting (local only). Default: false.' },
      },
      required: ['path', 'content'],
    },
    handler: async (args) => {
      const filePath = String(args.path ?? '');
      const sessionId = typeof args.sessionId === 'string' && args.sessionId ? args.sessionId : null;
      const content = String(args.content ?? '');
      const append = Boolean(args.append);

      if (!filePath || !isAbsolute(filePath)) {
        return jsonError('An absolute file path is required.');
      }

      if (sessionId && append) {
        return jsonError('append=true is not supported on remote (SFTP) writes. Read + concat + write instead.');
      }

      try {
        let resolvedPath: string;

        if (sessionId) {
          const sftpId = await resolveSftpSessionId(sessionId, injector, sftpSessionCache);
          const sftp = injector.get(ISFTPSessionService);
          await sftp.writeFile(sftpId, filePath, Buffer.from(content, 'utf-8'));
          resolvedPath = filePath;
        } else {
          resolvedPath = resolve(filePath);
          if (append) {
            await appendFile(resolvedPath, content, 'utf-8');
          } else {
            await writeFile(resolvedPath, content, 'utf-8');
          }
        }

        return jsonOk({
          success: true,
          path: resolvedPath,
          remote: Boolean(sessionId),
          mode: append ? 'append' : 'write',
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
        });
      } catch (err) {
        logService.error('[FileTools]', 'file_write failed:', err);
        return jsonError(`Failed to write file: ${formatError(err)}`);
      }
    },
  };
}

function jsonOk(data: Record<string, unknown>): IAgentToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function jsonError(message: string): IAgentToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
