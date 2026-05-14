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

import type { IDeviceNameProvider } from '@termlnk/auth';

// Platform-agnostic fallback. AuthCorePlugin binds this by default so the package never
// imports node-only APIs (which would break Metro for React Native). Each app owns its
// own provider in its platform/ layer and registers it via DI override:
//
//   - apps/desktop/main, apps/web/server: hostname()-backed provider (node:os)
//   - apps/mobile: ExpoDeviceNameProvider (expo-device modelName)
//   - Browser SPA: anything navigator-derived (currently no override)
export class DefaultDeviceNameProvider implements IDeviceNameProvider {
  getName(): string {
    return 'Unknown device';
  }
}
