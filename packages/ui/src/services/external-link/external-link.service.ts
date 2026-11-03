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

import { createIdentifier } from '@termlnk/core';

/**
 * Opens a URL outside the app window.
 *
 * The desktop shell routes through the preload bridge so the main process can
 * apply its URL policy; a browser shell has to fall back to `window.open`.
 * Components consume this instead of touching `window.nativeShell` directly —
 * the shell-detection lives here once rather than in every caller.
 */
export interface IExternalLinkService {
  /** Returns false when the URL was rejected or no shell could handle it. */
  openExternal(url: string): boolean;
}

export const IExternalLinkService = createIdentifier<IExternalLinkService>('ui.external-link-service');

interface INativeShellBridge {
  openExternal?: (url: string) => void;
}

export class ExternalLinkService implements IExternalLinkService {
  openExternal(url: string): boolean {
    if (!url) {
      return false;
    }

    const nativeShell = (globalThis as { nativeShell?: INativeShellBridge }).nativeShell;
    if (nativeShell?.openExternal) {
      nativeShell.openExternal(url);
      return true;
    }

    // Browser shell: the main-process guard is not in the path, so the window
    // itself decides. `noopener` keeps the opened page off `window.opener`.
    return globalThis.open?.(url, '_blank', 'noopener,noreferrer') != null;
  }
}
