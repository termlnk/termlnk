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

import type { IUpdateError, IUpdateInfo, IUpdateProgress, IUpdaterService } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { IWebRendererConfig, IWebUpdaterConfig } from '../../controllers/config.schema';
import { Disposable, IConfigService, ILogService, Inject, UpdateStatus } from '@termlnk/core';
import { HTTPResponseError, HTTPService } from '@termlnk/network';
import { BehaviorSubject, Subject, switchMap, timer } from 'rxjs';
import { WEB_RENDERER_PLUGIN_CONFIG_KEY } from '../../controllers/config.schema';

const DEFAULT_GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_REPO = 'termlnk/termlnk';
const DEFAULT_INITIAL_DELAY_MS = 30 * 1000;
const DEFAULT_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const NOT_SUPPORTED_MESSAGE
  = 'Update download/install is not supported in browser deployments. '
    + 'Please update your docker image or run git pull manually.';

interface IGithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface IGithubReleaseResponse {
  tag_name: string;
  name?: string;
  body?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: IGithubReleaseAsset[];
}

// Browser IUpdaterService: polls GitHub Releases on a long interval (default 24h) and
// surfaces a "new version available" hint via the desktop UpdateButton/UpdateDialog.
// downloadUpdate/quitAndInstall reject — operators roll out via docker image or git
// pull. The 24h cadence stays well under GitHub's 60 req/h anonymous rate-limit.
export class WebUpdaterService extends Disposable implements IUpdaterService {
  private readonly _status$ = new BehaviorSubject<UpdateStatus>(UpdateStatus.IDLE);
  readonly status$: Observable<UpdateStatus> = this._status$.asObservable();

  private readonly _updateInfo$ = new BehaviorSubject<IUpdateInfo | null>(null);
  readonly updateInfo$: Observable<IUpdateInfo | null> = this._updateInfo$.asObservable();

  private readonly _progress$ = new Subject<IUpdateProgress>();
  readonly progress$: Observable<IUpdateProgress> = this._progress$.asObservable();

  private readonly _error$ = new Subject<IUpdateError>();
  readonly error$: Observable<IUpdateError> = this._error$.asObservable();

