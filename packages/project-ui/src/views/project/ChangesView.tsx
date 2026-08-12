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

import type { GitFileStatusCode } from '@termlnk/project';
import type { IDiffFile, IDiffFolderRow } from './diff-tree';
import { LocaleService } from '@termlnk/core';
import { cn, Diff, useDependency, useObservable } from '@termlnk/design';
import { ChevronDown, ChevronRight, Folder, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IProjectPanelService } from '../../services/project-panel.service';
import { BranchBar } from './BranchBar';
import { CommitBox } from './CommitBox';
import { buildDiffRows } from './diff-tree';

export function ChangesView() {
  const localeService = useDependency(LocaleService);
  const panel = useDependency(IProjectPanelService);

  const files = useObservable(panel.diffFiles$, []);
  const collapsed = useObservable(panel.collapsedDirs$, new Set<string>() as ReadonlySet<string>);
  const viewMode = useObservable(panel.viewMode$, 'tree');
  const selectedPath = useObservable(panel.selectedPath$, null);
  const error = useObservable(panel.error$, null);

  const rows = useMemo(
    () => buildDiffRows(files, { collapsed, flat: viewMode === 'flat' }),
    [files, collapsed, viewMode]
  );

  const totals = useMemo(() => ({
    additions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
  }), [files]);

  return (
    <div className="tm:flex tm:h-full tm:min-w-0 tm:flex-col tm:bg-black">
      <BranchBar />

      {error && (
        <div className="tm:px-2 tm:py-1 tm:text-[11px] tm:wrap-break-word tm:text-red">{error}</div>
      )}

      <div
        className={cn('tm:flex tm:h-7 tm:shrink-0 tm:items-center tm:gap-2 tm:px-2 tm:text-[11px] tm:text-grey')}
      >
        <span className="tm:truncate">
          {localeService.t('project-ui.changes.uncommitted', String(files.length))}
        </span>
        {files.length > 0 && (
          <span className="tm:ml-auto tm:shrink-0 tm:tabular-nums">
            <span className="tm:text-green">
              +
              {totals.additions}
            </span>
            <span className="tm:ml-1.5 tm:text-red">
              −
              {totals.deletions}
            </span>
          </span>
        )}
      </div>

      <div className="tm:min-h-0 tm:flex-1 tm:overflow-y-auto">
        {rows.length === 0 && (
          <div className="tm:px-2 tm:py-3 tm:text-center tm:text-[11px] tm:text-grey">
            {localeService.t('project-ui.changes.clean')}
          </div>
        )}
        {rows.map((row) => (
          row.kind === 'folder'
            ? (
              <FolderRow
                key={`d:${row.dirPath}`}
                row={row}
                onToggle={() => panel.toggleDir(row.dirPath)}
              />
            )
            : (
              <FileRow
                key={`f:${row.file.path}`}
                file={row.file}
                label={row.label}
                depth={row.depth}
                selected={row.file.path === selectedPath}
                stageLabel={localeService.t(
                  row.file.staged ? 'project-ui.git.unstage' : 'project-ui.git.stage'
                )}
                onSelect={() =>
                  panel.select(row.file.path === selectedPath ? null : row.file.path)}
                onStageToggle={() => {
                  void (row.file.staged
                    ? panel.unstage([row.file.path])
                    : panel.stage([row.file.path]));
                }}
              />
            )
        ))}
        {selectedPath && <SelectedDiff path={selectedPath} />}
      </div>

      <CommitBox />
    </div>
  );
}

function FolderRow({ row, onToggle }: { row: IDiffFolderRow; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(`
        tm:flex tm:w-full tm:items-center tm:gap-1 tm:py-0.5 tm:pr-2 tm:text-left tm:text-xs tm:text-grey-fg2
        tm:hover:bg-one-bg2
      `)}
      style={{ paddingLeft: 6 + row.depth * 12 }}
      title={row.dirPath}
    >
      {row.collapsed
        ? <ChevronRight size={12} className="tm:shrink-0 tm:text-grey" />
        : <ChevronDown size={12} className="tm:shrink-0 tm:text-grey" />}
      <Folder size={12} className="tm:shrink-0 tm:text-nord-blue" />
      <span className="tm:min-w-0 tm:flex-1 tm:truncate">{row.displayName}</span>
      <DiffCounts additions={row.additions} deletions={row.deletions} />
    </button>
  );
}

