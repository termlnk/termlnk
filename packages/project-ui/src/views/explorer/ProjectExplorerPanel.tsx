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
import { IProjectContextService, IProjectFsService } from '@termlnk/project';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXPLORER_FOCUSED_CONTEXT } from '../../common/constants';
import { IProjectExplorerService } from '../../services/project-explorer.service';

interface ITreeNode {
  entry: IProjectFileEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
}

const ROW_HEIGHT = 24;

export function ProjectExplorerPanel() {
  const localeService = useDependency(LocaleService);
  const contextService = useDependency(IContextService);
  const projectContext = useDependency(IProjectContextService);
  const fs = useDependency(IProjectFsService);
  const explorerService = useDependency(IProjectExplorerService);

  const ctx = useObservable(projectContext.activeContext$, null);
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

  const toggleDir = useCallback(async (path: string) => {
    if (!ctx) {
      return;
    }
    setNodes((prev) => {
      const index = prev.findIndex((n) => n.entry.path === path);
      if (index < 0) {
        return prev;
      }
      const target = prev[index];
      if (target.entry.type !== 'directory') {
        return prev;
      }

      if (target.expanded) {
        const depth = target.depth;
        const next: ITreeNode[] = [];
        for (let i = 0; i < prev.length; i += 1) {
          if (i === index) {
            next.push({ ...target, expanded: false });
            continue;
          }
          if (i > index && prev[i].depth > depth) {
            continue;
          }
          next.push(prev[i]);
        }
        return next;
      }

      // Mark loading; children load async below.
      return prev.map((n) =>
        n.entry.path === path ? { ...n, loading: true } : n
      );
    });

    // If collapsing, the state update above already finished.
    const current = nodes.find((n) => n.entry.path === path);
    if (current?.expanded) {
      return;
    }

    try {
      const children = await fs.list(ctx, path);
      const childNodes: ITreeNode[] = children.map((entry) => ({
        entry,
        depth: (current?.depth ?? 0) + 1,
        expanded: false,
        loading: false,
      }));
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
        next[index] = {
          ...target,
          expanded: true,
          loading: false,
          depth: target.depth,
        };
        const kids = children.map((entry) => ({
          entry,
          depth: target.depth + 1,
          expanded: false,
          loading: false,
        }));
        next.splice(index + 1, 0, ...kids);
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
    if (!filter.trim()) {
      return nodes;
    }
    const q = filter.trim().toLowerCase();
    return nodes.filter((n) => n.entry.name.toLowerCase().includes(q));
  }, [nodes, filter]);

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
      <header
        className={cn(`
          tm:flex tm:h-9 tm:shrink-0 tm:items-center tm:gap-1.5 tm:border-b tm:border-line tm:bg-one-bg tm:px-2
        `)}
      >
        <span className="tm:min-w-0 tm:flex-1 tm:truncate tm:text-xs tm:font-medium tm:text-light-grey">
          {localeService.t('project-ui.explorer.title')}
        </span>
        {ctx && (
          <button
            type="button"
            title={localeService.t('project-ui.explorer.refresh')}
            onClick={() => void loadRoot(ctx)}
            className="
              tm:rounded-sm tm:p-1 tm:text-grey
              tm:hover:bg-one-bg2 tm:hover:text-light-grey
            "
          >
            <RefreshCw size={12} />
          </button>
        )}
      </header>

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

      {!ctx && (
        <div
          className="tm:flex tm:flex-1 tm:items-center tm:justify-center tm:px-3 tm:text-center tm:text-xs tm:text-grey"
        >
          {localeService.t('project-ui.explorer.empty')}
        </div>
      )}

      {error && (
        <div className="tm:px-2 tm:py-1 tm:text-[11px] tm:text-red">{error}</div>
      )}

      {ctx && (
        <>
          <div className="tm:truncate tm:px-2 tm:py-1 tm:text-[10px] tm:text-grey" title={ctx.rootPath}>
            {ctx.scope === 'remote' ? `${ctx.hostId}:` : ''}
            {ctx.rootPath}
          </div>
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
        </>
      )}
    </div>
  );
}
