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

import type { IDisposable } from '@termlnk/core';
import type { ComponentType } from 'react';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, ILogService, toDisposable } from '@termlnk/core';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, of, switchMap } from 'rxjs';

/**
 * Descriptor for a settings panel tab — what to render, where to slot it in
 * the sidebar, and how its visibility behaves at runtime.
 *
 * settings-ui owns the registry, but tab descriptors come from anywhere:
 * settings-ui itself registers its built-in tabs (Appearance, Terminal, ...);
 * business packages (agent-ui, island-ui, auth-ui, ...) register tabs that
 * conceptually belong to them; the desktop shell registers a Platform tab
 * for OS-level switches that don't apply to web deployments.
 */
export interface ISettingsTabDescriptor {
  /**
   * Unique tab id. Built-in tabs use string-valued enum values from
   * SettingsTab; extensions/plugins may use any namespaced string
   * (e.g. `my-extension.advanced`).
   */
  id: string;

  /** i18n key resolved by LocaleService — sidebar label text. */
  labelKey: string;

  /** i18n key for the description shown above the tab body. Optional. */
  descriptionKey?: string;

  /** Sidebar icon — a lucide-react (or compatible) icon component. */
  icon: ComponentType<{ className?: string }>;

  /** Tab body component, mounted when this tab is active. */
  component: ComponentType;

  /**
   * Ascending sort key. Built-in tabs use 10-step increments leaving room
   * for inserts: APPEARANCE=10, PLATFORM=15, INTERFACE=20, TERMINAL=30,
   * COLOR_SCHEME=40, NETWORK=50, MCP=60, AI_PROVIDER=70, CHAT=80, SKILL=90,
   * ISLAND=100, ACCOUNT=110, SHORTCUTS=120, ABOUT=130.
   */
  order: number;

  /**
   * Optional dynamic visibility gate. When omitted, the tab is always shown.
   * Examples: `of(isMacintosh)` for Island; `featureFlag$` for experimental
   * panels; `combineLatest([authBound$, syncEnabled$]).pipe(map(both => ...))`
   * for tabs that depend on multiple capabilities.
   */
  visible$?: Observable<boolean>;
}

export interface ISettingsTabRegistryService {
  /**
   * All currently registered + visible tabs, sorted ascending by `order`.
   * Emits whenever a tab is registered/disposed or any tab's `visible$`
   * changes value. Late subscribers receive the current snapshot.
   */
  readonly tabs$: Observable<ISettingsTabDescriptor[]>;

  /**
   * Register a tab. Returns a Disposable that removes the registration.
   * Duplicate ids are rejected with a log warning and a no-op Disposable —
   * the first registration wins.
   */
  register(descriptor: ISettingsTabDescriptor): IDisposable;
}

export const ISettingsTabRegistryService = createIdentifier<ISettingsTabRegistryService>(
  'settings-ui.settings-tab-registry-service'
);

export class SettingsTabRegistryService extends Disposable implements ISettingsTabRegistryService {
  private readonly _descriptors$ = new BehaviorSubject<ReadonlyMap<string, ISettingsTabDescriptor>>(new Map());

  readonly tabs$: Observable<ISettingsTabDescriptor[]> = this._descriptors$.pipe(
    switchMap((descriptors) => {
      const arr = Array.from(descriptors.values());
      if (arr.length === 0) {
        return of([] as ISettingsTabDescriptor[]);
      }
      const visibles = arr.map((d) => d.visible$ ?? of(true));
      return combineLatest(visibles).pipe(
        map((flags) =>
          arr
            .filter((_, i) => flags[i])
            .sort((a, b) => a.order - b.order)
        )
      );
    }),
    distinctUntilChanged((prev, next) =>
      prev.length === next.length && prev.every((d, i) => d.id === next[i].id)
    )
  );

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._descriptors$.complete();
  }

  register(descriptor: ISettingsTabDescriptor): IDisposable {
    const current = this._descriptors$.getValue();
    if (current.has(descriptor.id)) {
      this._logService.warn(
        `[SettingsTabRegistry] Tab id "${descriptor.id}" already registered — duplicate ignored.`
      );
      return toDisposable(() => { /* no-op for rejected registration */ });
    }

    const next = new Map(current);
    next.set(descriptor.id, descriptor);
    this._descriptors$.next(next);
    return toDisposable(() => {
      const cur = this._descriptors$.getValue();
      // Guard against the descriptor having been replaced/removed already.
      if (cur.get(descriptor.id) === descriptor) {
        const n = new Map(cur);
        n.delete(descriptor.id);
        this._descriptors$.next(n);
      }
    });
  }
}
