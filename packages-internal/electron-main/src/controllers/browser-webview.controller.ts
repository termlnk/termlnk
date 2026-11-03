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

import type { Event, HandlerDetails, WebContents, WebPreferences } from 'electron';
import { Disposable, ILogService, toDisposable } from '@termlnk/core';
import { BROWSER_PARTITION, isManagedBrowserAttach } from '@termlnk/electron';
import { app, shell } from 'electron';

/**
 * Gates <webview> attachment and installs guest navigation policy.
 *
 * Enabling webviewTag on the main window means any renderer code could attach
 * a guest with arbitrary webPreferences, so every attach is validated and its
 * security flags are overwritten here rather than trusted from the renderer.
 * This is the only gate: WebContentsGuardController exempts every webview from
 * the shell invariant, so a guest that gets past here has no further check.
 */
export class BrowserWebviewController extends Disposable {
  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._init();
  }

  private _init(): void {
    app.on('web-contents-created', this._onWebContentsCreated);
    this.disposeWithMe(toDisposable(() => {
      app.off('web-contents-created', this._onWebContentsCreated);
    }));
  }

  private readonly _onWebContentsCreated = (_event: Event, contents: WebContents): void => {
    // will-attach-webview fires on the *host* webContents before the guest is born.
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      this._onWillAttachWebview(event, webPreferences, params as Record<string, string>);
    });

    // Guests created after attach show up as their own webContents.
    contents.on('did-attach-webview', (_e, guestContents) => {
      this._installGuestPolicy(guestContents);
    });
  };

  private _onWillAttachWebview(
    event: Event,
    webPreferences: WebPreferences,
    params: Record<string, string>
  ): void {
    if (!isManagedBrowserAttach(params)) {
      this._logService.warn('[BrowserWebview] blocked unmanaged webview attach', params);
      event.preventDefault();
      return;
    }

    // Force a locked-down preference set; never trust renderer attributes.
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.nodeIntegrationInWorker = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
    webPreferences.webviewTag = false;
    webPreferences.partition = BROWSER_PARTITION;
    delete (webPreferences as { preload?: string }).preload;
    delete params.preload;
    // Ensure partition survives on the guest.
    params.partition = BROWSER_PARTITION;
  }

  private _installGuestPolicy(contents: WebContents): void {
    contents.setWindowOpenHandler((details: HandlerDetails) => {
      // Popup features / named targets (OAuth) — open in system browser for v1.
      // Future: allow managed popups with opener when needed.
      if (isHttpUrl(details.url)) {
        void shell.openExternal(details.url).catch((err) => {
          this._logService.error('[BrowserWebview] popup open failed', err);
        });
      }
      return { action: 'deny' };
    });

    contents.on('will-navigate', (details) => {
      if (!isHttpUrl(details.url)) {
        details.preventDefault();
        this._logService.warn(`[BrowserWebview] blocked non-http navigate: ${details.url}`);
      }
    });
  }
}

function isHttpUrl(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
