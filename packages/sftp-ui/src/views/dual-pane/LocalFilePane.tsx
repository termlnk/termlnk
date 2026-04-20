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

import type { IFileListEntry } from '../file-browser/FileList';
import type { DragSourceType } from '../hooks/use-panel-drop';
import { Button } from '@termlnk/design';
import { ArrowUp, Download, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { BreadcrumbNav } from '../file-browser/BreadcrumbNav';
import { FileList } from '../file-browser/FileList';
import { useLocalFileBrowser } from '../hooks/use-local-file-browser';
import { setPanelDragData, usePanelDrop } from '../hooks/use-panel-drop';

interface ILocalFilePaneProps {
  onTransferRequest?: (localPath: string, filename: string) => void;
  onDownloadDrop?: (remotePaths: string[], localTargetPath: string) => void;
}

export function LocalFilePane({ onTransferRequest, onDownloadDrop }: ILocalFilePaneProps) {
  const browser = useLocalFileBrowser();
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);

  const handleDrop = useCallback((paths: string[], sourceType: DragSourceType) => {
    if (sourceType === 'remote' && browser.currentPath) {
      onDownloadDrop?.(paths, browser.currentPath);
    }
  }, [browser.currentPath, onDownloadDrop]);

  const { isDragOver, dropHandlers } = usePanelDrop({
    acceptRemote: true,
    onDrop: handleDrop,
  });

  const handleDoubleClick = useCallback((entry: IFileListEntry) => {
    if (entry.isDirectory) {
      const sep = browser.currentPath.includes('\\') ? '\\' : '/';
      const path = browser.currentPath.endsWith(sep)
        ? `${browser.currentPath}${entry.filename}`
        : `${browser.currentPath}${sep}${entry.filename}`;
      browser.navigate(path);
    }
  }, [browser]);

  const handleDragStart = useCallback((e: React.DragEvent, draggedEntries: IFileListEntry[]) => {
    const sep = browser.currentPath.includes('\\') ? '\\' : '/';
    const paths = draggedEntries.map((entry) => {
      return browser.currentPath.endsWith(sep)
        ? `${browser.currentPath}${entry.filename}`
        : `${browser.currentPath}${sep}${entry.filename}`;
    });
    setPanelDragData(e, 'local', paths);
  }, [browser.currentPath]);

  const entries: IFileListEntry[] = useMemo(() => {
    return browser.entries
      .filter((entry) => showHiddenFiles || !entry.filename.startsWith('.'))
      .map((entry) => ({
        filename: entry.filename,
        isDirectory: entry.isDirectory,
        isSymlink: entry.isSymlink,
        size: entry.size,
        mtime: entry.mtime,
        mode: entry.mode,
      }));
  }, [browser.entries, showHiddenFiles]);

  const selectedVisibleCount = useMemo(() => {
    return entries.reduce((count, entry) => {
      return count + Number(browser.selectedFiles.has(entry.filename));
    }, 0);
  }, [entries, browser.selectedFiles]);

  const separator = browser.currentPath.includes('\\') ? '\\' : '/';

  return (
    <div className="tm:relative tm:flex tm:h-full tm:flex-col tm:overflow-hidden" {...dropHandlers}>
      {/* Download drop overlay */}
      {isDragOver && (
        <div
          className={`
            tm:pointer-events-none tm:absolute tm:inset-0 tm:z-50 tm:flex tm:flex-col tm:items-center tm:justify-center
            tm:gap-2 tm:rounded-sm tm:border-2 tm:border-dashed tm:border-green tm:bg-green/10
          `}
        >
          <Download size={32} className="tm:text-green" />
          <span className="tm:text-[13px] tm:font-medium tm:text-green">
            Drop to download to
            {' '}
            {browser.currentPath}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="tm:flex tm:items-center tm:gap-1 tm:border-b tm:border-line tm:px-2 tm:py-1.5 tm:text-white">
        <span className="tm:mr-1 tm:text-[11px] tm:font-medium tm:uppercase">Local</span>
        <div className="tm:flex-1 tm:overflow-hidden">
          <BreadcrumbNav
            path={browser.currentPath}
            separator={separator}
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
    </div>
  );
}
