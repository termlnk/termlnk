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

export { ELECTRON_MAIN_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IElectronMainConfig } from './controllers/config.schema';
export { MainController } from './controllers/main.controller';
export { MenuController } from './controllers/menu.controller';
export { createDesktopAppRouter, RPCController } from './controllers/rpc.controller';
export type { DesktopAppRouter } from './controllers/rpc.controller';
export { ELECTRON_MAIN_PLUGIN_NAME, ElectronMainPlugin } from './plugin';
export { FileDialogService } from './services/file-dialog/file-dialog.service';
export { DiskFileService } from './services/file/disk-file.service';
export { FilePermission, FileType } from './services/file/types';
export type { IFileAtomicDeleteOptions, IFileAtomicOptions, IFileAtomicReadOptions, IFileAtomicWriteOptions, IFileDeleteOptions, IFileOpenForReadOptions, IFileOpenForWriteOptions, IFileOpenOptions, IFileOverwriteOptions, IFileUnlockOptions, IFileWriteOptions, IStat } from './services/file/types';
export { IPlatformService, PlatformService } from './services/platform/platform.service';
export { SafeStorageCipher } from './services/secret-cipher/safe-storage.cipher';
export { MockUpdaterService } from './services/updater/mock-updater.service';
export type { MockUpdaterScenario } from './services/updater/mock-updater.service';
export { WindowManagerService } from './services/window-manager/window-manager.service';
export { updaterRouter } from './trpc/routes/updater';
export type { UpdaterRouter } from './trpc/routes/updater';
export { windowRouter } from './trpc/routes/window';
export type { WindowRouter } from './trpc/routes/window';
