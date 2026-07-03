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

import { useCallback, useRef, useState } from 'react';

export type DragSourceType = 'local' | 'remote' | 'native';

const MIME_LOCAL = 'text/x-sftp-local';
const MIME_REMOTE = 'text/x-sftp-remote';

export interface IPanelDropOptions {
  acceptLocal?: boolean;
  acceptRemote?: boolean;
  acceptNative?: boolean;
  onDrop: (paths: string[], sourceType: DragSourceType) => void;
}

export interface IPanelDropResult {
  isDragOver: boolean;
  activeDragType: DragSourceType | null;
  dropHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Set custom MIME data on a drag event for cross-panel drag identification.
 */
export function setPanelDragData(
  e: React.DragEvent,
  source: 'local' | 'remote',
  paths: string[]
) {
  const mime = source === 'local' ? MIME_LOCAL : MIME_REMOTE;
  e.dataTransfer.setData(mime, JSON.stringify(paths));
  e.dataTransfer.effectAllowed = 'copyMove';
}

/**
 * Checks whether a type string exists in the DataTransfer types list.
 * Uses Array.from() to handle both DOMStringList and frozen array implementations.
 */
function hasType(types: readonly string[], type: string): boolean {
  // DOMStringList has `contains()`, frozen arrays have `includes()`
  if (typeof (types as any).includes === 'function') {
    return types.includes(type);
  }
  if (typeof (types as any).contains === 'function') {
    return (types as any).contains(type);
  }
  return [...types].includes(type);
}

function detectDragSource(dataTransfer: DataTransfer): DragSourceType | null {
  const { types } = dataTransfer;
  if (hasType(types, MIME_LOCAL)) {
    return 'local';
  }
  if (hasType(types, MIME_REMOTE)) {
    return 'remote';
  }
  if (hasType(types, 'Files')) {
    return 'native';
  }

  // Fallback: check items for file kind (covers edge cases where 'Files' is missing from types)
  const { items } = dataTransfer;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        return 'native';
      }
    }
  }

  return null;
}

function isAccepted(
  source: DragSourceType,
  opts: IPanelDropOptions
): boolean {
  if (source === 'local' && opts.acceptLocal) {
    return true;
  }
  if (source === 'remote' && opts.acceptRemote) {
    return true;
  }
  if (source === 'native' && opts.acceptNative) {
    return true;
  }
  return false;
}

/**
 * Extract absolute local file paths from a native file drop.
 * Uses window.nativeFileUtils.getPathForFile() exposed via Electron preload (webUtils),
 * falls back to the Electron File.path extension.
 */
function extractNativeFilePaths(files: FileList): string[] {
  const paths: string[] = [];
  const getPathForFile: ((file: File) => string) | undefined
    = (globalThis as any).nativeFileUtils?.getPathForFile;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let filePath = '';

    // Primary: webUtils.getPathForFile exposed via preload contextBridge
    if (getPathForFile) {
      try {
        filePath = getPathForFile(file);
      } catch { /* fallback below */ }
    }

    // Fallback: Electron File.path extension (works when sandbox: false)
    if (!filePath) {
      filePath = (file as any).path ?? '';
    }

    if (filePath) {
      paths.push(filePath);
    }
  }

  return paths;
}

export function usePanelDrop(options: IPanelDropOptions): IPanelDropResult {
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeDragType, setActiveDragType] = useState<DragSourceType | null>(null);
  const dragCounterRef = useRef(0);
  const optsRef = useRef(options);
  optsRef.current = options;

  const onDragEnter = useCallback((e: React.DragEvent) => {
    const source = detectDragSource(e.dataTransfer);
    if (!source || !isAccepted(source, optsRef.current)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
      setActiveDragType(source);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    const source = detectDragSource(e.dataTransfer);
    if (!source || !isAccepted(source, optsRef.current)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';

    // Recover drag-over state if onDragEnter missed it
    if (!dragCounterRef.current) {
      dragCounterRef.current = 1;
      setIsDragOver(true);
      setActiveDragType(source);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    const source = detectDragSource(e.dataTransfer);
    if (!source || !isAccepted(source, optsRef.current)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
      setActiveDragType(null);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    const source = detectDragSource(e.dataTransfer);
    if (!source || !isAccepted(source, optsRef.current)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    setActiveDragType(null);

    let paths: string[] = [];
    if (source === 'native') {
      paths = extractNativeFilePaths(e.dataTransfer.files);
    } else {
      const mime = source === 'local' ? MIME_LOCAL : MIME_REMOTE;
      const raw = e.dataTransfer.getData(mime);
      if (raw) {
        try {
          paths = JSON.parse(raw);
        } catch {
          // ignore parse error
        }
      }
    }

    if (paths.length > 0) {
      optsRef.current.onDrop(paths, source);
    }
  }, []);

  return {
    isDragOver,
    activeDragType,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
