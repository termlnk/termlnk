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

import type { IProjectContext, IProjectFileEntry } from '@termlnk/project';
import { IContextService, LocaleService } from '@termlnk/core';
import { cn, useDependency, useObservable, VirtualList } from '@termlnk/design';
import { IProjectFsService } from '@termlnk/project';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXPLORER_FOCUSED_CONTEXT } from '../../common/constants';
import { IProjectExplorerService } from '../../services/project-explorer.service';
import { IProjectPanelService } from '../../services/project-panel.service';

interface ITreeNode {
  entry: IProjectFileEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
}

const ROW_HEIGHT = 24;

export function FilesView() {
  const localeService = useDependency(LocaleService);
  const contextService = useDependency(IContextService);
  const fs = useDependency(IProjectFsService);
  const explorerService = useDependency(IProjectExplorerService);
  const panel = useDependency(IProjectPanelService);

  const ctx = useObservable(panel.context$, null);
  const showHidden = useObservable(panel.showHiddenFiles$, false);
  const [nodes, setNodes] = useState<ITreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const loadRoot = useCallback(async (context: IProjectContext) => {
    setError(null);
    try {
      const entries = await fs.list(context, context.rootPath || context.cwd);
      setNodes(
        entries.map((entry) => ({
          entry,
          depth: 0,
          expanded: false,
          loading: false,
        }))
      );
    } catch (err) {
      setNodes([]);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [fs]);

  useEffect(() => {
    if (!ctx) {
      setNodes([]);
      return;
    }
    void loadRoot(ctx);
  }, [ctx, loadRoot]);

  // Explicit refresh (tab-bar button) and branch switches both land here.
  useEffect(() => {
    const sub = panel.fileTreeRefresh$.subscribe(() => {
      const context = panel.context;
      if (context) {
        void loadRoot(context);
      }
    });
    return () => sub.unsubscribe();
  }, [panel, loadRoot]);

  const toggleDir = useCallback(async (path: string) => {
    if (!ctx) {
      return;
    }
    const current = nodes.find((n) => n.entry.path === path);
    if (!current || current.entry.type !== 'directory') {
      return;
    }

    if (current.expanded) {
      setNodes((prev) => {
        const index = prev.findIndex((n) => n.entry.path === path);
        if (index < 0) {
          return prev;
        }
        const depth = prev[index].depth;
        const next: ITreeNode[] = [];
        for (let i = 0; i < prev.length; i += 1) {
          if (i === index) {
            next.push({ ...prev[i], expanded: false });
            continue;
          }
          if (i > index && prev[i].depth > depth) {
            continue;
          }
          next.push(prev[i]);
        }
        return next;
      });
      return;
    }

    setNodes((prev) =>
      prev.map((n) => (n.entry.path === path ? { ...n, loading: true } : n))
    );

    try {
      const children = await fs.list(ctx, path);
      setNodes((prev) => {
        const index = prev.findIndex((n) => n.entry.path === path);
        if (index < 0) {
          return prev;
        }
        const target = prev[index];
        if (target.expanded) {
          return prev;
        }
        const next = prev.slice();
        next[index] = { ...target, expanded: true, loading: false };
        next.splice(index + 1, 0, ...children.map((entry) => ({
          entry,
          depth: target.depth + 1,
          expanded: false,
          loading: false,
        })));
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setNodes((prev) =>
        prev.map((n) => (n.entry.path === path ? { ...n, loading: false } : n))
      );
    }
  }, [ctx, fs, nodes]);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return nodes.filter((n) => {
      if (!showHidden && n.entry.name.startsWith('.')) {
        return false;
      }
      return !query || n.entry.name.toLowerCase().includes(query);
    });
  }, [nodes, filter, showHidden]);

  const handleFocus = useCallback(() => {
    contextService.setContextValue(EXPLORER_FOCUSED_CONTEXT, true);
  }, [contextService]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      contextService.setContextValue(EXPLORER_FOCUSED_CONTEXT, false);
    }
  }, [contextService]);

  useEffect(() => () => {
    contextService.setContextValue(EXPLORER_FOCUSED_CONTEXT, false);
  }, [contextService]);

  useEffect(() => {
    const sub = explorerService.focusFilterRequest$.subscribe(() => {
      filterRef.current?.focus();
      filterRef.current?.select();
    });
    return () => sub.unsubscribe();
  }, [explorerService]);

  return (
    <div
      ref={containerRef}
      className="tm:flex tm:h-full tm:min-w-0 tm:flex-col tm:bg-black"
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      <div className="tm:border-b tm:border-line tm:px-2 tm:py-1.5">
        <input
          ref={filterRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={localeService.t('project-ui.explorer.filter')}
          className={cn(`
            tm:h-7 tm:w-full tm:rounded-sm tm:border tm:border-line tm:bg-black tm:px-2 tm:text-xs tm:text-light-grey
            tm:outline-none
            tm:placeholder:text-grey
            tm:focus:border-nord-blue
          `)}
        />
      </div>

      {error && (
        <div className="tm:px-2 tm:py-1 tm:text-[11px] tm:wrap-break-word tm:text-red">{error}</div>
      )}

      {ctx && (
        <div className="tm:truncate tm:px-2 tm:py-1 tm:text-[10px] tm:text-grey" title={ctx.rootPath}>
          {ctx.scope === 'remote' ? `${ctx.hostId}:` : ''}
          {ctx.rootPath}
        </div>
      )}

      <div className="tm:min-h-0 tm:flex-1">
        <VirtualList
          items={visible}
          itemHeight={ROW_HEIGHT}
          height="100%"
          className="tm:h-full"
          getItemKey={(n) => n.entry.path}
          renderItem={(node) => {
            const isDir = node.entry.type === 'directory';
            return (
              <button
                type="button"
                onClick={() => {
                  if (isDir) {
                    void toggleDir(node.entry.path);
                  }
                }}
                className={cn(`
                  tm:flex tm:size-full tm:items-center tm:gap-1 tm:px-1 tm:text-left tm:text-xs tm:text-light-grey
                  tm:hover:bg-one-bg2
                `)}
                style={{ paddingLeft: 6 + node.depth * 12 }}
              >
                {isDir
                  ? (node.expanded
                    ? <ChevronDown size={12} className="tm:shrink-0 tm:text-grey" />
                    : <ChevronRight size={12} className="tm:shrink-0 tm:text-grey" />)
                  : <span className="tm:w-3" />}
                {isDir
                  ? (node.expanded
                    ? <FolderOpen size={13} className="tm:shrink-0 tm:text-nord-blue" />
                    : <Folder size={13} className="tm:shrink-0 tm:text-nord-blue" />)
                  : <File size={13} className="tm:shrink-0 tm:text-grey-fg" />}
                <span className="tm:min-w-0 tm:truncate">{node.entry.name}</span>
              </button>
            );
          }}
        />
      </div>
    </div>
  );
}
