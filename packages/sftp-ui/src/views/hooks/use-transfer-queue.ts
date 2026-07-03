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

import type { ISFTPTransferTask } from '@termlnk/rpc';
import { useDependency } from '@termlnk/design';
import { IRPCClientService, ISFTPService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ITransferHistoryService } from '../../services/transfer/transfer-history.service';

interface ILocalFsClient {
  stat: { query: (path: string) => Promise<{ isDirectory: boolean }> };
  walkDir: { query: (path: string) => Promise<Array<{ absolutePath: string; relativePath: string; isDirectory: boolean }>> };
  mkdir: { mutate: (path: string) => Promise<void> };
}

interface IUseTransferQueueOptions {
  onTransferComplete?: (task: ISFTPTransferTask) => void;
}

export function useTransferQueue(sessionId: string | null, options?: IUseTransferQueueOptions) {
  const sftpService = useDependency(ISFTPService);
  const rpcClient = useDependency(IRPCClientService);
  const historyService = useDependency(ITransferHistoryService);
  const [transfers, setTransfers] = useState<ISFTPTransferTask[]>([]);
  const onTransferCompleteRef = useRef(options?.onTransferComplete);
  onTransferCompleteRef.current = options?.onTransferComplete;

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const sub = sftpService.transferProgress$(sessionId).subscribe((task) => {
      setTransfers((prev) => {
        const idx = prev.findIndex((t) => t.id === task.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = task;
          return next;
        }
        return [...prev, task];
      });

      historyService.updateTransfer(task);

      // Auto-show the transfers overlay when a new transfer starts
      if (task.status === 'pending') {
        historyService.showOverlay();
      }

      if (task.status === 'completed') {
        onTransferCompleteRef.current?.(task);
      }
    });

    return () => sub.unsubscribe();
  }, [sessionId, sftpService, historyService]);

  const upload = useCallback(async (localPath: string, remotePath: string) => {
    if (!sessionId) {
      return;
    }
    await sftpService.upload(sessionId, localPath, remotePath);
  }, [sessionId, sftpService]);

  const download = useCallback(async (remotePath: string, localPath: string) => {
    if (!sessionId) {
      return;
    }
    await sftpService.download(sessionId, remotePath, localPath);
  }, [sessionId, sftpService]);

  const cancel = useCallback(async (transferId: string) => {
    await sftpService.cancelTransfer(transferId);
  }, [sftpService]);

  const clearCompleted = useCallback(() => {
    setTransfers((prev) => prev.filter((t) => t.status === 'pending' || t.status === 'transferring'));
    historyService.clearCompleted();
  }, [historyService]);

  const uploadNativeFiles = useCallback(async (localPaths: string[], remoteTargetPath: string) => {
    if (!sessionId) {
      return;
    }

    const localFs = (rpcClient.getClient() as any).localFs as ILocalFsClient;

    for (const localPath of localPaths) {
      try {
        const stat = await localFs.stat.query(localPath);
        if (stat.isDirectory) {
          // Get the directory name to create a matching remote directory
          const dirName = localPath.split('/').pop() || localPath.split('\\').pop() || 'folder';
          const remoteBasePath = `${remoteTargetPath}/${dirName}`;

          // Create the root directory on remote
          try {
            await sftpService.mkdir(sessionId, remoteBasePath);
          } catch {
            // Ignore if already exists
          }

          // Walk the local directory to get all entries
          const entries = await localFs.walkDir.query(localPath);
          await sftpService.uploadDirectory(sessionId, localPath, remoteBasePath, entries);
        } else {
          // Single file upload
          const filename = localPath.split('/').pop() || localPath.split('\\').pop() || 'file';
          const remotePath = `${remoteTargetPath}/${filename}`;
          await sftpService.upload(sessionId, localPath, remotePath);
        }
      } catch (err) {
        console.error('Native file upload failed:', err);
      }
    }
  }, [sessionId, rpcClient, sftpService]);

  const downloadDirectory = useCallback(async (
    remoteDir: string,
    localDir: string,
    localFs: ILocalFsClient
  ) => {
    if (!sessionId) {
      return;
    }

    // Create local directory
    await localFs.mkdir.mutate(localDir);

    // List remote directory
    const entries = await sftpService.list(sessionId, remoteDir);
    for (const entry of entries) {
      const remoteChild = `${remoteDir}/${entry.filename}`;
      const localChild = `${localDir}/${entry.filename}`;

      if (entry.isDirectory) {
        await downloadDirectory(remoteChild, localChild, localFs);
      } else {
        await sftpService.download(sessionId, remoteChild, localChild);
      }
    }
  }, [sessionId, sftpService]);

  const downloadFiles = useCallback(async (remotePaths: string[], localTargetDir: string) => {
    if (!sessionId) {
      return;
    }

    const localFs = (rpcClient.getClient() as any).localFs as ILocalFsClient;

    for (const remotePath of remotePaths) {
      try {
        const filename = remotePath.split('/').pop() || 'file';
        const localPath = `${localTargetDir}/${filename}`;
        const stat = await sftpService.stat(sessionId, remotePath);
        const isDir = (stat.mode & 0o40000) !== 0;

        if (isDir) {
          // Recursively download directory
          await downloadDirectory(remotePath, localPath, localFs);
        } else {
          await sftpService.download(sessionId, remotePath, localPath);
        }
      } catch (err) {
        console.error('Download failed:', err);
      }
    }
  }, [sessionId, rpcClient, sftpService, downloadDirectory]);

  return {
    transfers,
    upload,
    download,
    cancel,
    clearCompleted,
    uploadNativeFiles,
    downloadFiles,
  };
}
