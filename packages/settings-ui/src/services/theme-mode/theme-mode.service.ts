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

import type { ITheme } from '@termlnk/core';
import type { IThemeModeService, OSColorScheme, ThemeMode } from '@termlnk/ui';
import type { Observable } from 'rxjs';
import { Disposable, ILogService, INotificationService, IThemeService, toDisposable } from '@termlnk/core';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { DEFAULT_DARK_THEME_NAME, DEFAULT_LIGHT_THEME_NAME, IColorSchemeService, IThemeRegistryService, resolveEffectiveThemeName, UI_PLUGIN_CONFIG_KEY } from '@termlnk/ui';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map } from 'rxjs';

const LEGACY_LOCAL_STORAGE_KEY = 'ui-theme';
const CONFIG_FIELD_MODE = 'themeMode';
const CONFIG_FIELD_DARK = 'darkThemeName';
const CONFIG_FIELD_LIGHT = 'lightThemeName';
const CONFIG_FIELD_LEGACY_THEME = 'theme';

interface IQueuedSetter {
  readonly kind: 'mode' | 'dark' | 'light';
  readonly value: string;
  readonly resolve: () => void;
  readonly reject: (err: Error) => void;
}

/**
 * Owns theme mode + dual-slot preferences, resolves the effective theme from
 * (mode, OS scheme, dark slot, light slot), and pushes it through
 * IThemeService. Persistence goes through IConfigManagerService with explicit
 * failure surfacing (INotificationService) — no silent catch.
 */
export class ThemeModeService extends Disposable implements IThemeModeService {
  private readonly _mode$ = new BehaviorSubject<ThemeMode>('auto');
  readonly mode$: Observable<ThemeMode> = this._mode$.asObservable();
  get mode(): ThemeMode { return this._mode$.getValue(); }

  private readonly _darkThemeName$ = new BehaviorSubject<string>(DEFAULT_DARK_THEME_NAME);
  readonly darkThemeName$: Observable<string> = this._darkThemeName$.asObservable();
  get darkThemeName(): string { return this._darkThemeName$.getValue(); }

  private readonly _lightThemeName$ = new BehaviorSubject<string>(DEFAULT_LIGHT_THEME_NAME);
  readonly lightThemeName$: Observable<string> = this._lightThemeName$.asObservable();
  get lightThemeName(): string { return this._lightThemeName$.getValue(); }

  readonly effectiveTheme$: Observable<ITheme | null>;

  private _initialized = false;
  private readonly _initPromise: Promise<void>;
  private _initResolve!: () => void;
  private readonly _pendingSetters: IQueuedSetter[] = [];

  constructor(
    @IThemeService private readonly _themeService: IThemeService,
    @IColorSchemeService private readonly _colorSchemeService: IColorSchemeService,
    @IThemeRegistryService private readonly _themeRegistry: IThemeRegistryService,
    @IConfigManagerService private readonly _configManager: IConfigManagerService,
    @ILogService private readonly _logService: ILogService,
    @INotificationService private readonly _notificationService: INotificationService
  ) {
    super();

    this._initPromise = new Promise<void>((resolve) => {
      this._initResolve = resolve;
    });

    this.effectiveTheme$ = combineLatest([
      this._mode$,
      this._colorSchemeService.scheme$,
      this._darkThemeName$,
      this._lightThemeName$,
    ]).pipe(
      map(([mode, scheme, darkName, lightName]) => {
        const themeName = resolveEffectiveThemeName(mode, scheme, darkName, lightName);
        return this._resolveWithFallback(themeName, scheme);
      }),
      distinctUntilChanged((prev, next) => prev?.name === next?.name)
    );

    void this._initFromConfig();

    this.disposeWithMe(toDisposable(() => {
      this._mode$.complete();
      this._darkThemeName$.complete();
      this._lightThemeName$.complete();
      for (const pending of this._pendingSetters) {
        pending.reject(new Error('ThemeModeService disposed before init'));
      }
      this._pendingSetters.length = 0;
    }));
  }

  async setMode(mode: ThemeMode): Promise<void> {
    if (!this._initialized) {
      return this._enqueue('mode', mode);
    }
    if (this._mode$.getValue() === mode) {
      return;
    }
    this._mode$.next(mode);
    await this._persistField(CONFIG_FIELD_MODE, mode);
  }

  async setDarkTheme(themeName: string): Promise<void> {
    if (!this._initialized) {
      return this._enqueue('dark', themeName);
    }
    this._assertSlotType(themeName, 'dark');
    if (this._darkThemeName$.getValue() === themeName) {
      return;
    }
    this._darkThemeName$.next(themeName);
    await this._persistField(CONFIG_FIELD_DARK, themeName);
  }

  async setLightTheme(themeName: string): Promise<void> {
    if (!this._initialized) {
      return this._enqueue('light', themeName);
    }
    this._assertSlotType(themeName, 'light');
    if (this._lightThemeName$.getValue() === themeName) {
      return;
    }
    this._lightThemeName$.next(themeName);
    await this._persistField(CONFIG_FIELD_LIGHT, themeName);
  }

