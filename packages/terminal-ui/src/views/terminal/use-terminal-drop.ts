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

import { useCallback, useMemo, useRef, useState } from 'react';
import { detectShellType, escapePathsForShell } from '../../utils/shell-path-escape';

export interface IUseTerminalDropOptions {
  enabled: boolean;
  onWriteInput: (data: string) => void;
  shellPath: string | null;
}

export interface IUseTerminalDropResult {
  isDragOver: boolean;
  dropHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

function extractNativeFilePaths(dataTransfer: DataTransfer): string[] {
  const getPathForFile: ((file: File) => string) | undefined
    = (globalThis as any).nativeFileUtils?.getPathForFile;

  const paths: string[] = [];
  const files = dataTransfer.files;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = getPathForFile
      ? getPathForFile(file)
      : (file as any).path;

    if (filePath && typeof filePath === 'string') {
      paths.push(filePath);
    }
  }

  return paths;
}

function hasNativeFiles(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes('Files') && dataTransfer.files.length > 0;
}

export function useTerminalDrop(options: IUseTerminalDropOptions): IUseTerminalDropResult {
  const { enabled, onWriteInput, shellPath } = options;
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!enabled) return;
    if (!e.dataTransfer.types.includes('Files')) return;

    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragOver(true);
  }, [enabled]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!enabled) return;
    if (!e.dataTransfer.types.includes('Files')) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, [enabled]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!enabled) return;

    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, [enabled]);

  const onDrop = useCallback((e: React.DragEvent) => {
    if (!enabled) return;

    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    if (!hasNativeFiles(e.dataTransfer)) return;

    const paths = extractNativeFilePaths(e.dataTransfer);
    if (paths.length === 0) return;

    const shellType = detectShellType(shellPath);
    const escaped = escapePathsForShell(paths, shellType);
    onWriteInput(escaped);
  }, [enabled, shellPath, onWriteInput]);

  const dropHandlers = useMemo(
    () => ({ onDragEnter, onDragOver, onDragLeave, onDrop }),
    [onDragEnter, onDragOver, onDragLeave, onDrop]
  );

  return {
    isDragOver,
    dropHandlers,
  };
}
