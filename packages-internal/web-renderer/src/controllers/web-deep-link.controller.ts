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

import { Disposable, Optional } from '@termlnk/core';
import { IInviteService } from '@termlnk/shared-terminal';

const INVITE_PATH = /\/(?:s|invite)\/[\w-]+/;

/**
 * Browser-shell equivalent of the desktop DeepLinkController for collaboration
 * invites. The desktop hands off `termlnk://invite/...` URLs from the OS; the web
 * shell has none, so the "deep link" is just the SPA's own `window.location`. On
 * mount we read it once and, if it carries an invite (`/s/<id>#…` or
 * `/invite/<id>#…`), feed it to IInviteService so ParticipantJoinDialog can open.
 *
 * The fragment carries `ephPriv`; `ingestInviteUrl` keeps it renderer-side so it
 * never reaches the server. Google OAuth does NOT come through here — the web
 * sign-in launcher drives it via a popup and out-of-band polling.
 */
export class WebDeepLinkController extends Disposable {
  constructor(
    @Optional(IInviteService) private readonly _inviteService?: IInviteService
  ) {
    super();
    this._consumeLocation();
  }

  private _consumeLocation(): void {
    const { pathname, hash, href } = window.location;
    if (!INVITE_PATH.test(pathname) || hash.length <= 1) {
      return;
    }
    this._inviteService?.ingestInviteUrl(href);
    // Reset to the app root so a reload doesn't re-pop the dialog.
    window.history.replaceState(null, '', '/');
  }
}