  // Coalesce concurrent callers (controller boot + auto-check timer) into a
  // single network round-trip. Cleared in finally so subsequent checks run.
  private _inFlightCheck: Promise<IUpdateInfo | null> | null = null;

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService,
    @Inject(HTTPService) private readonly _httpService: HTTPService
  ) {
    super();
    this._startAutoCheck();
  }

  override dispose(): void {
    super.dispose();
    this._status$.complete();
    this._updateInfo$.complete();
    this._progress$.complete();
    this._error$.complete();
  }

  async getCurrentVersion(): Promise<string> {
    return this._readCurrentVersion();
  }

  async getStatus(): Promise<UpdateStatus> {
    return this._status$.getValue();
  }

  async checkForUpdates(): Promise<IUpdateInfo | null> {
    if (this._inFlightCheck) {
      return this._inFlightCheck;
    }
    this._inFlightCheck = this._doCheckForUpdates();
    try {
      return await this._inFlightCheck;
    } finally {
      this._inFlightCheck = null;
    }
  }

  async downloadUpdate(): Promise<void> {
    throw new Error(NOT_SUPPORTED_MESSAGE);
  }

  async quitAndInstall(): Promise<void> {
    throw new Error(NOT_SUPPORTED_MESSAGE);
  }

  private _startAutoCheck(): void {
    const { initialDelayMs, checkIntervalMs } = this._resolveUpdaterConfig();
    this.disposeWithMe(
      timer(initialDelayMs, checkIntervalMs)
        .pipe(switchMap(() => this.checkForUpdates().catch(() => null)))
        .subscribe()
    );
  }

  private async _doCheckForUpdates(): Promise<IUpdateInfo | null> {
    const { repo, githubApiBase } = this._resolveUpdaterConfig();
    this._status$.next(UpdateStatus.CHECKING);
    const url = `${githubApiBase}/repos/${repo}/releases/latest`;
    try {
      // Routed through HTTPService so the request picks up any registered
      // interceptors (auth, retry, threshold) and so node-side deployments
      // automatically inherit the proxy-aware fetch via IFetchProvider.
      const response = await this._httpService.get<IGithubReleaseResponse>(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        responseType: 'json',
      });
      const release = response.body;
      if (!release) {
        this._status$.next(UpdateStatus.NOT_AVAILABLE);
        return null;
      }
      // Skip drafts and prereleases — web users want stable releases only.
      if (release.draft || release.prerelease) {
        this._status$.next(UpdateStatus.NOT_AVAILABLE);
        return null;
      }
      const remoteVersion = stripTagPrefix(release.tag_name);
      const currentVersion = this._readCurrentVersion();
      if (!isNewerVersion(remoteVersion, currentVersion)) {
        this._status$.next(UpdateStatus.NOT_AVAILABLE);
        return null;
      }
      const info: IUpdateInfo = {
        version: remoteVersion,
        releaseDate: release.published_at ?? new Date().toISOString(),
        releaseNotes: release.body ?? null,
      };
      this._updateInfo$.next(info);
      this._status$.next(UpdateStatus.AVAILABLE);
      return info;
    } catch (err) {
      // HTTPResponseError carries status / statusText from the upstream
      // response — surface it explicitly so users see "403 rate-limited"
      // instead of an opaque "[object Object]" message.
      let message: string;
      let stack: string | undefined;
      if (err instanceof HTTPResponseError) {
        message = `GitHub API responded ${err.status}${err.statusText ? ` ${err.statusText}` : ''}`;
      } else if (err instanceof Error) {
        message = err.message;
        stack = err.stack;
      } else {
        message = String(err);
      }
      this._logService.warn('[WebUpdaterService] GitHub releases check failed:', message);
      this._error$.next({ message, stack });
      this._status$.next(UpdateStatus.ERROR);
      return null;
    }
  }

  private _resolveUpdaterConfig(): Required<Pick<IWebUpdaterConfig, 'repo' | 'githubApiBase' | 'initialDelayMs' | 'checkIntervalMs'>> {
    const cfg = this._configService.getConfig<IWebRendererConfig>(WEB_RENDERER_PLUGIN_CONFIG_KEY) ?? {};
    return {
      repo: cfg.updater?.repo ?? DEFAULT_REPO,
      githubApiBase: cfg.updater?.githubApiBase ?? DEFAULT_GITHUB_API_BASE,
      initialDelayMs: cfg.updater?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS,
      checkIntervalMs: cfg.updater?.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS,
    };
  }

  private _readCurrentVersion(): string {
    const cfg = this._configService.getConfig<IWebRendererConfig>(WEB_RENDERER_PLUGIN_CONFIG_KEY) ?? {};
    if (cfg.updater?.currentVersion) {
      return cfg.updater.currentVersion;
    }
    const fromBuild = (globalThis as { __APP_VERSION__?: string }).__APP_VERSION__;
    return typeof fromBuild === 'string' && fromBuild.length > 0 ? fromBuild : '0.0.0';
  }
}

/** Strip leading `v` from `vX.Y.Z`-style tag names that GitHub commonly uses. */
function stripTagPrefix(tag: string): string {
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

/**
 * Returns true if `remote` is strictly newer than `current`. Lightweight
 * comparison that handles `vX.Y.Z`, `X.Y.Z`, and `X.Y.Z-prerelease` formats
 * without pulling the full semver package — keeps the web bundle lean.
 *
 * Algorithm: compare numeric segments left-to-right (missing segments treated
 * as 0). When numeric portions are equal, a release without a prerelease tag
 * is newer than one with a prerelease tag. Two prerelease tags fall back to
 * lexicographic order, which matches semver for the common `alpha < beta < rc`
 * naming. Errors are swallowed and return false to avoid noisy false-positives
 * on malformed tags.
 */
function isNewerVersion(remote: string, current: string): boolean {
  try {
    const a = parseVersion(stripTagPrefix(remote));
    const b = parseVersion(stripTagPrefix(current));
    const len = Math.max(a.numbers.length, b.numbers.length);
    for (let i = 0; i < len; i++) {
      const x = a.numbers[i] ?? 0;
      const y = b.numbers[i] ?? 0;
      if (x !== y) {
        return x > y;
      }
    }
    if (!a.pre && b.pre) {
      return true;
    }
    if (a.pre && !b.pre) {
      return false;
    }
    return a.pre > b.pre;
  } catch {
    return false;
  }
}

function parseVersion(raw: string): { numbers: number[]; pre: string } {
  const [main, pre = ''] = raw.split('-', 2);
  const numbers = main.split('.').map((seg) => {
    const n = Number.parseInt(seg, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return { numbers, pre };
}
