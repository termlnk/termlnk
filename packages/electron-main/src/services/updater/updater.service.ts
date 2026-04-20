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

import type { IUpdateError, IUpdateInfo, IUpdateProgress, IUpdaterService } from '@termlnk/electron';
import type { Observable } from 'rxjs';
import { Disposable, ILogService } from '@termlnk/core';
import { UpdateStatus } from '@termlnk/electron';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { BehaviorSubject, interval, Subject, switchMap } from 'rxjs';

/** Internal candidate returned by a single-channel check */
interface IUpdateCandidate {
  info: IUpdateInfo;
  version: string;
  channel: string;
}

export class UpdaterService extends Disposable implements IUpdaterService {
  /** Auto-check interval: 15 minutes */
  private static readonly _AUTO_CHECK_INTERVAL_MS = 15 * 60 * 1000;

  private readonly _status$ = new BehaviorSubject<UpdateStatus>(UpdateStatus.IDLE);
  readonly status$: Observable<UpdateStatus> = this._status$.asObservable();

  private readonly _updateInfo$ = new Subject<IUpdateInfo>();
  readonly updateInfo$: Observable<IUpdateInfo> = this._updateInfo$.asObservable();

  private readonly _progress$ = new Subject<IUpdateProgress>();
  readonly progress$: Observable<IUpdateProgress> = this._progress$.asObservable();

  private readonly _error$ = new Subject<IUpdateError>();
  readonly error$: Observable<IUpdateError> = this._error$.asObservable();

  /** Prerelease channel extracted from the current version (e.g. "beta"), or null for stable */
  private readonly _prereleaseChannel: string | null;

  /** Suppresses event handlers during multi-channel check to avoid intermediate status flicker */
  private _isMultiChannelChecking = false;

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Detect prerelease channel from current version (e.g. "beta" from "0.0.1-beta.0")
    // so GenericProvider fetches beta-mac.yml instead of latest-mac.yml
    this._prereleaseChannel = this._extractPrereleaseChannel(app.getVersion());
    if (this._prereleaseChannel) {
      this._switchChannel(this._prereleaseChannel);
    }

    this._bindEvents();
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

    this._status$.next(UpdateStatus.CHECKING);

