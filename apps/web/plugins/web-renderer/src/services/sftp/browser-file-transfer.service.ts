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

import type { IBrowserFileTransferService } from '@termlnk/sftp-ui';
import { Disposable, ILogService } from '@termlnk/core';
import { IRPCClientService } from '@termlnk/rpc-client';

// Browser-side IBrowserFileTransferService backed by sftp.writeFile / sftp.readFile.
// tRPC's HTTP transport encodes the whole payload in one request and the standalone
// adapter caps bodies at 1 MiB, so we pre-check size and reject loudly instead of
// letting the server truncate silently.
const MAX_BYTES_PER_FILE = 4 * 1024 * 1024;

export class BrowserFileTransferService extends Disposable implements IBrowserFileTransferService {
  constructor(
    @IRPCClientService private readonly _rpcClient: IRPCClientService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async uploadFromBrowser(sessionId: string, remoteDirPath: string): Promise<string[]> {
    const files = await pickFilesFromBrowser();
    if (files.length === 0) {
      return [];
    }

    const trpc = this._rpcClient.getClient() as unknown as ITrpcClientLike;
    const uploaded: string[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES_PER_FILE) {
        const message = `File "${file.name}" is ${formatBytes(file.size)}, exceeds the ${formatBytes(MAX_BYTES_PER_FILE)} per-file ceiling.`;
        this._logService.warn(`[BrowserFileTransferService] ${message}`);
        throw new Error(message);
      }
      const base64 = await readFileAsBase64(file);
      const remotePath = joinRemotePath(remoteDirPath, file.name);
      await trpc.sftp.writeFile.mutate({ sessionId, path: remotePath, content: base64 });
      uploaded.push(file.name);
    }
    return uploaded;
  }

  async downloadToBrowser(sessionId: string, remotePath: string, suggestedFileName: string): Promise<void> {
    const trpc = this._rpcClient.getClient() as unknown as ITrpcClientLike;
    const base64 = await trpc.sftp.readFile.query({ sessionId, path: remotePath });
    const bytes = base64ToBytes(base64);
    const blob = new Blob([bytes as unknown as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = suggestedFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // requestAnimationFrame keeps the URL alive long enough for the browser
    // to start the download — cheaper than queueing a setTimeout and lets
    // GC reclaim the Blob immediately after the next paint.
    requestAnimationFrame(() => {
      URL.revokeObjectURL(url);
    });
  }
}

interface ITrpcClientLike {
  sftp: {
    writeFile: { mutate: (input: { sessionId: string; path: string; content: string }) => Promise<unknown> };
    readFile: { query: (input: { sessionId: string; path: string }) => Promise<string> };
  };
}

async function pickFilesFromBrowser(): Promise<File[]> {
  // Each invocation creates a fresh hidden input — reusing one across calls
  // breaks Chrome's "same file twice" detection (no `change` event the
  // second time).
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    let resolved = false;
    const cleanup = () => {
      input.remove();
    };
    input.addEventListener('change', () => {
      resolved = true;
      const files = input.files ? Array.from(input.files) : [];
      cleanup();
      resolve(files);
    }, { once: true });
    // Browsers don't dispatch "cancel" on every platform; rely on focus
    // returning to the window as a heuristic for "user dismissed".
    window.addEventListener('focus', () => {
      // Wait a tick — change fires *before* focus on success, so if change
      // already resolved we leave it alone.
      setTimeout(() => {
        if (!resolved) {
          cleanup();
          resolve([]);
        }
      }, 200);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.onload = () => {
      const result = reader.result as string;
      // FileReader.readAsDataURL returns "data:<mime>;base64,<payload>".
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function joinRemotePath(dir: string, name: string): string {
  if (dir.endsWith('/')) {
    return `${dir}${name}`;
  }
  return `${dir}/${name}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
