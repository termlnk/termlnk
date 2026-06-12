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

import { AgentMobilePlugin } from '@termlnk/agent-mobile';
import { AuthPlugin, IDeviceNameProvider, IIdleProbe, IPasswordHasher } from '@termlnk/auth';
import { AuthCorePlugin } from '@termlnk/auth-core';
import { AuthMobilePlugin, ExpoAppStateIdleProbe, ExpoDeviceNameProvider, LibsodiumPasswordHasher } from '@termlnk/auth-mobile';
import { Core, LocaleType, LogLevel } from '@termlnk/core';
import { DatabaseMobilePlugin } from '@termlnk/database-mobile';
import { PortForwardingMobilePlugin } from '@termlnk/port-forwarding-mobile';
import { SftpMobilePlugin } from '@termlnk/sftp-mobile';
import { SyncMobilePlugin } from '@termlnk/sync-mobile';
import { TerminalMobilePlugin } from '@termlnk/terminal-mobile';
import 'react-native-get-random-values';

const CLOUD_BASE_URL = 'https://cloud.termlnk.com/v1';

export function createMobileCore(): Core {
  const core = new Core({
    logLevel: LogLevel.INFO,
    locale: LocaleType.EN_US,
    locales: { enUS: {} },
  });

  core.registerPlugin(DatabaseMobilePlugin);
  core.registerPlugin(AuthMobilePlugin);
  core.registerPlugin(AuthPlugin, { autoLockIdleMinutes: 5 });
  core.registerPlugin(AuthCorePlugin, {
    cloudBaseUrl: CLOUD_BASE_URL,
    override: [
      [IIdleProbe, { useClass: ExpoAppStateIdleProbe }],
      [IDeviceNameProvider, { useClass: ExpoDeviceNameProvider }],
      [IPasswordHasher, { useClass: LibsodiumPasswordHasher }],
    ],
  });
  core.registerPlugin(SyncMobilePlugin, { cloudBaseUrl: CLOUD_BASE_URL });
  core.registerPlugin(AgentMobilePlugin);
  core.registerPlugin(TerminalMobilePlugin);
  core.registerPlugin(SftpMobilePlugin);
  core.registerPlugin(PortForwardingMobilePlugin);
  core.start();
  return core;
}
