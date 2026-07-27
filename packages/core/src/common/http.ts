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
 * The slice of `fetch` the cloud transports (auth, sync, collab invites) depend on.
 *
 * It lives in core so plugin config schemas can name it: those are contract packages and
 * depend on nothing but core, yet they all need to accept one from the app layer. Handing
 * every transport the same implementation is what makes proxying work — the transports
 * default to `globalThis.fetch`, which ignores the user's configured SOCKS5 / HTTP proxy,
 * and the proxy-aware fetch lives behind `IFetchProvider` in `@termlnk/network`.
 *
 * Narrower than the DOM `fetch` type on purpose: it keeps the transports testable with a
 * plain object literal and avoids binding contract packages to lib.dom / undici typings.
 */
export type CloudFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;
