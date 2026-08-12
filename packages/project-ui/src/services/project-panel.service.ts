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

import type { Nullable } from '@termlnk/core';
import type { IGitBranch, IGitBranchInfo, IProjectContext } from '@termlnk/project';
import type { Observable } from 'rxjs';
import type { IDiffFile } from '../views/project/diff-tree';
import { createIdentifier, Disposable, ILogService } from '@termlnk/core';
import { IProjectContextService, IProjectGitService } from '@termlnk/project';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { collectDirPaths } from '../views/project/diff-tree';

export type ProjectDiffViewMode = 'tree' | 'flat';

/**
 * Model behind both faces of the project panel (Changes and Files).
 *
 * It lives in DI rather than in component state because the two views are
 * separate side-panel tabs: keeping the collapse set, the selection and the
 * fetched git state here is what makes switching tabs lossless.
 */
export interface IProjectPanelService {
  readonly context$: Observable<Nullable<IProjectContext>>;
  readonly branch$: Observable<Nullable<IGitBranchInfo>>;
  readonly branches$: Observable<IGitBranch[]>;
  readonly diffFiles$: Observable<IDiffFile[]>;
  readonly busy$: Observable<boolean>;
  readonly error$: Observable<Nullable<string>>;
  readonly collapsedDirs$: Observable<ReadonlySet<string>>;
  readonly selectedPath$: Observable<Nullable<string>>;
  readonly viewMode$: Observable<ProjectDiffViewMode>;
  readonly showHiddenFiles$: Observable<boolean>;
  /** Fires when the Files tab should re-read the tree from disk. */
  readonly fileTreeRefresh$: Observable<void>;

  get context(): Nullable<IProjectContext>;
  get diffFiles(): IDiffFile[];
  get viewMode(): ProjectDiffViewMode;
  get showHiddenFiles(): boolean;

  refreshStatus(): Promise<void>;
  refreshBranches(): Promise<void>;
  checkout(branch: string, remote?: boolean): Promise<void>;
  stage(paths: string[]): Promise<void>;
  unstage(paths: string[]): Promise<void>;
  commit(message: string): Promise<void>;
  diffOf(file: IDiffFile): Promise<string>;

  toggleDir(dirPath: string): void;
  setAllCollapsed(collapsed: boolean): void;
  select(path: Nullable<string>): void;
  setViewMode(mode: ProjectDiffViewMode): void;
  toggleHiddenFiles(): void;
  requestFileTreeRefresh(): void;
}

export const IProjectPanelService = createIdentifier<IProjectPanelService>(
  'project-ui.project-panel-service'
);

export class ProjectPanelService extends Disposable implements IProjectPanelService {
  private readonly _context$ = new BehaviorSubject<Nullable<IProjectContext>>(null);
  private readonly _branch$ = new BehaviorSubject<Nullable<IGitBranchInfo>>(null);
  private readonly _branches$ = new BehaviorSubject<IGitBranch[]>([]);
  private readonly _diffFiles$ = new BehaviorSubject<IDiffFile[]>([]);
  private readonly _busy$ = new BehaviorSubject<boolean>(false);
  private readonly _error$ = new BehaviorSubject<Nullable<string>>(null);
  private readonly _collapsedDirs$ = new BehaviorSubject<ReadonlySet<string>>(new Set());
  private readonly _selectedPath$ = new BehaviorSubject<Nullable<string>>(null);
  private readonly _viewMode$ = new BehaviorSubject<ProjectDiffViewMode>('tree');
  private readonly _showHiddenFiles$ = new BehaviorSubject<boolean>(false);
  private readonly _fileTreeRefresh$ = new Subject<void>();
  private readonly _disposed$ = new Subject<void>();

  readonly context$: Observable<Nullable<IProjectContext>> = this._context$.asObservable();
  readonly branch$: Observable<Nullable<IGitBranchInfo>> = this._branch$.asObservable();
  readonly branches$: Observable<IGitBranch[]> = this._branches$.asObservable();
  readonly diffFiles$: Observable<IDiffFile[]> = this._diffFiles$.asObservable();
  readonly busy$: Observable<boolean> = this._busy$.asObservable();
  readonly error$: Observable<Nullable<string>> = this._error$.asObservable();
  readonly collapsedDirs$: Observable<ReadonlySet<string>> = this._collapsedDirs$.asObservable();
  readonly selectedPath$: Observable<Nullable<string>> = this._selectedPath$.asObservable();
  readonly viewMode$: Observable<ProjectDiffViewMode> = this._viewMode$.asObservable();
  readonly showHiddenFiles$: Observable<boolean> = this._showHiddenFiles$.asObservable();
  readonly fileTreeRefresh$: Observable<void> = this._fileTreeRefresh$.asObservable();

  constructor(
    @IProjectContextService private readonly _projectContext: IProjectContextService,
    @IProjectGitService private readonly _git: IProjectGitService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._projectContext.activeContext$
      .pipe(takeUntil(this._disposed$))
      .subscribe((context) => {
        this._context$.next(context);
        // Selection and diff state belong to the previous repository.
        this._selectedPath$.next(null);
        this._diffFiles$.next([]);
        this._branch$.next(null);
        this._branches$.next([]);
        this._error$.next(null);
        this._collapsedDirs$.next(new Set());
        void this.refreshStatus();
      });
  }

