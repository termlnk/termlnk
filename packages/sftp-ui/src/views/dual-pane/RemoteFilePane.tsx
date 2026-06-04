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

import type { ISFTPFileEntry } from '@termlnk/rpc';
import type { IFileListEntry } from '../file-browser/FileList';
import type { DragSourceType } from '../hooks/use-panel-drop';
import { ILogService, Quantity } from '@termlnk/core';
import { Button, useDependency } from '@termlnk/design';
import { ISFTPService } from '@termlnk/rpc-client';
import { IContextMenuService } from '@termlnk/ui';
import { ArrowUp, Eye, EyeOff, FolderPlus, RefreshCw, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SFTP_FILE_MENU } from '../../controllers/file/file-menu';
import { FileContextService } from '../../services/file-context/file-context.service';
import { IBrowserFileTransferService } from '../../services/transfer/browser-file-transfer.service';
import { BreadcrumbNav } from '../file-browser/BreadcrumbNav';
import { FileList } from '../file-browser/FileList';
import { NewFolderDialog } from '../file-browser/NewFolderDialog';
import { PermissionsDialog } from '../file-browser/PermissionsDialog';
import { RenameInput } from '../file-browser/RenameInput';
import { setPanelDragData, usePanelDrop } from '../hooks/use-panel-drop';
import { useRemoteFileBrowser } from '../hooks/use-remote-file-browser';

interface IRemoteFilePaneProps {
  sessionId: string | null;
  onTransferRequest?: (remotePath: string, filename: string) => void;
  onUploadDrop?: (localPaths: string[], remoteTargetPath: string, sourceType: DragSourceType) => void;
  refreshTrigger?: number;
}

