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
 * IFetchProvider — pluggable fetch implementation injected via DI.
 *
 * The default `DefaultFetchProvider` forwards to `globalThis.fetch` — a no-op
 * indirection that keeps `@termlnk/network` browser/Node-isomorphic and free
 * of undici / socks dependencies.
 *
 * Node-only deployments (electron main, web-server) override this binding
 * via `NetworkPlugin`'s `override` config to inject a fetch implementation
 * that routes traffic through SOCKS5 / HTTP proxies (see agent-core's
 * NodeProxyFetchProvider, built on undici + socks). Keeping proxy logic in
 * the caller's package means @termlnk/network never imports node-only
 * modules and stays usable from browser SPA bundles.
 *
 * Implementations must obey the standard `fetch` shape: returning a Response
 * resolved with the HTTP status the upstream server actually returned, and
 * propagating AbortSignal cancellation. Anything more exotic (request
 * tracing, retry logic, etc.) belongs in HTTP interceptors instead.
 */
export interface IFetchProvider {
  fetch: typeof fetch;
}

export const IFetchProvider = createIdentifier<IFetchProvider>('network.fetch-provider');

/**
 * Default implementation — straight passthrough to `globalThis.fetch`.
 * Browsers and Node 18+ both ship a global `fetch`, so this works as the
 * fallback in any environment without imposing a polyfill requirement.
 */
export class DefaultFetchProvider implements IFetchProvider {
  readonly fetch: typeof fetch = (input, init) => globalThis.fetch(input as RequestInfo, init);
}
