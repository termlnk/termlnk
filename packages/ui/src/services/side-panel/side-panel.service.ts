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

import type { IDisposable, Nullable } from '@termlnk/core';
import type { ComponentType } from 'react';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, Inject, toDisposable } from '@termlnk/core';
import { BehaviorSubject, combineLatest, map, of, shareReplay, switchMap } from 'rxjs';
import { ResizableService } from '../resizable/resizable.service';

export interface ISidePanelDescriptor {
  id: string;
  /** Lucide icon name key or a registered component icon key. */
  icon: string;
  /** Locale key for tooltip and header title. */
  titleKey: string;
  component: ComponentType;
  /**
   * Panel-specific buttons shown in the shared tab bar while this panel is
   * active. Panels have no title bar of their own, so anything they used to
   * draw next to their title belongs here.
   */
  actions?: ComponentType;
  order?: number;
  /**
   * Hides the panel from the switcher rail while false. Must carry a current
   * value (BehaviorSubject / startWith) — a stream that only emits later keeps
   * the whole rail waiting.
   */
  available$?: Observable<boolean>;
}

export interface ISidePanelService {
  readonly panels$: Observable<ISidePanelDescriptor[]>;
  readonly activePanelId$: Observable<Nullable<string>>;
  get activePanelId(): Nullable<string>;

  registerPanel(descriptor: ISidePanelDescriptor): IDisposable;
  setActivePanel(id: string | null): void;
  /**
   * The user-facing toggle: reveal the panel in the right sidebar, or collapse
   * the sidebar when that panel is already the visible one.
   */
  togglePanel(id: string): void;
}

export const ISidePanelService = createIdentifier<ISidePanelService>('ui.side-panel-service');

export class SidePanelService extends Disposable implements ISidePanelService {
  private readonly _registry$ = new BehaviorSubject<ISidePanelDescriptor[]>([]);
  private readonly _activePanelId$ = new BehaviorSubject<Nullable<string>>(null);

  readonly activePanelId$: Observable<Nullable<string>> = this._activePanelId$.asObservable();

  /**
   * Panels filtered by `available$` (default true) and sorted by order.
   * Shared: the rail, the body and the availability watcher all subscribe, and
   * each subscription would otherwise re-subscribe every panel's `available$`.
   */
  readonly panels$: Observable<ISidePanelDescriptor[]> = this._registry$.pipe(
    switchMap((all) => {
      if (all.length === 0) {
        return of<ISidePanelDescriptor[]>([]);
      }
      const streams = all.map((d) =>
        (d.available$ ?? of(true)).pipe(map((available) => (available ? d : null)))
      );
      return combineLatest(streams).pipe(
        map((list) =>
          list
            .filter((d): d is ISidePanelDescriptor => d !== null)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        )
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    @Inject(ResizableService) private readonly _resizableService: ResizableService
  ) {
    super();
    // Never leave a stale id active: fall back to the first available panel
    // when the active one disappears. Deliberately does not auto-activate when
    // nothing is active — the user may have collapsed the sidebar on purpose.
    this.disposeWithMe(
      this.panels$.subscribe((panels) => {
        const active = this._activePanelId$.getValue();
        if (active && !panels.some((p) => p.id === active)) {
          this._activePanelId$.next(panels[0]?.id ?? null);
        }
      })
    );
  }

  get activePanelId(): Nullable<string> {
    return this._activePanelId$.getValue();
  }

  registerPanel(descriptor: ISidePanelDescriptor): IDisposable {
    const next = [...this._registry$.getValue().filter((d) => d.id !== descriptor.id), descriptor];
    this._registry$.next(next);
    return toDisposable(() => {
      this._registry$.next(this._registry$.getValue().filter((d) => d.id !== descriptor.id));
      if (this._activePanelId$.getValue() === descriptor.id) {
        this._activePanelId$.next(null);
      }
    });
  }

  setActivePanel(id: string | null): void {
    this._activePanelId$.next(id);
  }

  togglePanel(id: string): void {
    const isOpen = !this._resizableService.isCollapsed('right');
    if (isOpen && this._activePanelId$.getValue() === id) {
      this._resizableService.toggle('right');
      return;
    }

    this.setActivePanel(id);
    if (!isOpen) {
      this._resizableService.toggle('right');
    }
  }

  override dispose(): void {
    super.dispose();
    this._registry$.complete();
    this._activePanelId$.complete();
  }
}
