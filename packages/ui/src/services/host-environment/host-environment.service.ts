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
 * IHostEnvironmentService — declares which application shell is running this
 * UI: an Electron desktop window, a browser SPA backed by termlnk-web, or
 * (eventually) a React Native mobile shell.
 *
 * Distinct from IPlatformService, which reports the underlying OS regardless
 * of shell. UI components consult IHostEnvironmentService when a control only
 * makes sense in one shell — system tray, OS auto-launch, native power
 * management — so they can hide it cleanly instead of writing values that
 * nobody is wired up to read.
 *
 * The service is registered with `Quantity.OPTIONAL` semantics by consumers:
 * absent = treat as `electron` (the historical default), which keeps the
 * contract additive. WebRendererPlugin overrides the binding with `web` for
 * the browser SPA; mobile work in Phase 6 will introduce a `mobile` impl.
 */
export type HostEnvironment = 'electron' | 'web' | 'mobile';

export interface IHostEnvironmentService {
  readonly host: HostEnvironment;
}

export const IHostEnvironmentService = createIdentifier<IHostEnvironmentService>('ui.host-environment-service');

export class ElectronHostEnvironmentService implements IHostEnvironmentService {
  readonly host: HostEnvironment = 'electron';
}

export class WebHostEnvironmentService implements IHostEnvironmentService {
  readonly host: HostEnvironment = 'web';
}

export class MobileHostEnvironmentService implements IHostEnvironmentService {
  readonly host: HostEnvironment = 'mobile';
}
