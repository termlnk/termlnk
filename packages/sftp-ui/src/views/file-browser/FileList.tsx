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

import type { DragEvent, MouseEvent } from 'react';
import { cn } from '@termlnk/design';
import { ArrowDown, ArrowUp, File, Folder, Link2 } from 'lucide-react';

export interface IFileListColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

export interface IFileListEntry {
  filename: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  mtime: number;
  mode: number;
}

interface IFileListProps {
  entries: IFileListEntry[];
  selectedFiles: Set<string>;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  loading: boolean;
  draggable?: boolean;
  onSelect: (filename: string, multi: boolean) => void;
  onDoubleClick: (entry: IFileListEntry) => void;
  onSort: (field: string) => void;
  onContextMenu?: (e: MouseEvent, entry: IFileListEntry) => void;
  onDragStart?: (e: DragEvent, entries: IFileListEntry[]) => void;
}

const columns: IFileListColumn[] = [
  { key: 'filename', label: 'Name', sortable: true, width: 'tm:flex-1' },
  { key: 'size', label: 'Size', sortable: true, width: 'tm:w-24' },
  { key: 'mtime', label: 'Modified', sortable: true, width: 'tm:w-36' },
  { key: 'mode', label: 'Perms', width: 'tm:w-24' },
];

export function FileList(props: IFileListProps) {
  const {
    entries,
    selectedFiles,
    sortField,
    sortDirection,
    loading,
    draggable,
    onSelect,
    onDoubleClick,
    onSort,
    onContextMenu,
    onDragStart,
  } = props;

  if (loading) {
    return (
      <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:text-grey-fg tm:select-none">
        Loading...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:text-grey-fg tm:select-none">
        Empty directory
      </div>
    );
  }

  const handleRowDragStart = (e: DragEvent, entry: IFileListEntry, isSelected: boolean) => {
    if (!draggable || !onDragStart) return;
    if (isSelected && selectedFiles.size > 1) {
      const draggedEntries = entries.filter((en) => selectedFiles.has(en.filename));
      onDragStart(e, draggedEntries);
    } else {
      onDragStart(e, [entry]);
    }
  };

  return (
    <div className="tm:flex tm:h-full tm:flex-col tm:overflow-hidden">
      {/* Header */}
      <div
        className={`
          tm:flex tm:shrink-0 tm:items-center tm:border-b tm:border-line tm:px-2 tm:py-1 tm:text-[11px] tm:text-white
        `}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className={cn(
              'tm:flex tm:items-center tm:gap-1 tm:px-1 tm:select-none',
              col.width
            )}
            onClick={() => col.sortable && onSort(col.key)}
          >
            {col.label}
            {sortField === col.key && (
              sortDirection === 'asc'
                ? <ArrowUp size={10} />
                : <ArrowDown size={10} />
            )}
          </div>
        ))}
      </div>

      {/* File list */}
      <div className="tm:flex-1 tm:overflow-y-auto">
        {entries.map((entry) => {
          const isSelected = selectedFiles.has(entry.filename);
          return (
            <div
              key={entry.filename}
              className={cn(
                'tm:flex tm:items-center tm:px-2 tm:py-1 tm:text-[12px]',
                {
                  'tm:bg-blue/20 tm:text-light-grey': isSelected,
                  'tm:text-grey-fg2 tm:hover:bg-one-bg': !isSelected,
                }
              )}
              draggable={draggable}
              onDragStart={(e) => handleRowDragStart(e, entry, isSelected)}
              onClick={(e) => onSelect(entry.filename, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onDoubleClick(entry)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!isSelected) onSelect(entry.filename, false);
                onContextMenu?.(e, entry);
              }}
            >
              <div className="tm:flex tm:flex-1 tm:items-center tm:gap-2 tm:truncate tm:px-1">
                {getFileIcon(entry)}
                <span className="tm:truncate tm:text-white">{entry.filename}</span>
              </div>
              <div className="tm:w-24 tm:px-1 tm:text-right tm:tabular-nums">
                {entry.isDirectory ? '--' : formatSize(entry.size)}
              </div>
              <div className="tm:w-36 tm:px-1 tm:tabular-nums">
                {formatDate(entry.mtime)}
              </div>
              <div className="tm:w-24 tm:px-1 tm:font-mono tm:text-[11px]">
                {formatPermissions(entry.mode)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getFileIcon(entry: IFileListEntry) {
  if (entry.isSymlink) return <Link2 size={14} className="tm:shrink-0 tm:text-cyan" />;
  if (entry.isDirectory) return <Folder size={14} className="tm:shrink-0 tm:text-yellow" />;
  return <File size={14} className="tm:shrink-0 tm:text-grey-fg" />;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / 1024 ** i;
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '--';
  const d = new Date(timestamp * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatPermissions(mode: number): string {
  if (!mode) return '---';
  const perms = mode & 0o777;
  const chars = 'rwx';
  let result = '';
  for (let i = 8; i >= 0; i--) {
    result += (perms >> i) & 1 ? chars[2 - (i % 3)] : '-';
  }
  return result;
}
