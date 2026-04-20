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

import type { Nullable } from '@termlnk/core';
import type { HTTPInterceptorFnFactory } from '../interceptor';
import { retry } from 'rxjs/operators';

const DEFAULT_MAX_RETRY_ATTEMPTS = 3;
const DELAY_INTERVAL = 1000;

export interface IRetryInterceptorFactoryParams {
  maxRetryAttempts?: number;
  delayInterval?: number;
}

export const RetryInterceptorFactory: HTTPInterceptorFnFactory<[Nullable<IRetryInterceptorFactoryParams>?]> = (params?) => {
  const maxRetryAttempts = params?.maxRetryAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS;
  const delayInterval = params?.delayInterval ?? DELAY_INTERVAL;
  return (request, next) => next(request).pipe(retry({ delay: delayInterval, count: maxRetryAttempts }));
};
