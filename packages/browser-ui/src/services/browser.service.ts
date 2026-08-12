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

import type { Nullable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { IBrowserUIPluginConfig } from '../controllers/config.schema';
import { createIdentifier, Disposable, IConfigService } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { BROWSER_UI_PLUGIN_CONFIG_KEY, defaultPluginConfig } from '../controllers/config.schema';

export interface IBrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export type BrowserNavigationAction = 'back' | 'forward' | 'reload';

export interface IBrowserNavigationRequest {
  tabId: string;
  action: BrowserNavigationAction;
}

export interface IBrowserService {
  readonly tabs$: Observable<IBrowserTab[]>;
  readonly activeTabId$: Observable<Nullable<string>>;
  /**
   * History commands for a specific tab. Only the <webview> host owns the
   * imperative API, so the toolbar publishes intent here instead of reaching
   * into the DOM.
   */
  readonly navigationRequest$: Observable<IBrowserNavigationRequest>;
  /** One-shot request to focus the address bar (⌘F when the panel is focused). */
  readonly focusAddressRequest$: Observable<void>;
  get tabs(): IBrowserTab[];
  get activeTabId(): Nullable<string>;
  get activeTab(): IBrowserTab | undefined;

  newTab(url?: string): string;
  closeTab(id: string): void;
  setActiveTab(id: string): void;
  navigate(id: string, url: string): void;
  updateTab(id: string, patch: Partial<IBrowserTab>): void;
  requestNavigation(tabId: string, action: BrowserNavigationAction): void;
  requestFocusAddress(): void;
  /** Resolve typed address bar input into an http(s) URL. */
  resolveInput(input: string): string;
}

export const IBrowserService = createIdentifier<IBrowserService>('browser-ui.browser-service');

export class BrowserService extends Disposable implements IBrowserService {
  private readonly _tabs$ = new BehaviorSubject<IBrowserTab[]>([]);
  private readonly _activeTabId$ = new BehaviorSubject<Nullable<string>>(null);
  private readonly _navigationRequest$ = new Subject<IBrowserNavigationRequest>();
  private readonly _focusAddressRequest$ = new Subject<void>();
  private _seq = 0;

  readonly tabs$ = this._tabs$.asObservable();
  readonly activeTabId$ = this._activeTabId$.asObservable();
  readonly navigationRequest$: Observable<IBrowserNavigationRequest> = this._navigationRequest$.asObservable();
  readonly focusAddressRequest$: Observable<void> = this._focusAddressRequest$.asObservable();

  constructor(
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
  }

  get tabs(): IBrowserTab[] {
    return this._tabs$.getValue();
  }

  get activeTabId(): Nullable<string> {
    return this._activeTabId$.getValue();
  }

  get activeTab(): IBrowserTab | undefined {
    const id = this.activeTabId;
    return id ? this.tabs.find((t) => t.id === id) : undefined;
  }

  newTab(url?: string): string {
    const homepage = this._homepage();
    const id = `browser-tab-${++this._seq}`;
    const tab: IBrowserTab = {
      id,
      url: url || homepage,
      title: 'New Tab',
      loading: true,
      canGoBack: false,
      canGoForward: false,
    };
    this._tabs$.next([...this.tabs, tab]);
    this._activeTabId$.next(id);
    return id;
  }

  closeTab(id: string): void {
    const next = this.tabs.filter((t) => t.id !== id);
    this._tabs$.next(next);
    if (this.activeTabId === id) {
      this._activeTabId$.next(next.at(-1)?.id ?? null);
    }
  }

  setActiveTab(id: string): void {
    if (this.tabs.some((t) => t.id === id)) {
      this._activeTabId$.next(id);
    }
  }

  navigate(id: string, url: string): void {
    const resolved = this.resolveInput(url);
    this.updateTab(id, { url: resolved, loading: true, title: resolved });
  }

  updateTab(id: string, patch: Partial<IBrowserTab>): void {
    this._tabs$.next(
      this.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }

  requestNavigation(tabId: string, action: BrowserNavigationAction): void {
    this._navigationRequest$.next({ tabId, action });
  }

  requestFocusAddress(): void {
    this._focusAddressRequest$.next();
  }

  resolveInput(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) {
      return this._homepage();
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    // Looks like a host or path with a dot / localhost → treat as URL.
    if (/^[\w.-]+(\/[\w./?%&=+#-]*)?$/i.test(trimmed) && (trimmed.includes('.') || trimmed.startsWith('localhost'))) {
      return `https://${trimmed}`;
    }
    const engine = this._searchEngine();
    return `${engine}${encodeURIComponent(trimmed)}`;
  }

  override dispose(): void {
    super.dispose();
    this._tabs$.complete();
    this._activeTabId$.complete();
    this._navigationRequest$.complete();
    this._focusAddressRequest$.complete();
  }

  private _homepage(): string {
    const cfg = this._configService.getConfig<IBrowserUIPluginConfig>(BROWSER_UI_PLUGIN_CONFIG_KEY);
    return cfg?.homepage || defaultPluginConfig.homepage || 'https://www.google.com';
  }

  private _searchEngine(): string {
    const cfg = this._configService.getConfig<IBrowserUIPluginConfig>(BROWSER_UI_PLUGIN_CONFIG_KEY);
    return cfg?.searchEngine || defaultPluginConfig.searchEngine || 'https://www.google.com/search?q=';
  }
}
