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

export {
  TRPC_HTTP_PATH,
  TRPC_WS_PATH,
  WEB_RENDERER_PLUGIN_CONFIG_KEY,
} from './controllers/config.schema';
export type { IWebRendererConfig, IWebUpdaterConfig } from './controllers/config.schema';
export { WEB_RENDERER_PLUGIN_NAME, WebRendererPlugin } from './plugin';
export { WebRPCClientService } from './services/rpc/web-rpc-client.service';
export { BrowserFileTransferService } from './services/sftp/browser-file-transfer.service';
export { WebUpdaterService } from './services/updater/web-updater.service';
export { NoopWindowManagerService } from './services/window-manager/noop-window-manager.service';
