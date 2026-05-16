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

export type { INetworkConfig } from './controllers/config.schema';
export { NetworkPlugin } from './plugin';
export { DefaultFetchProvider, IFetchProvider } from './services/http/fetch-provider/fetch-provider.service';
export { HTTPHeaders } from './services/http/headers';
export { type HTTPResponseType, HTTPStatusCode } from './services/http/http';
export { HTTPService } from './services/http/http.service';
export type { IPostRequestParams, IRequestParams } from './services/http/http.service';
export { FetchHTTPImplementation } from './services/http/implementations/fetch';
export { IHTTPImplementation } from './services/http/implementations/implementation';
export { XHRHTTPImplementation } from './services/http/implementations/xhr';
export type { HTTPHandlerFn, HTTPInterceptorFn, HTTPInterceptorFnFactory } from './services/http/interceptor';
export { AuthInterceptorFactory, type IAuthInterceptorParams } from './services/http/interceptors/auth-interceptor';
export { MergeInterceptorFactory } from './services/http/interceptors/merge-interceptor';
export { type IRetryInterceptorFactoryParams, RetryInterceptorFactory } from './services/http/interceptors/retry-interceptor';
export { ThresholdInterceptorFactory } from './services/http/interceptors/threshold-interceptor';
export { HTTPRequest, type HTTPRequestMethod } from './services/http/request';
export { type HTTPEvent, HTTPEventType, HTTPProgress, HTTPResponse, type HTTPResponseBody, HTTPResponseError, ResponseHeader } from './services/http/response';
export { type ISocket, ISocketService, type SocketBodyType, WebSocketService } from './services/web-socket/web-socket.service';
