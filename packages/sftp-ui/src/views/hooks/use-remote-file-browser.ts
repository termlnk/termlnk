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
import { useDependency } from '@termlnk/design';
import { ISFTPClientService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useState } from 'react';

export type SortField = 'filename' | 'size' | 'mtime';
export type SortDirection = 'asc' | 'desc';

export interface IFileBrowserState {
  currentPath: string;
  entries: ISFTPFileEntry[];
  loading: boolean;
  error: string | null;
  selectedFiles: Set<string>;
  sortField: SortField;
  sortDirection: SortDirection;
}

export function useRemoteFileBrowser(sessionId: string | null) {
  const sftpService = useDependency(ISFTPClientService);
  const [state, setState] = useState<IFileBrowserState>({
    currentPath: '~',
    entries: [],
    loading: false,
    error: null,
    selectedFiles: new Set(),
    sortField: 'filename',
    sortDirection: 'asc',
  });

  const navigate = useCallback(async (path: string) => {
    if (!sessionId) return;
    setState((prev) => ({ ...prev, loading: true, error: null, selectedFiles: new Set() }));
    try {
      let resolvedPath = path;
      if (path === '~') {
        resolvedPath = await sftpService.realpath(sessionId, '.');
      }
      const entries = await sftpService.list(sessionId, resolvedPath);
      setState((prev) => ({
        ...prev,
        currentPath: resolvedPath,
        entries: sortEntries(entries, prev.sortField, prev.sortDirection),
        loading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [sessionId, sftpService]);

  const refresh = useCallback(() => {
    navigate(state.currentPath);
  }, [navigate, state.currentPath]);

  const goUp = useCallback(() => {
    const parent = state.currentPath.replace(/\/[^/]+\/?$/, '') || '/';
    navigate(parent);
  }, [navigate, state.currentPath]);

  const goHome = useCallback(() => {
    navigate('~');
  }, [navigate]);

  const sort = useCallback((field: string) => {
    setState((prev) => {
      const sortField = field as SortField;
      const direction = prev.sortField === sortField && prev.sortDirection === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        sortField,
        sortDirection: direction,
        entries: sortEntries(prev.entries, sortField, direction),
      };
    });
  }, []);

  const select = useCallback((filename: string, multi = false) => {
    setState((prev) => {
      const next = new Set(multi ? prev.selectedFiles : []);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return { ...prev, selectedFiles: next };
    });
  }, []);

  const selectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedFiles: new Set(prev.entries.map((e) => e.filename)),
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => ({ ...prev, selectedFiles: new Set() }));
  }, []);

  // Auto-navigate to home on mount
  useEffect(() => {
    if (sessionId) {
      navigate('~');
    }
  }, [sessionId, navigate]);

  return {
    ...state,
    navigate,
    refresh,
    goUp,
    goHome,
    sort,
    select,
    selectAll,
    clearSelection,
  };
}

function sortEntries(entries: ISFTPFileEntry[], field: SortField, direction: SortDirection): ISFTPFileEntry[] {
  return entries.toSorted((a, b) => {
    // Directories always come first
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    let cmp = 0;
    switch (field) {
      case 'filename':
        cmp = a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' });
        break;
      case 'size':
        cmp = a.attrs.size - b.attrs.size;
        break;
      case 'mtime':
        cmp = a.attrs.mtime - b.attrs.mtime;
        break;
    }
    return direction === 'asc' ? cmp : -cmp;
  });
}
