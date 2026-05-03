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
import process from 'node:process';
import { Disposable, ILogService } from '@termlnk/core';
import { UpdateStatus } from '@termlnk/electron';
import { app } from 'electron';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * Scenario that drives the mocked update lifecycle. Selected via the
 * `TERMLNK_MOCK_UPDATER` environment variable.
 *
 *  - `normal`         — CHECKING → AVAILABLE → DOWNLOADING → DOWNLOADED
 *  - `check-error`    — CHECKING → ERROR (simulates network failure)
 *  - `download-error` — CHECKING → AVAILABLE → DOWNLOADING → ERROR mid-way
 *  - `no-update`      — CHECKING → NOT_AVAILABLE (button never appears)
 */
export type MockUpdaterScenario = 'normal' | 'check-error' | 'download-error' | 'no-update';

const MOCK_UPDATE_INFO: IUpdateInfo = {
  version: '99.99.99',
  releaseDate: new Date().toISOString(),
  releaseNotes: [
    '## Mock Update (dev-only)',
    '',
    '此版本由 `MockUpdaterService` 在开发模式下模拟生成。',
    '',
    '- 新增：模拟的新功能 A',
    '- 修复：模拟的 bug B',
    '- 优化：模拟的性能提升 C',
  ].join('\n'),
};

const CHECK_DELAY_MS = 1200;
const DOWNLOAD_STEP_INTERVAL_MS = 250;
const DOWNLOAD_STEP_COUNT = 20;
const DOWNLOAD_FAIL_AT_STEP = 5;
const MOCK_TOTAL_BYTES = 120 * 1024 * 1024;
const MOCK_BYTES_PER_SECOND = 3_500_000;

export class MockUpdaterService extends Disposable implements IUpdaterService {
  private readonly _status$ = new BehaviorSubject<UpdateStatus>(UpdateStatus.IDLE);
  readonly status$: Observable<UpdateStatus> = this._status$.asObservable();

  private readonly _updateInfo$ = new BehaviorSubject<IUpdateInfo | null>(null);
  readonly updateInfo$: Observable<IUpdateInfo | null> = this._updateInfo$.asObservable();

  private readonly _progress$ = new Subject<IUpdateProgress>();
  readonly progress$: Observable<IUpdateProgress> = this._progress$.asObservable();

  private readonly _error$ = new Subject<IUpdateError>();
  readonly error$: Observable<IUpdateError> = this._error$.asObservable();

  private readonly _scenario: MockUpdaterScenario;
  private _downloadTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._scenario = this._resolveScenario();
    this._logService.log(`[MockUpdaterService] Activated with scenario: ${this._scenario}`);
  }

  override dispose(): void {
    super.dispose();
    this._clearDownloadTimer();
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
    this._status$.next(UpdateStatus.CHECKING);
    await this._delay(CHECK_DELAY_MS);

    if (this._scenario === 'check-error') {
      this._status$.next(UpdateStatus.ERROR);
      this._error$.next({
        message: 'Mock: failed to check for updates (network unreachable)',
        stack: 'MockUpdaterService.checkForUpdates',
      });
      return null;
    }

    if (this._scenario === 'no-update') {
      this._status$.next(UpdateStatus.NOT_AVAILABLE);
      return null;
    }

    this._status$.next(UpdateStatus.AVAILABLE);
    this._updateInfo$.next(MOCK_UPDATE_INFO);
    return MOCK_UPDATE_INFO;
  }

  async downloadUpdate(): Promise<void> {
    this._clearDownloadTimer();
    this._simulateDownload();
  }

  async quitAndInstall(_isSilent = false, _isForceRunAfter = true): Promise<void> {
    this._logService.log('[MockUpdaterService] quitAndInstall invoked (no-op in dev mock)');
  }

  private _simulateDownload(): void {
    let step = 0;
    this._status$.next(UpdateStatus.DOWNLOADING);

    this._downloadTimer = setInterval(() => {
      step++;

      if (this._scenario === 'download-error' && step === DOWNLOAD_FAIL_AT_STEP) {
        this._clearDownloadTimer();
        this._status$.next(UpdateStatus.ERROR);
        this._error$.next({
          message: 'Mock: download interrupted (checksum mismatch)',
          stack: 'MockUpdaterService.downloadUpdate',
        });
        return;
      }

      const percent = (step / DOWNLOAD_STEP_COUNT) * 100;
      this._progress$.next({
        bytesPerSecond: MOCK_BYTES_PER_SECOND,
        percent,
        transferred: Math.floor((MOCK_TOTAL_BYTES * step) / DOWNLOAD_STEP_COUNT),
        total: MOCK_TOTAL_BYTES,
      });

      if (step >= DOWNLOAD_STEP_COUNT) {
        this._clearDownloadTimer();
        this._status$.next(UpdateStatus.DOWNLOADED);
        this._updateInfo$.next(MOCK_UPDATE_INFO);
      }
    }, DOWNLOAD_STEP_INTERVAL_MS);
  }

  private _clearDownloadTimer(): void {
    if (this._downloadTimer) {
      clearInterval(this._downloadTimer);
      this._downloadTimer = null;
    }
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private _resolveScenario(): MockUpdaterScenario {
    const raw = process.env.TERMLNK_MOCK_UPDATER;
    switch (raw) {
      case 'check-error':
        return 'check-error';
      case 'download-error':
        return 'download-error';
      case 'no-update':
        return 'no-update';
      default:
        return 'normal';
    }
  }
}
