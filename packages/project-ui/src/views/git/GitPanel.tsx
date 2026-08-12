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

import type { IGitFileStatus, IGitStatus } from '@termlnk/project';
import { LocaleService } from '@termlnk/core';
import { cn, Diff, useDependency, useObservable } from '@termlnk/design';
import { IProjectContextService, IProjectGitService } from '@termlnk/project';
import { GitBranch, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function GitPanel() {
  const localeService = useDependency(LocaleService);
  const projectContext = useDependency(IProjectContextService);
  const git = useDependency(IProjectGitService);
  const ctx = useObservable(projectContext.activeContext$, null);

  const [status, setStatus] = useState<IGitStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [diffText, setDiffText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!ctx?.isGitRepository) {
      setStatus(null);
      return;
    }
    setError(null);
    try {
      const s = await git.status(ctx);
      setStatus(s);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [ctx, git]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stage = async (paths: string[]) => {
    if (!ctx) {
      return;
    }
    setBusy(true);
    try {
      await git.stage(ctx, paths);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const unstage = async (paths: string[]) => {
    if (!ctx) {
      return;
    }
    setBusy(true);
    try {
      await git.unstage(ctx, paths);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!ctx || !message.trim()) {
      return;
    }
    setBusy(true);
    try {
      await git.commit(ctx, message.trim());
      setMessage('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const showDiff = async (file: IGitFileStatus, staged: boolean) => {
    if (!ctx) {
      return;
    }
    try {
      const text = await git.diff(ctx, { path: file.path, staged });
      setDiffText(text || '(no diff)');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!ctx) {
    return (
      <Empty label={localeService.t('project-ui.git.empty')} />
    );
  }

  if (!ctx.isGitRepository) {
    return (
      <Empty label={localeService.t('project-ui.git.not-a-repo')} />
    );
  }

  const staged = status?.files.filter((f) => f.index !== 'unknown' && f.index !== 'untracked') ?? [];
  const unstaged = status?.files.filter((f) =>
    f.worktree !== 'unknown' || f.index === 'untracked'
  ) ?? [];

  return (
    <div className="tm:flex tm:h-full tm:min-w-0 tm:flex-col tm:bg-black">
      <header
        className={cn(`
          tm:flex tm:h-9 tm:shrink-0 tm:items-center tm:gap-1.5 tm:border-b tm:border-line tm:bg-one-bg tm:px-2
        `)}
      >
        <GitBranch size={12} className="tm:text-nord-blue" />
        <span className="tm:min-w-0 tm:flex-1 tm:truncate tm:text-xs tm:text-light-grey">
          {status?.branch.name ?? '…'}
          {status && status.branch.ahead > 0 && (
            <span className="tm:ml-1 tm:text-green">
              ↑
              {status.branch.ahead}
            </span>
          )}
          {status && status.branch.behind > 0 && (
            <span className="tm:ml-1 tm:text-yellow">
              ↓
              {status.branch.behind}
            </span>
          )}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="
            tm:rounded-sm tm:p-1 tm:text-grey
            tm:hover:bg-one-bg2
          "
        >
          <RefreshCw size={12} />
        </button>
      </header>

      {error && <div className="tm:px-2 tm:py-1 tm:text-[11px] tm:text-red">{error}</div>}

      <div className="tm:min-h-0 tm:flex-1 tm:overflow-y-auto tm:p-2">
        <Section title={localeService.t('project-ui.git.staged')}>
          {staged.length === 0 && <EmptyRow text="—" />}
          {staged.map((f) => (
            <FileRow
              key={`s-${f.path}`}
              file={f}
              badge={f.index}
              onClick={() => void showDiff(f, true)}
              actionLabel={localeService.t('project-ui.git.unstage')}
              onAction={() => void unstage([f.path])}
            />
          ))}
        </Section>

        <Section title={localeService.t('project-ui.git.changes')}>
          {unstaged.length === 0 && <EmptyRow text="—" />}
          {unstaged.map((f) => (
            <FileRow
              key={`u-${f.path}`}
              file={f}
              badge={f.worktree === 'unknown' ? f.index : f.worktree}
              onClick={() => void showDiff(f, false)}
              actionLabel={localeService.t('project-ui.git.stage')}
              onAction={() => void stage([f.path])}
            />
          ))}
        </Section>

        {diffText !== null && (
          <div className="tm:mt-2">
            <div className="tm:mb-1 tm:flex tm:items-center tm:justify-between">
              <span className="tm:text-[11px] tm:text-grey-fg">{localeService.t('project-ui.git.diff')}</span>
              <button
                type="button"
                className="
                  tm:text-[11px] tm:text-grey
                  tm:hover:text-light-grey
                "
                onClick={() => setDiffText(null)}
              >
                {localeService.t('project-ui.git.close-diff')}
              </button>
            </div>
            <Diff unified={diffText} maxHeight={240} />
          </div>
        )}
      </div>

      <div className="tm:shrink-0 tm:border-t tm:border-line tm:p-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder={localeService.t('project-ui.git.commit-message')}
          className={cn(`
            tm:mb-1.5 tm:w-full tm:resize-none tm:rounded-sm tm:border tm:border-line tm:bg-black tm:px-2 tm:py-1.5
            tm:text-xs tm:text-light-grey tm:outline-none
            tm:placeholder:text-grey
            tm:focus:border-nord-blue
          `)}
        />
        <button
          type="button"
          disabled={busy || !message.trim() || staged.length === 0}
          onClick={() => void commit()}
          className={cn(
            'tm:h-7 tm:w-full tm:rounded-sm tm:text-xs tm:font-medium',
            message.trim() && staged.length > 0
              ? `
                tm:bg-nord-blue tm:text-white
                tm:hover:opacity-90
              `
              : 'tm:bg-one-bg2 tm:text-grey'
          )}
        >
          {localeService.t('project-ui.git.commit')}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="tm:mb-3">
      <div className="tm:mb-1 tm:text-[10px] tm:font-medium tm:tracking-wide tm:text-grey tm:uppercase">
        {title}
      </div>
      <div className="tm:flex tm:flex-col tm:gap-0.5">{children}</div>
    </section>
  );
}

function FileRow({
  file,
  badge,
  onClick,
  actionLabel,
  onAction,
}: {
  file: IGitFileStatus;
  badge: string;
  onClick: () => void;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className="
        tm:group
        tm:flex tm:items-center tm:gap-1 tm:rounded-sm tm:px-1
        tm:hover:bg-one-bg2
      "
    >
      <button
        type="button"
        onClick={onClick}
        className="tm:min-w-0 tm:flex-1 tm:truncate tm:py-0.5 tm:text-left tm:text-xs tm:text-light-grey"
        title={file.path}
      >
        <span className="tm:mr-1.5 tm:font-mono tm:text-[10px] tm:text-yellow">{badge[0]?.toUpperCase()}</span>
        {file.path}
      </button>
      <button
        type="button"
        onClick={onAction}
        className="
          tm:hidden tm:text-[10px] tm:text-nord-blue
          tm:group-hover:inline
        "
      >
        {actionLabel}
      </button>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="tm:px-1 tm:text-[11px] tm:text-grey">{text}</div>;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:px-3 tm:text-center tm:text-xs tm:text-grey">
      {label}
    </div>
  );
}