function FileRow({
  file,
  label,
  depth,
  selected,
  stageLabel,
  onSelect,
  onStageToggle,
}: {
  file: IDiffFile;
  label: string;
  depth: number;
  selected: boolean;
  stageLabel: string;
  onSelect: () => void;
  onStageToggle: () => void;
}) {
  return (
    <div
      className={cn(
        `
          tm:group
          tm:flex tm:items-center tm:gap-1 tm:pr-2
          tm:hover:bg-one-bg2
        `,
        { 'tm:bg-one-bg2': selected }
      )}
      style={{ paddingLeft: 6 + depth * 12 }}
    >
      <StatusBadge code={file.staged ? file.index : (file.worktree === 'unknown' ? file.index : file.worktree)} />
      <button
        type="button"
        onClick={onSelect}
        className="tm:min-w-0 tm:flex-1 tm:truncate tm:py-0.5 tm:text-left tm:text-xs tm:text-light-grey"
        title={file.origPath ? `${file.origPath} → ${file.path}` : file.path}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onStageToggle}
        className="
          tm:hidden tm:shrink-0 tm:text-[10px] tm:text-nord-blue
          tm:group-hover:inline
        "
      >
        {stageLabel}
      </button>
      {file.statsUnavailable
        ? <span className="tm:shrink-0 tm:text-[10px] tm:text-grey">—</span>
        : <DiffCounts additions={file.additions} deletions={file.deletions} binary={file.binary} />}
    </div>
  );
}

function DiffCounts({
  additions,
  deletions,
  binary,
}: {
  additions: number;
  deletions: number;
  binary?: boolean;
}) {
  if (binary) {
    return <span className="tm:shrink-0 tm:text-[10px] tm:text-grey">bin</span>;
  }
  return (
    <span className="tm:flex tm:shrink-0 tm:items-center tm:gap-1 tm:text-[10px] tm:tabular-nums">
      <span className="tm:flex tm:items-center tm:text-green">
        <Plus size={8} />
        {additions}
      </span>
      <span className="tm:flex tm:items-center tm:text-red">
        <Minus size={8} />
        {deletions}
      </span>
    </span>
  );
}

const BADGE_COLORS: Partial<Record<GitFileStatusCode, string>> = {
  added: 'tm:text-green',
  untracked: 'tm:text-green',
  modified: 'tm:text-yellow',
  deleted: 'tm:text-red',
  renamed: 'tm:text-nord-blue',
  copied: 'tm:text-nord-blue',
  unmerged: 'tm:text-red',
};

function StatusBadge({ code }: { code: GitFileStatusCode }) {
  const letter = code === 'untracked' ? 'U' : code[0]?.toUpperCase() ?? '?';
  return (
    <span
      className={cn(
        'tm:w-3 tm:shrink-0 tm:text-center tm:font-mono tm:text-[10px]',
        BADGE_COLORS[code] ?? 'tm:text-grey'
      )}
      title={code}
    >
      {letter}
    </span>
  );
}

/** Loads the unified diff for the row the user clicked. */
function SelectedDiff({ path }: { path: string }) {
  const panel = useDependency(IProjectPanelService);
  const localeService = useDependency(LocaleService);
  const [text, setText] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    const file = panel.diffFiles.find((f) => f.path === path);
    if (!file) {
      setText(null);
      return;
    }
    try {
      setText(await panel.diffOf(file));
      setFailure(null);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
  }, [panel, path]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failure) {
    return <div className="tm:px-2 tm:py-1 tm:text-[11px] tm:text-red">{failure}</div>;
  }
  if (text === null) {
    return null;
  }
  if (!text.trim()) {
    return (
      <div className="tm:p-2 tm:text-[11px] tm:text-grey">
        {localeService.t('project-ui.changes.no-diff')}
      </div>
    );
  }
  return (
    <div className="tm:border-t tm:border-line tm:p-2">
      <Diff unified={text} maxHeight={320} />
    </div>
  );
}
