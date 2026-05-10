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
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { Disposable, ILogService, UpdateStatus } from '@termlnk/core';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { BehaviorSubject, Subject, switchMap, timer } from 'rxjs';
import { gt as semverGt, prerelease as semverPrerelease } from 'semver';

/** Default stable channel name used by electron-builder (maps to `latest-<os>.yml`) */
const STABLE_CHANNEL = 'latest';

/** Lock file under pending/. If present at startup, the previous session was killed mid-download — clear stale artifacts. */
const DOWNLOAD_LOCK_FILENAME = '.termlnk-download.lock';

interface IUpdateCandidate {
  info: IUpdateInfo;
  version: string;
  channel: string;
}

export class UpdaterService extends Disposable implements IUpdaterService {
  private static readonly _INITIAL_CHECK_DELAY_MS = 5 * 1000;
  private static readonly _AUTO_CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;

  private readonly _status$ = new BehaviorSubject<UpdateStatus>(UpdateStatus.IDLE);
  readonly status$: Observable<UpdateStatus> = this._status$.asObservable();

  private readonly _updateInfo$ = new BehaviorSubject<IUpdateInfo | null>(null);
  readonly updateInfo$: Observable<IUpdateInfo | null> = this._updateInfo$.asObservable();

  private readonly _progress$ = new Subject<IUpdateProgress>();
  readonly progress$: Observable<IUpdateProgress> = this._progress$.asObservable();

  private readonly _error$ = new Subject<IUpdateError>();
  readonly error$: Observable<IUpdateError> = this._error$.asObservable();

  /** Prerelease channel extracted from the current version (e.g. "beta"), or null for stable */
  private readonly _prereleaseChannel: string | null;

  /** Suppresses event handlers during multi-channel check to avoid intermediate status flicker */
  private _isMultiChannelChecking = false;

  /** Shared by concurrent callers (controller + scheduler) so they make only one network round-trip */
  private _inFlightCheck: Promise<IUpdateInfo | null> | null = null;

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    this._prereleaseChannel = extractPrereleaseChannel(app.getVersion());
    if (this._prereleaseChannel) {
      this._setChannel(this._prereleaseChannel);
    }