export function RemoteFilePane({ sessionId, onTransferRequest, onUploadDrop, refreshTrigger }: IRemoteFilePaneProps) {
  const sftpService = useDependency(ISFTPService);
  const browserTransfer = useDependency(IBrowserFileTransferService, Quantity.OPTIONAL);
  const logService = useDependency(ILogService);
  const contextMenuService = useDependency(IContextMenuService);
  const fileContextService = useDependency(FileContextService);
  const browser = useRemoteFileBrowser(sessionId);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    browser.refresh();
  }, [refreshTrigger]);

  const handleDrop = useCallback((paths: string[], sourceType: DragSourceType) => {
    if (sessionId && browser.currentPath) {
      onUploadDrop?.(paths, browser.currentPath, sourceType);
    }
  }, [sessionId, browser.currentPath, onUploadDrop]);

  const { isDragOver, dropHandlers } = usePanelDrop({
    acceptLocal: true,
    acceptNative: true,
    onDrop: handleDrop,
  });

  const [renaming, setRenaming] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [permEntry, setPermEntry] = useState<IFileListEntry | null>(null);

  const handleDoubleClick = useCallback((entry: IFileListEntry) => {
    if (entry.isDirectory) {
      const path = browser.currentPath === '/'
        ? `/${entry.filename}`
        : `${browser.currentPath}/${entry.filename}`;
      browser.navigate(path);
    }
  }, [browser]);

  const deleteRemotePath = useCallback(async (remotePath: string, isDirectory: boolean) => {
    if (!sessionId) return;
    if (isDirectory) {
      const entries = await sftpService.list(sessionId, remotePath);
      for (const entry of entries) {
        await deleteRemotePath(`${remotePath}/${entry.filename}`, entry.isDirectory);
      }
      await sftpService.rmdir(sessionId, remotePath);
    } else {
      await sftpService.unlink(sessionId, remotePath);
    }
  }, [sessionId, sftpService]);

  const handleDelete = useCallback(async (entry: IFileListEntry) => {
    if (!sessionId) return;
    const fullPath = `${browser.currentPath}/${entry.filename}`;
    try {
      await deleteRemotePath(fullPath, entry.isDirectory);
      browser.refresh();
    } catch (err) {
      logService.error(`[RemoteFilePane] delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [sessionId, browser, deleteRemotePath, logService]);

  const handleRename = useCallback(async (oldName: string, newName: string) => {
    if (!sessionId) return;
    const oldPath = `${browser.currentPath}/${oldName}`;
    const newPath = `${browser.currentPath}/${newName}`;
    try {
      await sftpService.rename(sessionId, oldPath, newPath);
      browser.refresh();
    } catch (err) {
      logService.error(`[RemoteFilePane] rename failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setRenaming(null);
  }, [sessionId, browser, sftpService, logService]);

  const handleNewFolder = useCallback(async (name: string) => {
    if (!sessionId) return;
    const path = `${browser.currentPath}/${name}`;
    try {
      await sftpService.mkdir(sessionId, path);
      browser.refresh();
    } catch (err) {
      logService.error(`[RemoteFilePane] create folder failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setShowNewFolder(false);
  }, [sessionId, browser, sftpService, logService]);

  const handleChmod = useCallback(async (mode: number) => {
    if (!sessionId || !permEntry) return;
    const fullPath = `${browser.currentPath}/${permEntry.filename}`;
    try {
      await sftpService.chmod(sessionId, fullPath, mode);
      browser.refresh();
    } catch (err) {
      logService.error(`[RemoteFilePane] chmod failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setPermEntry(null);
  }, [sessionId, permEntry, browser, sftpService, logService]);

  const handleDownload = useCallback((entry: IFileListEntry) => {
    const fullPath = `${browser.currentPath}/${entry.filename}`;
    onTransferRequest?.(fullPath, entry.filename);
  }, [browser, onTransferRequest]);

  const handleDownloadToBrowser = useCallback(async (entry: IFileListEntry) => {
    if (!sessionId || !browserTransfer) {
      return;
    }
    const fullPath = `${browser.currentPath}/${entry.filename}`;
    try {
      await browserTransfer.downloadToBrowser(sessionId, fullPath, entry.filename);
    } catch (err) {
      logService.error(`[RemoteFilePane] download-to-browser failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [sessionId, browserTransfer, browser, logService]);

  // Set the right-clicked target, then open the shared context menu. Commands
  // read the target from FileContextService and invoke these actions.
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: IFileListEntry) => {
    fileContextService.setTarget({
      entry: { filename: entry.filename, isDirectory: entry.isDirectory },
      actions: {
        download: () => handleDownload(entry),
        downloadToBrowser: browserTransfer ? () => handleDownloadToBrowser(entry) : undefined,
        rename: () => setRenaming(entry.filename),
        permissions: () => setPermEntry(entry),
        delete: () => handleDelete(entry),
      },
    });
    contextMenuService.triggerContextMenu(e.nativeEvent, SFTP_FILE_MENU);
  }, [fileContextService, contextMenuService, browserTransfer, handleDownload, handleDownloadToBrowser, handleDelete]);

  const handleUploadFromBrowser = useCallback(async () => {
    if (!sessionId || !browserTransfer) {
      return;
    }
    try {
      const uploaded = await browserTransfer.uploadFromBrowser(sessionId, browser.currentPath);
      if (uploaded.length > 0) {
        browser.refresh();
      }
    } catch (err) {
      logService.error(`[RemoteFilePane] upload-from-browser failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [sessionId, browserTransfer, browser, logService]);

  const handleDragStart = useCallback((e: React.DragEvent, draggedEntries: IFileListEntry[]) => {
    const paths = draggedEntries.map((entry) => {
      return browser.currentPath === '/'
        ? `/${entry.filename}`
        : `${browser.currentPath}/${entry.filename}`;
    });
    setPanelDragData(e, 'remote', paths);
  }, [browser.currentPath]);

  const entries: IFileListEntry[] = useMemo(() => {
    return browser.entries
      .filter((entry) => showHiddenFiles || !entry.filename.startsWith('.'))
      .map((entry: ISFTPFileEntry) => ({
        filename: entry.filename,
        isDirectory: entry.isDirectory,
        isSymlink: entry.isSymlink,
        size: entry.attrs.size,
        mtime: entry.attrs.mtime,
        mode: entry.attrs.mode,
      }));
  }, [browser.entries, showHiddenFiles]);

  const selectedVisibleCount = useMemo(() => {
    return entries.reduce((count, entry) => {
      return count + Number(browser.selectedFiles.has(entry.filename));
    }, 0);
  }, [entries, browser.selectedFiles]);

  return (
    <div className="tm:relative tm:flex tm:h-full tm:flex-col tm:overflow-hidden" {...dropHandlers}>
      {/* Upload drop overlay */}
      {isDragOver && (
        <div
          className={`
            tm:pointer-events-none tm:absolute tm:inset-0 tm:z-50 tm:flex tm:flex-col tm:items-center tm:justify-center
            tm:gap-2 tm:rounded-sm tm:border-2 tm:border-dashed tm:border-blue tm:bg-blue/10
          `}
        >
          <Upload size={32} className="tm:text-blue" />
          <span className="tm:text-[13px] tm:font-medium tm:text-blue">
            Drop to upload to
            {' '}
            {browser.currentPath}
          </span>
        </div>
      )}
      {/* Toolbar */}
      <div className="tm:flex tm:items-center tm:gap-1 tm:border-b tm:border-line tm:px-2 tm:py-1.5 tm:text-white">
        <span className="tm:mr-1 tm:text-[11px] tm:font-medium tm:uppercase">Remote</span>
        <div className="tm:flex-1 tm:overflow-hidden">
          <BreadcrumbNav
            path={browser.currentPath}
            onNavigate={browser.navigate}
          />
        </div>
        <Button
          className={`
            ${showHiddenFiles
      ? `
        tm:text-blue
        tm:hover:text-blue
      `
      : `
        tm:text-white
        tm:hover:text-white
      `}
          `}
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowHiddenFiles((prev) => !prev)}
          title={showHiddenFiles ? 'Hide hidden files' : 'Show hidden files'}
        >
          {showHiddenFiles ? <Eye size={12} /> : <EyeOff size={12} />}
        </Button>
        <Button
          className="
            tm:text-white
            tm:hover:text-white
          "
          variant="ghost"
          size="icon-sm"
          onClick={browser.goUp}
          title="Go up"
        >
          <ArrowUp size={12} />
        </Button>
        <Button
          className="
            tm:text-white
            tm:hover:text-white
          "
          variant="ghost"
          size="icon-sm"
          onClick={browser.refresh}
          title="Refresh"
        >
          <RefreshCw size={12} />
        </Button>
        <Button
          className="
            tm:text-white
            tm:hover:text-white
          "
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowNewFolder(true)}
          title="New folder"
        >
          <FolderPlus size={12} />
        </Button>
        {browserTransfer
          ? (
            <Button
              className="
                tm:text-white
                tm:hover:text-white
              "
              variant="ghost"
              size="icon-sm"
              onClick={handleUploadFromBrowser}
              title="Upload from your browser"
            >
              <Upload size={12} />
            </Button>
          )
          : null}
      </div>

      {/* Error */}
      {browser.error && (
        <div className="tm:px-3 tm:py-2 tm:text-[12px] tm:text-red">
          {browser.error}
        </div>
      )}

      {/* File list */}
      <div className="tm:flex-1 tm:overflow-hidden">
        <FileList
          entries={entries}
          selectedFiles={browser.selectedFiles}
          sortField={browser.sortField}
          sortDirection={browser.sortDirection}
          loading={browser.loading}
          draggable
          onSelect={browser.select}
          onDoubleClick={handleDoubleClick}
          onSort={browser.sort}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
        />
      </div>

      {/* Status bar */}
      <div
        className={`
          tm:flex tm:items-center tm:justify-between tm:border-t tm:border-line tm:px-3 tm:py-1 tm:text-[11px]
          tm:text-grey-fg tm:select-none
        `}
      >
        <span>
          {entries.length}
          {' '}
          items
        </span>
        {selectedVisibleCount > 0 && (
          <span>
            {selectedVisibleCount}
            {' '}
            selected
          </span>
        )}
      </div>

      {/* Rename input */}
      {renaming && (
        <RenameInput
          currentName={renaming}
          onSubmit={(newName) => handleRename(renaming, newName)}
          onCancel={() => setRenaming(null)}
        />
      )}

      {/* New folder dialog */}
      {showNewFolder && (
        <NewFolderDialog
          onSubmit={handleNewFolder}
          onCancel={() => setShowNewFolder(false)}
        />
      )}

      {/* Permissions dialog */}
      {permEntry && (
        <PermissionsDialog
          filename={permEntry.filename}
          currentMode={permEntry.mode}
          onSubmit={handleChmod}
          onCancel={() => setPermEntry(null)}
        />
      )}
    </div>
  );
}