    try {
      if (!this._prereleaseChannel) {
        // Stable version: single channel check
        const result = await autoUpdater.checkForUpdates();
        if (!result) {
          return null;
        }
        return this._mapUpdateInfo(result.updateInfo);
      }

      // Prerelease version: check both prerelease and stable channels,
      // so beta users can also discover stable releases
      return await this._checkDualChannels();
    } catch (err) {
      this._logService.warn('[UpdaterService] Update check failed', err);
      return null;
    }
  }

  async downloadUpdate(): Promise<void> {
    if (!app.isPackaged) {
      this._logService.warn('[UpdaterService] Skipping download in development mode');
      return;
    }

    await autoUpdater.downloadUpdate();
  }

  quitAndInstall(isSilent = false, isForceRunAfter = true): void {
    autoUpdater.quitAndInstall(isSilent, isForceRunAfter);
  }

  // ---------------------------------------------------------------------------
  // Dual-channel update logic
  // ---------------------------------------------------------------------------

  /**
   * Check both prerelease and stable channels, pick the newer available version.
   * This ensures beta users can upgrade to stable releases when they come out.
   */
  private async _checkDualChannels(): Promise<IUpdateInfo | null> {
    this._isMultiChannelChecking = true;
    const currentVersion = app.getVersion();

    try {
      const prerelease = await this._checkChannel(this._prereleaseChannel!, currentVersion);
      const stable = await this._checkChannel('latest', currentVersion);
      const best = this._pickBestCandidate(prerelease, stable);

      if (!best) {
        this._status$.next(UpdateStatus.NOT_AVAILABLE);
        return null;
      }

      // Set channel to the winner so subsequent downloadUpdate() uses the correct file
      this._switchChannel(best.channel);
      this._status$.next(UpdateStatus.AVAILABLE);
      this._updateInfo$.next(best.info);

      return best.info;
    } finally {
      this._isMultiChannelChecking = false;
    }
  }

  /** Check a single channel and return a candidate if a newer version is found */
  private async _checkChannel(channel: string, currentVersion: string): Promise<IUpdateCandidate | null> {
    this._switchChannel(channel);
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result && this._compareVersions(result.updateInfo.version, currentVersion) > 0) {
        return {
          info: this._mapUpdateInfo(result.updateInfo),
          version: result.updateInfo.version,
          channel,
        };
      }
      return null;
    } catch (err) {
      this._logService.warn(`[UpdaterService] Channel "${channel}" check failed`, err);
      return null;
    }
  }

  /** Return whichever candidate has the higher version, or null if both are null */
  private _pickBestCandidate(a: IUpdateCandidate | null, b: IUpdateCandidate | null): IUpdateCandidate | null {
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    return this._compareVersions(a.version, b.version) >= 0 ? a : b;
  }

  /**
   * Switch autoUpdater to a different channel.
   * The channel setter internally forces `allowDowngrade = true`, so we always reset it.
   */
  private _switchChannel(channel: string): void {
    autoUpdater.channel = channel;
    autoUpdater.allowDowngrade = false;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  private _startAutoCheck(): void {
    if (!app.isPackaged) return;

    this.disposeWithMe(
      interval(UpdaterService._AUTO_CHECK_INTERVAL_MS).pipe(
        switchMap(() => this.checkForUpdates().catch(() => null))
      ).subscribe()
    );
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
        this._updateInfo$.next(this._mapUpdateInfo(info));
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
      this._updateInfo$.next(this._mapUpdateInfo(info));
    });

    autoUpdater.on('error', (err) => {
      if (!this._isMultiChannelChecking) {
        this._status$.next(UpdateStatus.ERROR);
        this._error$.next({
          message: err.message,
          stack: err.stack,
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _mapUpdateInfo(info: { version: string; releaseDate: string; releaseNotes?: string | { version: string; note: string | null }[] | null }): IUpdateInfo {
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

  /**
   * Extract the prerelease channel name from a semver string.
   * e.g. "0.0.1-beta.0" -> "beta", "1.0.0-alpha.3" -> "alpha", "1.0.0" -> null
   */
  private _extractPrereleaseChannel(version: string): string | null {
    const hyphenIndex = version.indexOf('-');
    if (hyphenIndex === -1) {
      return null;
    }
    const prerelease = version.slice(hyphenIndex + 1);
    const dotIndex = prerelease.indexOf('.');
    const channel = dotIndex === -1 ? prerelease : prerelease.slice(0, dotIndex);
    return channel || null;
  }

  /**
   * Compare two semver version strings.
   * Returns positive if a > b, negative if a < b, zero if equal.
   *
   * Handles prerelease ordering per semver spec:
   * - A release version has higher precedence than its prerelease (1.0.0 > 1.0.0-beta.1)
   * - Prerelease identifiers are compared left-to-right: numeric < numeric, string < string
   */
  private _compareVersions(a: string, b: string): number {
    const parse = (v: string) => {
      const hyphenIndex = v.indexOf('-');
      const main = hyphenIndex === -1 ? v : v.slice(0, hyphenIndex);
      const pre = hyphenIndex === -1 ? null : v.slice(hyphenIndex + 1);
      return { parts: main.split('.').map(Number), pre };
    };

    const va = parse(a);
    const vb = parse(b);

    // Compare major.minor.patch
    for (let i = 0; i < 3; i++) {
      const diff = (va.parts[i] || 0) - (vb.parts[i] || 0);
      if (diff !== 0) {
        return diff;
      }
    }

    // Same main version: release > prerelease
    if (!va.pre && vb.pre) {
      return 1;
    }
    if (va.pre && !vb.pre) {
      return -1;
    }
    if (!va.pre && !vb.pre) {
      return 0;
    }

    // Both have prerelease: compare identifiers left-to-right
    const aParts = va.pre!.split('.');
    const bParts = vb.pre!.split('.');
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
      if (i >= aParts.length) {
        return -1;
      }
      if (i >= bParts.length) {
        return 1;
      }
      const aNum = Number(aParts[i]);
      const bNum = Number(bParts[i]);
      const aIsNum = !Number.isNaN(aNum);
      const bIsNum = !Number.isNaN(bNum);
      if (aIsNum && bIsNum) {
        if (aNum !== bNum) {
          return aNum - bNum;
        }
      } else if (aIsNum !== bIsNum) {
        // Numeric identifiers have lower precedence than string identifiers
        return aIsNum ? -1 : 1;
      } else {
        // Both strings: lexicographic compare
        if (aParts[i] < bParts[i]) {
          return -1;
        }
        if (aParts[i] > bParts[i]) {
          return 1;
        }
      }
    }

    return 0;
  }
}
