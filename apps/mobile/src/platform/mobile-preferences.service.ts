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

import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, Inject } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { IMobileSqliteDatabaseService } from '../storage/mobile-sqlite-database.service';

// Device-local app preferences (never synced). Backed by a single row in the `config`
// table; the AI provider API key lives in expo-secure-store instead (see MobileAiService).
export interface IMobilePreferences {
  readonly terminalFontSize: number;
  readonly autoLockMinutes: number;
  readonly biometricLock: boolean;
  readonly aiBaseUrl: string;
  readonly aiModel: string;
}

export const DEFAULT_PREFERENCES: IMobilePreferences = {
  terminalFontSize: 13,
  autoLockMinutes: 5,
  biometricLock: false,
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o-mini',
};

const PREFS_KEY = 'mobile.prefs';

export interface IMobilePreferencesService {
  readonly prefs$: Observable<IMobilePreferences>;
  ready(): Promise<void>;
  get(): IMobilePreferences;
  update(patch: Partial<IMobilePreferences>): Promise<void>;
}

export const IMobilePreferencesService = createIdentifier<IMobilePreferencesService>('mobile.preferences.service');

interface IConfigRow {
  value_json: string;
}

export class MobilePreferencesService extends Disposable implements IMobilePreferencesService {
  private readonly _prefs$ = new BehaviorSubject<IMobilePreferences>(DEFAULT_PREFERENCES);
  readonly prefs$: Observable<IMobilePreferences> = this._prefs$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  private readonly _sqlite: IMobileSqliteDatabaseService;

  constructor(
    @Inject(IMobileSqliteDatabaseService) sqlite: IMobileSqliteDatabaseService
  ) {
    super();
    this._sqlite = sqlite;
  }

  override dispose(): void {
    super.dispose();
    this._prefs$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._load();
    }
    return this._readyPromise;
  }

  get(): IMobilePreferences {
    return this._prefs$.getValue();
  }

  async update(patch: Partial<IMobilePreferences>): Promise<void> {
    const next = { ...this._prefs$.getValue(), ...patch };
    const db = await this._sqlite.ready();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO config (key, value_json, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [PREFS_KEY, JSON.stringify(next), now, now]
    );
    this._prefs$.next(next);
  }

  private async _load(): Promise<void> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<IConfigRow>('SELECT value_json FROM config WHERE key = ?', [PREFS_KEY]);
    if (!row) {
      return;
    }
    try {
      const parsed = JSON.parse(row.value_json) as Partial<IMobilePreferences>;
      this._prefs$.next({ ...DEFAULT_PREFERENCES, ...parsed });
    } catch {
      // Corrupt prefs row — fall back to defaults already seeded in the subject.
    }
  }
}