  get context(): Nullable<IProjectContext> {
    return this._context$.getValue();
  }

  get diffFiles(): IDiffFile[] {
    return this._diffFiles$.getValue();
  }

  get viewMode(): ProjectDiffViewMode {
    return this._viewMode$.getValue();
  }

  get showHiddenFiles(): boolean {
    return this._showHiddenFiles$.getValue();
  }

  async refreshStatus(): Promise<void> {
    const context = this.context;
    if (!context?.isGitRepository) {
      this._diffFiles$.next([]);
      this._branch$.next(null);
      return;
    }

    this._busy$.next(true);
    try {
      // One round trip each: status knows *what* changed, numstat knows how
      // much. numstat is allowed to fail (a repository with no commits has no
      // HEAD to diff against) without losing the file list.
      const [status, stats] = await Promise.all([
        this._git.status(context),
        this._git.numstat(context).catch((err) => {
          this._logService.debug(`[ProjectPanel] numstat unavailable: ${String(err)}`);
          return [];
        }),
      ]);

      const statByPath = new Map(stats.map((s) => [s.path, s]));
      const files: IDiffFile[] = status.files
        .filter((f) => f.index !== 'ignored')
        .map((f) => {
          const stat = statByPath.get(f.path);
          const untracked = f.index === 'untracked';
          return {
            path: f.path,
            origPath: f.origPath ?? stat?.origPath,
            index: f.index,
            worktree: f.worktree,
            staged: f.index !== 'unknown' && !untracked && f.worktree === 'unknown',
            additions: stat?.additions ?? 0,
            deletions: stat?.deletions ?? 0,
            binary: stat?.binary ?? false,
            statsUnavailable: untracked || !stat,
          };
        });

      this._branch$.next(status.branch);
      this._diffFiles$.next(files);
      this._error$.next(null);
    } catch (err) {
      this._diffFiles$.next([]);
      this._error$.next(this._messageOf(err));
    } finally {
      this._busy$.next(false);
    }
  }

  async refreshBranches(): Promise<void> {
    const context = this.context;
    if (!context?.isGitRepository) {
      this._branches$.next([]);
      return;
    }
    try {
      this._branches$.next(await this._git.branches(context));
    } catch (err) {
      this._error$.next(this._messageOf(err));
    }
  }

  async checkout(branch: string, remote = false): Promise<void> {
    const context = this.context;
    if (!context) {
      return;
    }
    this._busy$.next(true);
    try {
      await this._git.checkout(context, branch, { remote });
      this._error$.next(null);
      // The work tree moved: both the diff and the file tree are stale.
      this._collapsedDirs$.next(new Set());
      this._selectedPath$.next(null);
      this._fileTreeRefresh$.next();
      await this.refreshStatus();
      await this.refreshBranches();
    } catch (err) {
      this._error$.next(this._messageOf(err));
    } finally {
      this._busy$.next(false);
    }
  }

  async stage(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    await this._mutate((context) => this._git.stage(context, paths));
  }

  async unstage(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    await this._mutate((context) => this._git.unstage(context, paths));
  }

  async commit(message: string): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    await this._mutate((context) => this._git.commit(context, trimmed));
  }

  async diffOf(file: IDiffFile): Promise<string> {
    const context = this.context;
    if (!context) {
      return '';
    }
    return this._git.diff(context, { path: file.path, staged: file.staged });
  }

  toggleDir(dirPath: string): void {
    const next = new Set(this._collapsedDirs$.getValue());
    if (!next.delete(dirPath)) {
      next.add(dirPath);
    }
    this._collapsedDirs$.next(next);
  }

  setAllCollapsed(collapsed: boolean): void {
    this._collapsedDirs$.next(
      collapsed ? new Set(collectDirPaths(this.diffFiles)) : new Set()
    );
  }

  select(path: Nullable<string>): void {
    this._selectedPath$.next(path);
  }

  setViewMode(mode: ProjectDiffViewMode): void {
    this._viewMode$.next(mode);
  }

  toggleHiddenFiles(): void {
    this._showHiddenFiles$.next(!this._showHiddenFiles$.getValue());
  }

  requestFileTreeRefresh(): void {
    this._fileTreeRefresh$.next();
  }

  override dispose(): void {
    super.dispose();
    this._disposed$.next();
    this._disposed$.complete();
    this._context$.complete();
    this._branch$.complete();
    this._branches$.complete();
    this._diffFiles$.complete();
    this._busy$.complete();
    this._error$.complete();
    this._collapsedDirs$.complete();
    this._selectedPath$.complete();
    this._viewMode$.complete();
    this._showHiddenFiles$.complete();
    this._fileTreeRefresh$.complete();
  }

  private async _mutate(run: (context: IProjectContext) => Promise<void>): Promise<void> {
    const context = this.context;
    if (!context) {
      return;
    }
    this._busy$.next(true);
    try {
      await run(context);
      this._error$.next(null);
      await this.refreshStatus();
    } catch (err) {
      this._error$.next(this._messageOf(err));
    } finally {
      this._busy$.next(false);
    }
  }

  private _messageOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
