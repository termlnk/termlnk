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

import { DEFAULT_AUTO_LAUNCH_ENABLED, DEFAULT_CLOSE_TO_TRAY, DEFAULT_KEEP_AWAKE_WHILE_AGENT_ACTIVE, DEFAULT_TRAY_ENABLED } from '../../config/config';

export interface IAppSettings {
  trayEnabled: boolean;
  closeToTray: boolean;
  autoLaunchEnabled: boolean;
  keepAwakeWhileAgentActive: boolean;
}

const DEFAULT_APP_SETTINGS: IAppSettings = {
  trayEnabled: DEFAULT_TRAY_ENABLED,
  closeToTray: DEFAULT_CLOSE_TO_TRAY,
  autoLaunchEnabled: DEFAULT_AUTO_LAUNCH_ENABLED,
  keepAwakeWhileAgentActive: DEFAULT_KEEP_AWAKE_WHILE_AGENT_ACTIVE,
};

export function normalizeAppSettings(value: Partial<IAppSettings> | null): IAppSettings {
  if (!value) {
    return { ...DEFAULT_APP_SETTINGS };
  }
  return {
    trayEnabled: typeof value.trayEnabled === 'boolean' ? value.trayEnabled : DEFAULT_TRAY_ENABLED,
    closeToTray: typeof value.closeToTray === 'boolean' ? value.closeToTray : DEFAULT_CLOSE_TO_TRAY,
    autoLaunchEnabled: typeof value.autoLaunchEnabled === 'boolean' ? value.autoLaunchEnabled : DEFAULT_AUTO_LAUNCH_ENABLED,
    keepAwakeWhileAgentActive: typeof value.keepAwakeWhileAgentActive === 'boolean' ? value.keepAwakeWhileAgentActive : DEFAULT_KEEP_AWAKE_WHILE_AGENT_ACTIVE,
  };
}
