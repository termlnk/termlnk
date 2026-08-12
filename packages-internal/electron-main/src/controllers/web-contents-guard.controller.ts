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

import type { Event, HandlerDetails, WebContents, WebContentsWillNavigateEventParams, WindowOpenHandlerResponse } from 'electron';
import { Disposable, ILogService, toDisposable } from '@termlnk/core';
import { app, shell } from 'electron';

/**
 * Enforces the shell's navigation invariant: renderer content never leaves
 * the app window.
 *
 * A renderer can escape the shell in two ways — `window.open()` (xterm's
 * default OSC 8 link handler, notification action URLs, ...) and main-frame
 * navigations (anchor clicks, `location` changes). Both would otherwise
 * create or hijack top-level windows the IWindowManagerService never tracks,
 * producing windows with no close control and no lifecycle management.
 * External content belongs to the system browser, so both paths are denied
 * here and safe URLs are handed to the OS instead.
 *
 * Webview guests are exempt: in-app navigation is their entire purpose and
 * BrowserWebviewController installs their policy instead. Attachment is gated
 * there, so any webview reaching this point is already a managed guest.
 */
export class WebContentsGuardController extends Disposable {
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
    // Browser guests navigate by design; their policy lives in
    // BrowserWebviewController, which is also the gate that decides whether a
    // webview may exist at all.
    if (contents.getType() === 'webview') {
      return;
    }

    contents.setWindowOpenHandler((details) => this._denyWindowOpen(details));
    contents.on('will-navigate', (details) => this._onWillNavigate(details));
  };

  private _denyWindowOpen(details: HandlerDetails): WindowOpenHandlerResponse {
    this._openExternal(details.url);
    return { action: 'deny' };
  }

  private _onWillNavigate(details: Event<WebContentsWillNavigateEventParams>): void {
    details.preventDefault();
    this._openExternal(details.url);
  }

  /**
   * Only http(s) URLs may leave the shell. PTY output and notification
   * payloads are untrusted and can carry `javascript:` / `file:` targets.
   */
  private _openExternal(url: string): void {
    if (!isSafeExternalUrl(url)) {
      this._logService.warn(`[WebContentsGuardController] blocked unsafe URL: ${url}`);
      return;
    }
    void shell.openExternal(url).catch((err) => {
      this._logService.error(`[WebContentsGuardController] failed to open URL: ${url}`, err);
    });
  }
}

function isSafeExternalUrl(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