  private _assertSlotType(themeName: string, expected: 'dark' | 'light'): void {
    const theme = this._themeRegistry.resolveTheme(themeName);
    if (!theme) {
      throw new Error(`Unknown theme "${themeName}"`);
    }
    if (theme.type !== expected) {
      throw new Error(`Theme "${themeName}" has type "${theme.type}" but slot expects "${expected}"`);
    }
  }

  private _enqueue(kind: IQueuedSetter['kind'], value: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._pendingSetters.push({ kind, value, resolve, reject });
    });
  }

  private async _flushPending(): Promise<void> {
    const pending = this._pendingSetters.splice(0);
    for (const setter of pending) {
      try {
        if (setter.kind === 'mode') {
          await this.setMode(setter.value as ThemeMode);
        } else if (setter.kind === 'dark') {
          await this.setDarkTheme(setter.value);
        } else {
          await this.setLightTheme(setter.value);
        }
        setter.resolve();
      } catch (err) {
        setter.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private async _persistField(field: string, value: string): Promise<void> {
    try {
      await this._configManager.setField(UI_PLUGIN_CONFIG_KEY, field, value);
    } catch (err) {
      this._logService.error('[ThemeModeService]', `Failed to persist ${field}=${value}`, err);
      this._notificationService.notify({
        title: 'Theme setting not saved',
        body: `Could not persist "${field}". The change is applied in this session but may revert after restart.`,
        type: 'warning',
        source: 'application',
        transient: false,
      });
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  /**
   * Read persisted preferences, merge with legacy fields, seed subjects, then
   * wire the effective-theme subscription. Order matters:
   *   1) update BehaviorSubjects synchronously with resolved values
   *   2) skip setTheme if the current IThemeService.currentTheme is already
   *      the resolved theme (boot config already seeded Core with it)
   *   3) subscribe effectiveTheme$ -> IThemeService.setTheme
   *   4) flip _initialized and flush queued setters
   */
  private async _initFromConfig(): Promise<void> {
    try {
      const stored = await this._readStoredPreferences();
      const migrated = this._migrateAndFill(stored);

      this._mode$.next(migrated.mode);
      this._darkThemeName$.next(migrated.darkThemeName);
      this._lightThemeName$.next(migrated.lightThemeName);

      const currentSchemeAtInit = this._colorSchemeService.scheme;
      const effectiveName = resolveEffectiveThemeName(
        migrated.mode,
        currentSchemeAtInit,
        migrated.darkThemeName,
        migrated.lightThemeName
      );
      const effectiveTheme = this._resolveWithFallback(effectiveName, currentSchemeAtInit);

      const alreadyApplied = this._themeService.currentTheme?.name === effectiveTheme?.name;
      if (!alreadyApplied && effectiveTheme) {
        this._themeService.setTheme(effectiveTheme);
      }

      this.disposeWithMe(
        this.effectiveTheme$.subscribe((theme) => {
          if (this._themeService.currentTheme?.name === theme?.name) {
            return;
          }
          this._themeService.setTheme(theme);
        })
      );

      await this._writeMigratedFieldsIfNeeded(stored, migrated);

      this._initialized = true;
      this._initResolve();
      await this._flushPending();
    } catch (err) {
      this._logService.error('[ThemeModeService]', 'initFromConfig failed', err);
      // Even on failure, unblock queued setters with an error so callers see it.
      this._initialized = true;
      this._initResolve();
      for (const pending of this._pendingSetters.splice(0)) {
        pending.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private async _readStoredPreferences(): Promise<IStoredPreferences> {
    const [modeRaw, darkNameRaw, lightNameRaw, legacyTheme] = await Promise.all([
      this._configManager.getField<ThemeMode | null>(UI_PLUGIN_CONFIG_KEY, CONFIG_FIELD_MODE),
      this._configManager.getField<string | null>(UI_PLUGIN_CONFIG_KEY, CONFIG_FIELD_DARK),
      this._configManager.getField<string | null>(UI_PLUGIN_CONFIG_KEY, CONFIG_FIELD_LIGHT),
      this._configManager.getField<string | null>(UI_PLUGIN_CONFIG_KEY, CONFIG_FIELD_LEGACY_THEME),
    ]);
    return {
      mode: modeRaw ?? null,
      darkThemeName: darkNameRaw ?? null,
      lightThemeName: lightNameRaw ?? null,
      legacyTheme: legacyTheme ?? null,
    };
  }

  private _migrateAndFill(stored: IStoredPreferences): IResolvedPreferences {
    // Priority (per plan): new fields > ui.config.theme (legacy) > localStorage['ui-theme'].
    // Idempotency: any new field present => already migrated; do NOT let legacy overwrite.

    const hasAnyNewField = stored.mode !== null || stored.darkThemeName !== null || stored.lightThemeName !== null;

    let mode: ThemeMode = stored.mode ?? 'auto';
    let darkName = stored.darkThemeName ?? DEFAULT_DARK_THEME_NAME;
    let lightName = stored.lightThemeName ?? DEFAULT_LIGHT_THEME_NAME;

    if (hasAnyNewField) {
      // Validate stored values; fall back with a warn (once per boot) if the
      // stored theme is missing OR wrong type for its slot.
      if (stored.darkThemeName !== null) {
        darkName = this._validateSlot(stored.darkThemeName, 'dark', DEFAULT_DARK_THEME_NAME);
      }
      if (stored.lightThemeName !== null) {
        lightName = this._validateSlot(stored.lightThemeName, 'light', DEFAULT_LIGHT_THEME_NAME);
      }
      if (stored.mode !== null && !this._isValidMode(stored.mode)) {
        this._logService.warn('[ThemeModeService]', `Ignoring invalid themeMode "${String(stored.mode)}"; using 'auto'`);
        mode = 'auto';
      }
      return { mode, darkThemeName: darkName, lightThemeName: lightName };
    }

    // No new fields — attempt legacy migration.
    if (stored.legacyTheme) {
      const legacy = this._themeRegistry.resolveTheme(stored.legacyTheme);
      if (legacy) {
        if (legacy.type === 'dark') {
          darkName = legacy.name;
          mode = 'dark';
        } else {
          lightName = legacy.name;
          mode = 'light';
        }
        return { mode, darkThemeName: darkName, lightThemeName: lightName };
      }
      this._logService.warn('[ThemeModeService]', `Legacy ui.config.theme="${stored.legacyTheme}" unresolved; ignoring`);
    }

    const legacyHint = readLegacyLocalStorageHint();
    if (legacyHint === 'dark' || legacyHint === 'light') {
      mode = legacyHint;
    } else {
      mode = 'auto';
    }
    return { mode, darkThemeName: darkName, lightThemeName: lightName };
  }

  private _validateSlot(themeName: string, expected: 'dark' | 'light', fallback: string): string {
    const theme = this._themeRegistry.resolveTheme(themeName);
    if (!theme) {
      this._logService.warn('[ThemeModeService]', `Stored ${expected} theme "${themeName}" unavailable; will fall back at resolve time`);
      // Keep the stored name in memory (sticky preference); resolver falls back if still missing at render.
      return themeName;
    }
    if (theme.type !== expected) {
      this._logService.warn('[ThemeModeService]', `Stored ${expected} theme "${themeName}" is type "${theme.type}"; using ${fallback}`);
      return fallback;
    }
    return themeName;
  }

  private _isValidMode(v: unknown): v is ThemeMode {
    return v === 'auto' || v === 'dark' || v === 'light';
  }

  private _resolveWithFallback(themeName: string, scheme: OSColorScheme): ITheme | null {
    const theme = this._themeRegistry.resolveTheme(themeName);
    if (theme) {
      return theme;
    }
    // Stored slot unavailable (e.g. extension theme disabled). Fall back
    // WITHOUT overwriting the stored slot — extension re-activation will
    // pick up the sticky preference.
    const fallbackName = scheme === 'dark' ? DEFAULT_DARK_THEME_NAME : DEFAULT_LIGHT_THEME_NAME;
    return this._themeRegistry.resolveTheme(fallbackName);
  }

  /**
   * Write back only the fields that were missing at read time. Never overwrites
   * existing user preferences. Best-effort — failures are logged but not
   * surfaced to the user (migration is silent unless explicit).
   */
  private async _writeMigratedFieldsIfNeeded(
    stored: IStoredPreferences,
    resolved: IResolvedPreferences
  ): Promise<void> {
    const writes: Array<Promise<unknown>> = [];
    if (stored.mode === null) {
      writes.push(this._configManager.setField(UI_PLUGIN_CONFIG_KEY, CONFIG_FIELD_MODE, resolved.mode));
    }
    if (stored.darkThemeName === null) {
      writes.push(this._configManager.setField(UI_PLUGIN_CONFIG_KEY, CONFIG_FIELD_DARK, resolved.darkThemeName));
    }
    if (stored.lightThemeName === null) {
      writes.push(this._configManager.setField(UI_PLUGIN_CONFIG_KEY, CONFIG_FIELD_LIGHT, resolved.lightThemeName));
    }
    if (writes.length === 0) {
      return;
    }
    try {
      await Promise.all(writes);
    } catch (err) {
      this._logService.warn('[ThemeModeService]', 'Migration write-back failed (will retry next boot)', err);
    }
  }
}

interface IStoredPreferences {
  readonly mode: ThemeMode | null;
  readonly darkThemeName: string | null;
  readonly lightThemeName: string | null;
  readonly legacyTheme: string | null;
}

interface IResolvedPreferences {
  readonly mode: ThemeMode;
  readonly darkThemeName: string;
  readonly lightThemeName: string;
}

function readLegacyLocalStorageHint(): 'dark' | 'light' | 'system' | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (raw === 'dark' || raw === 'light' || raw === 'system') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}
