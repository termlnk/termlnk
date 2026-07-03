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
import type { IContributedTheme, IContributionPoint, IExtensionDescription } from '@termlnk/extension';
import type { IExtensionManagementService } from '@termlnk/rpc-client';
import type { z } from 'zod';
import { createIdentifier, Disposable, ILogService, toDisposable } from '@termlnk/core';
import { contributedThemesSchema } from '@termlnk/extension';
import { IExtensionManagementService as IExtensionManagementServiceId } from '@termlnk/rpc-client';
import { BehaviorSubject } from 'rxjs';

/**
 * Registry that owns the themes contributed by **extensions only**.
 *
 * The settings UI subscribes to `themes$` to keep its theme picker in sync
 * with extension activation state. When an extension deactivates its entries
 * are removed here but **not** from `IThemeService` (the chosen theme is
 * sticky across extension reloads so the user's preference is preserved).
 */
export interface IExtensionThemeRegistry {
  readonly themes$: import('rxjs').Observable<ReadonlyArray<ITheme>>;
  getAllThemes(): ReadonlyArray<ITheme>;
  addTheme(key: string, theme: ITheme): void;
  removeTheme(key: string): void;
}

export const IExtensionThemeRegistry = createIdentifier<IExtensionThemeRegistry>('extension.theme-registry');

export class ExtensionThemeRegistry extends Disposable implements IExtensionThemeRegistry {
  private readonly _byKey = new Map<string, ITheme>();
  private readonly _themes$ = new BehaviorSubject<ReadonlyArray<ITheme>>([]);
  readonly themes$ = this._themes$.asObservable();

  override dispose(): void {
    super.dispose();
    this._byKey.clear();
    this._themes$.complete();
  }

  getAllThemes(): ReadonlyArray<ITheme> {
    return [...this._byKey.values()];
  }

  addTheme(key: string, theme: ITheme): void {
    this._byKey.set(key, theme);
    this._themes$.next(this.getAllThemes());
  }

  removeTheme(key: string): void {
    if (this._byKey.delete(key)) {
      this._themes$.next(this.getAllThemes());
    }
  }
}

/**
 * `themes` contribution point.
 *
 * Loads the Base46-compatible JSON bundle described by each entry from the
 * extension's installed directory via the tRPC extension client, then stores
 * the parsed theme in `IExtensionThemeRegistry`. The registry is the source
 * of truth for the settings UI theme picker.
 */
export class ThemesPoint implements IContributionPoint<IContributedTheme[]> {
  readonly name = 'themes';
  readonly schema: z.ZodType<IContributedTheme[]> = contributedThemesSchema;

  constructor(
    @IExtensionManagementServiceId private readonly _extensionClient: IExtensionManagementService,
    @IExtensionThemeRegistry private readonly _themeRegistry: IExtensionThemeRegistry,
    @ILogService private readonly _logService: ILogService
  ) {}

  apply(description: IExtensionDescription, themes: IContributedTheme[]): ReturnType<IContributionPoint<IContributedTheme[]>['apply']> {
    // Theme loading is async; we track added keys in a plain array so the
    // disposable returned below is synchronous and the caller's rollback is
    // immediate even if a load is still in flight.
    const addedKeys: string[] = [];

    for (const theme of themes) {
      const key = this._key(description.id, theme.id);
      addedKeys.push(key);
      void this._loadTheme(description, theme, key);
    }

    return toDisposable(() => {
      for (const key of addedKeys) {
        this._themeRegistry.removeTheme(key);
      }
    });
  }

  private async _loadTheme(
    description: IExtensionDescription,
    theme: IContributedTheme,
    key: string
  ): Promise<void> {
    try {
      const raw = await this._extensionClient.readExtensionFile(description.id, theme.path);
      const parsed = JSON.parse(raw) as ITheme;
      this._themeRegistry.addTheme(key, {
        ...parsed,
        name: parsed.name ?? theme.id,
        displayName: parsed.displayName ?? theme.label,
      });
      this._logService.debug('[ThemesPoint]', `Registered theme "${theme.id}" from ${description.id}`);
    } catch (err) {
      this._logService.error(
        '[ThemesPoint]',
        `Failed to load theme "${theme.id}" from ${description.id} (${theme.path})`,
        err
      );
    }
  }

  private _key(extensionId: string, themeId: string): string {
    return `${extensionId}::${themeId}`;
  }
}
