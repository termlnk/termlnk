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

export { AuthController } from './controllers/auth.controller';
export {
  DEFAULT_MASTER_PASSWORD_ENV,
  DEFAULT_SESSION_IDLE_TIMEOUT_MS,
  TERMLNK_WEB_AUTH_PATH_PREFIX,
  TRPC_HTTP_PATH_PREFIX,
  TRPC_WS_PATH,
  WEB_SERVER_PLUGIN_CONFIG_KEY,
} from './controllers/config.schema';
export type { IWebServerConfig } from './controllers/config.schema';
export { IWebServerRouterProvider, WebServerController } from './controllers/web-server.controller';
export { WEB_SERVER_PLUGIN_NAME, WebServerPlugin } from './plugin';
export type { IAccessVerifier, IMasterKeyStateSnapshot, MasterKeyStatus } from './services/master-key-holder.service';
export { IMasterKeyHolderService, MasterKeyHolderService } from './services/master-key-holder.service';
export { IStaticFileService, StaticFileService } from './services/static-file.service';
export type { IRouteHandler } from './services/static-file.service';
export { IWebServerService, WebServerService } from './services/web-server.service';
export type { IWebServerStateSnapshot, WebServerStatus } from './services/web-server.service';
export type { IWebSession } from './services/web-session.service';
export { IWebSessionService, SESSION_COOKIE_NAME, WebSessionService } from './services/web-session.service';
export { createAuthRouteHandler } from './trpc/auth-routes';
export type { IAuthRouteHandlerDeps } from './trpc/auth-routes';
export { createTRPCStandaloneHandler } from './trpc/http-handler';
export type { ICreateTRPCStandaloneHandlerOptions } from './trpc/http-handler';
export type { AnyRouter } from './trpc/types';
export { createTRPCWSHandler } from './trpc/ws-handler';
export type { ICreateTRPCWSHandlerOptions, ITRPCWSHandlerHandle } from './trpc/ws-handler';
