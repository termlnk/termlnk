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

export { WindowCloseCommand } from './commands/window-close.command';
export { DEFAULT_AUTO_LAUNCH_ENABLED, DEFAULT_CLOSE_TO_TRAY, DEFAULT_KEEP_AWAKE_WHILE_AGENT_ACTIVE, DEFAULT_TRAY_ENABLED } from './config/config';
export { ELECTRON_PLUGIN_CONFIG_KEY } from './controller/config.schema';
export type { IElectronConfig } from './controller/config.schema';
export { ElectronController } from './controller/electron.controller';
export { ELECTRON_PLUGIN_NAME, ElectronPlugin } from './plugin';
export type { IAppSettings } from './services/app-settings/type';
export { normalizeAppSettings } from './services/app-settings/type';
export { IKeepAwakeService } from './services/keep-awake/keep-awake.service';
export { CORE_RPC_CHANNEL } from './services/rpc/rpc';
export type { IUpdateError, IUpdateInfo, IUpdateProgress } from './services/updater/type';
export { UpdateStatus } from './services/updater/type';
export { IUpdaterService } from './services/updater/updater.service';
export type { ICreateWindowOptions, IWindowState } from './services/window-manager/type';
export { WindowEvent } from './services/window-manager/type';
export { IWindowManagerService, WindowManagerServiceName } from './services/window-manager/window-manager.service';
