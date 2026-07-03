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

import { useDependency } from '@termlnk/design';
import { IRPCClientService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useState } from 'react';

interface ILocalFsClient {
  list: { query: (path: string) => Promise<ILocalFileEntry[]> };
  stat: { query: (path: string) => Promise<{ size: number; mtime: number; atime: number; mode: number; isDirectory: boolean; isSymlink: boolean }> };
  getHomePath: { query: () => Promise<string> };
  getSeparator: { query: () => Promise<string> };
  exists: { query: (path: string) => Promise<boolean> };
}

export interface ILocalFileEntry {
  filename: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  mtime: number;
  atime: number;
  mode: number;
}

export type SortField = 'filename' | 'size' | 'mtime';
export type SortDirection = 'asc' | 'desc';

export interface ILocalBrowserState {
  currentPath: string;
  entries: ILocalFileEntry[];
  loading: boolean;
  error: string | null;
  selectedFiles: Set<string>;
  sortField: SortField;
  sortDirection: SortDirection;
}

export function useLocalFileBrowser() {
  const rpcClient = useDependency(IRPCClientService);
  const [state, setState] = useState<ILocalBrowserState>({
    currentPath: '',
    entries: [],
    loading: true,
    error: null,
    selectedFiles: new Set(),
    sortField: 'filename',
    sortDirection: 'asc',
  });

  // localFs router is merged at runtime in electron-main's RPCController
  const client = (rpcClient.getClient() as any).localFs as ILocalFsClient;

  const navigate = useCallback(async (path: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null, selectedFiles: new Set() }));
    try {
      let resolvedPath = path;
      if (!resolvedPath) {
        resolvedPath = await client.getHomePath.query();
      }
      const entries: ILocalFileEntry[] = await client.list.query(resolvedPath);
      setState((prev) => ({
        ...prev,
        currentPath: resolvedPath,
        entries: sortLocalEntries(entries, prev.sortField, prev.sortDirection),
        loading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [client]);

  const refresh = useCallback(() => {
    navigate(state.currentPath);
  }, [navigate, state.currentPath]);

  const goUp = useCallback(async () => {
    const sep = await client.getSeparator.query();
    const escapedSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parent = state.currentPath.replace(new RegExp(`[${escapedSep}][^${escapedSep}]+[${escapedSep}]?$`), '') || sep;
    navigate(parent);
  }, [navigate, state.currentPath, client]);

  const goHome = useCallback(() => {
    navigate('');
  }, [navigate]);

  const sort = useCallback((field: string) => {
    setState((prev) => {
      const sortField = field as SortField;
      const direction = prev.sortField === sortField && prev.sortDirection === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        sortField,
        sortDirection: direction,
        entries: sortLocalEntries(prev.entries, sortField, direction),
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

  useEffect(() => {
    navigate('');
  }, [navigate]);

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

function sortLocalEntries(entries: ILocalFileEntry[], field: SortField, direction: SortDirection): ILocalFileEntry[] {
  return entries.toSorted((a, b) => {
    if (a.isDirectory && !b.isDirectory) {
      return -1;
    }
    if (!a.isDirectory && b.isDirectory) {
      return 1;
    }

    let cmp = 0;
    switch (field) {
      case 'filename':
        cmp = a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' });
        break;
      case 'size':
        cmp = a.size - b.size;
        break;
      case 'mtime':
        cmp = a.mtime - b.mtime;
        break;
    }
    return direction === 'asc' ? cmp : -cmp;
  });
}