    this._bindEvents();
    void this._cleanupOrphanedDownload();
    this._startAutoCheck();
  }

  override dispose(): void {
    super.dispose();
    autoUpdater.removeAllListeners();
    this._status$.complete();
    this._updateInfo$.complete();
    this._progress$.complete();
    this._error$.complete();
  }

  async getCurrentVersion(): Promise<string> {
    return app.getVersion();
  }

  async getStatus(): Promise<UpdateStatus> {
    return this._status$.getValue();
  }

  async checkForUpdates(): Promise<IUpdateInfo | null> {
    if (!app.isPackaged) {
      this._logService.warn('[UpdaterService] Skipping update check in development mode');
      return null;
    }

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
    if (!app.isPackaged) {
      this._logService.warn('[UpdaterService] Skipping download in development mode');
      return;
    }

    await this._writeDownloadLock();
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      // Synchronous throws skip the 'error' event handler, so clear the lock here.
      await this._removeDownloadLock();
      throw err;
    }
  }

  async quitAndInstall(isSilent = false, isForceRunAfter = true): Promise<void> {
    autoUpdater.quitAndInstall(isSilent, isForceRunAfter);
  }

  private async _doCheckForUpdates(): Promise<IUpdateInfo | null> {
    this._status$.next(UpdateStatus.CHECKING);

    const currentVersion = app.getVersion();
    const channels = this._prereleaseChannel
      ? [this._prereleaseChannel, STABLE_CHANNEL]
      : [STABLE_CHANNEL];

    const best = await this._pickBestAcrossChannels(channels, currentVersion);

    if (!best) {
      this._status$.next(UpdateStatus.NOT_AVAILABLE);
      return null;
    }

    // Pin the winning channel so a subsequent downloadUpdate() fetches the right artifact
    this._setChannel(best.channel);
    this._status$.next(UpdateStatus.AVAILABLE);
    this._updateInfo$.next(best.info);
    return best.info;
  }

  // ---------------------------------------------------------------------------
  // Channel orchestration
  // ---------------------------------------------------------------------------

  /**
   * Query each channel sequentially and return the candidate with the highest
   * semver version (per `semver.gt`). Returns `null` if no channel surfaces a
   * newer version than `currentVersion`.
   *
   * Version algebra (prerelease ordering, cross-channel compare, etc.) is
   * delegated to the `semver` package — the same one electron-updater uses
   * internally — so this service never hand-rolls version comparisons.
   */
  private async _pickBestAcrossChannels(
    channels: string[],
    currentVersion: string
  ): Promise<IUpdateCandidate | null> {
    this._isMultiChannelChecking = channels.length > 1;
    try {
      let best: IUpdateCandidate | null = null;
      for (const channel of channels) {
        const candidate = await this._checkChannel(channel, currentVersion);
        if (!candidate) {
          continue;
        }
        if (!best || semverGt(candidate.version, best.version)) {
          best = candidate;
        }
      }
      return best;
    } finally {
      this._isMultiChannelChecking = false;
    }
  }

  /**
   * Fetch a single channel's manifest and return a candidate iff its version
   * is strictly greater than `currentVersion`. Errors (network, 404, invalid
   * yml) are swallowed so one missing channel cannot break the other.
   */
  private async _checkChannel(channel: string, currentVersion: string): Promise<IUpdateCandidate | null> {
    this._setChannel(channel);
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        return null;
      }
      const remoteVersion = result.updateInfo.version;
      if (!semverGt(remoteVersion, currentVersion)) {
        return null;
      }
      return {
        info: mapUpdateInfo(result.updateInfo),
        version: remoteVersion,
        channel,
      };
    } catch (err) {
      this._logService.warn(`[UpdaterService] Channel "${channel}" check failed`, err);
      return null;
    }
  }

  /**
   * Point electron-updater at `channel`. Setting `channel` via the setter
   * implicitly flips `allowDowngrade` to `true` (see AppUpdater.ts upstream);
   * we force it back to `false` so beta users are never silently rolled back
   * to an older stable than they are currently running.
   */
  private _setChannel(channel: string): void {
    autoUpdater.channel = channel;
    autoUpdater.allowDowngrade = false;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  private _startAutoCheck(): void {
    if (!app.isPackaged) {
      return;
    }

    this.disposeWithMe(
      timer(
        UpdaterService._INITIAL_CHECK_DELAY_MS,
        UpdaterService._AUTO_CHECK_INTERVAL_MS
      ).pipe(
        switchMap(() => this.checkForUpdates().catch(() => null))
      ).subscribe()
    );
  }

  // ---------------------------------------------------------------------------
  // Download cache hygiene
  // ---------------------------------------------------------------------------

  /** Mirrors electron-updater's `getAppCacheDir()`; Electron typings dropped `'cache'` from PathName so we resolve manually. */
  private _getPendingCacheDir(): string {
    let baseCachePath: string;
    if (process.platform === 'win32') {
      baseCachePath = process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local');
    } else if (process.platform === 'darwin') {
      baseCachePath = path.join(homedir(), 'Library', 'Caches');
    } else {
      baseCachePath = process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache');
    }
    return path.join(baseCachePath, `${app.name}-updater`, 'pending');
  }

  private _getDownloadLockPath(): string {
    return path.join(this._getPendingCacheDir(), DOWNLOAD_LOCK_FILENAME);
  }

  private async _writeDownloadLock(): Promise<void> {
    const lockPath = this._getDownloadLockPath();
    try {
      await fs.mkdir(path.dirname(lockPath), { recursive: true });
      await fs.writeFile(lockPath, String(Date.now()), 'utf-8');
    } catch (err) {
      this._logService.warn('[UpdaterService] Failed to write download lock', err);
    }
  }

  private async _removeDownloadLock(): Promise<void> {
    try {
      await fs.unlink(this._getDownloadLockPath());
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException | null)?.code;
      if (code && code !== 'ENOENT') {
        this._logService.warn('[UpdaterService] Failed to remove download lock', err);
      }
    }
  }

  /** Wipe the entire pending/ dir: electron-updater's partial-file naming varies by version and a stale `.blockmap` can corrupt the next differential download. */
  private async _cleanupOrphanedDownload(): Promise<void> {
    if (!app.isPackaged) {
      return;
    }

    const lockPath = this._getDownloadLockPath();
    try {
      await fs.access(lockPath);
    } catch {
      return;
    }

    const pendingDir = this._getPendingCacheDir();
    this._logService.warn(
      `[UpdaterService] Detected orphaned download from previous session, clearing ${pendingDir}`
    );

    try {
      await fs.rm(pendingDir, { recursive: true, force: true });
    } catch (err) {
      this._logService.warn('[UpdaterService] Failed to clear pending cache', err);
    }
  }

  private _bindEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      if (!this._isMultiChannelChecking) {
        this._status$.next(UpdateStatus.CHECKING);
      }
    });

    autoUpdater.on('update-available', (info) => {
      if (!this._isMultiChannelChecking) {
        this._status$.next(UpdateStatus.AVAILABLE);
        this._updateInfo$.next(mapUpdateInfo(info));
      }
    });

    autoUpdater.on('update-not-available', () => {
      if (!this._isMultiChannelChecking) {
        this._status$.next(UpdateStatus.NOT_AVAILABLE);
      }
    });

    autoUpdater.on('download-progress', (progress) => {
      this._status$.next(UpdateStatus.DOWNLOADING);
      this._progress$.next({
        bytesPerSecond: progress.bytesPerSecond,
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this._status$.next(UpdateStatus.DOWNLOADED);
      this._updateInfo$.next(mapUpdateInfo(info));
      void this._removeDownloadLock();
    });

    autoUpdater.on('error', (err) => {
      void this._removeDownloadLock();
      if (!this._isMultiChannelChecking) {
        this._status$.next(UpdateStatus.ERROR);
        this._error$.next({
          message: err.message,
          stack: err.stack,
        });
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (no DI, stateless, unit-testable)
// ---------------------------------------------------------------------------

/**
 * Extract the prerelease channel name from a semver string.
 *
 * Delegates to `semver.prerelease()` so behavior matches electron-updater's
 * own `hasPrereleaseComponents()` check. Returns `null` for stable releases,
 * and the first identifier (e.g. `"beta"`, `"alpha"`) otherwise.
 *
 * Examples:
 *   "0.0.1-beta.0"  -> "beta"
 *   "1.0.0-rc.1"    -> "rc"
 *   "1.0.0"         -> null
 *   "0.0.0"         -> null
 *   "invalid"       -> null
 */
function extractPrereleaseChannel(version: string): string | null {
  const parts = semverPrerelease(version);
  if (!parts || parts.length === 0) {
    return null;
  }
  const head = parts[0];
  return typeof head === 'string' ? head : null;
}

function mapUpdateInfo(info: { version: string; releaseDate: string; releaseNotes?: string | { version: string; note: string | null }[] | null }): IUpdateInfo {
  let releaseNotes: string | null = null;
  if (typeof info.releaseNotes === 'string') {
    releaseNotes = info.releaseNotes;
  } else if (Array.isArray(info.releaseNotes)) {
    releaseNotes = info.releaseNotes.map((n) => `${n.version}: ${n.note ?? ''}`).join('\n');
  }

  return {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes,
  };
}
