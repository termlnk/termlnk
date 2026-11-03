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

/**
 * Contract shared by the renderer that mounts a <webview> and the main-process
 * gate that validates the attach. Both sides must agree, so it lives here
 * rather than being duplicated per process.
 */

/** Shared partition so login state survives tab switches and app restarts. */
export const BROWSER_PARTITION = 'persist:termlnk-browser';

/** Attribute the main process requires to whitelist a managed guest. */
export const BROWSER_GUEST_ATTR = 'data-termlnk-browser';

/**
 * Validate `will-attach-webview` params. Anything not carrying both the managed
 * partition and the marker attribute is rejected before the guest is created.
 */
export function isManagedBrowserAttach(params: Record<string, string>): boolean {
  return params.partition === BROWSER_PARTITION && params[BROWSER_GUEST_ATTR] === '1';
}
