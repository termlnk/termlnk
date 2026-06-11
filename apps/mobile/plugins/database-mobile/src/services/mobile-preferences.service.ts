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
import { eq } from 'drizzle-orm';
import { BehaviorSubject } from 'rxjs';
import { configEntity } from '../entities/config-kv';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';

// Device-local app preferences (never synced). Backed by a single row in the `config`
// table; the AI provider API key lives in expo-secure-store instead (see MobileAiService).
//
// Fields below the core set back Termius-style toggles whose behaviour is not yet
// wired (keyboard/session experiments). They persist so the UI is honest across
// relaunches; `_load` merges over DEFAULT_PREFERENCES so older rows stay valid.
export interface IMobilePreferences {
  readonly terminalFontSize: number;
  readonly terminalFontFamily: string;
  readonly terminalThemeId: string;
  readonly keepAliveSeconds: number;
  readonly backBufferLines: number;
  readonly emulationType: string;
  readonly brightBold: boolean;
  readonly autocomplete: boolean;
  readonly audioHapticFeedback: boolean;
  readonly preventSleeping: boolean;
  readonly pinEnabled: boolean;
  readonly autoLockMinutes: number;
  readonly biometricLock: boolean;
  readonly aiBaseUrl: string;
  readonly aiModel: string;
  // Dismissable "set up this host for AI" card on the host form.
  readonly aiAgentCardDismissed: boolean;
  // Keyboard / session toggles — stored but not yet acted on.
  readonly useOptionAsMeta: boolean;
  readonly cjkInput: boolean;
  readonly detectHostOs: boolean;
  readonly experimentalConnection: boolean;
  readonly postQuantumKex: boolean;
  readonly saveLocationData: boolean;
}

export const DEFAULT_PREFERENCES: IMobilePreferences = {
  terminalFontSize: 13,
  terminalFontFamily: 'Source Code Pro',
  terminalThemeId: 'onedark',
  keepAliveSeconds: 60,
  backBufferLines: 1000,
  emulationType: 'xterm-256color',
  brightBold: true,
  autocomplete: false,
  audioHapticFeedback: true,
  preventSleeping: false,
  pinEnabled: false,
  autoLockMinutes: 5,
  biometricLock: false,
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o-mini',
  aiAgentCardDismissed: false,
  useOptionAsMeta: true,
  cjkInput: false,
  detectHostOs: true,
  experimentalConnection: false,
  postQuantumKex: true,
  saveLocationData: false,
};

const PREFS_KEY = 'mobile.prefs';

export interface IMobilePreferencesService {
  readonly prefs$: Observable<IMobilePreferences>;
  ready(): Promise<void>;
  get(): IMobilePreferences;
  update(patch: Partial<IMobilePreferences>): Promise<void>;
}

export const IMobilePreferencesService = createIdentifier<IMobilePreferencesService>('mobile.preferences.service');

export class MobilePreferencesService extends Disposable implements IMobilePreferencesService {
  private readonly _prefs$ = new BehaviorSubject<IMobilePreferences>(DEFAULT_PREFERENCES);
  readonly prefs$: Observable<IMobilePreferences> = this._prefs$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  private readonly _adaptor: IDatabaseMobileAdaptorService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
    this._adaptor = adaptor;
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
    const db = await this._adaptor.ready();
    db.insert(configEntity)
      .values({ key: PREFS_KEY, valueJson: JSON.stringify(next) })
      .onConflictDoUpdate({
        target: configEntity.key,
        set: { valueJson: JSON.stringify(next), updatedAt: new Date().toISOString() },
      })
      .run();
    this._prefs$.next(next);
  }

  private async _load(): Promise<void> {
    const db = await this._adaptor.ready();
    const row = db.select({ value: configEntity.valueJson })
      .from(configEntity)
      .where(eq(configEntity.key, PREFS_KEY))
      .get();
    if (!row) {
      return;
    }
    try {
      const parsed = JSON.parse(row.value) as Partial<IMobilePreferences>;
      this._prefs$.next({ ...DEFAULT_PREFERENCES, ...parsed });
    } catch {
      // Corrupt prefs row — fall back to defaults already seeded in the subject.
    }
  }
}
