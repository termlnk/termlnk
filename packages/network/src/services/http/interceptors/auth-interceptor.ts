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

import type { HTTPInterceptorFn, HTTPInterceptorFnFactory } from '../interceptor';
import { catchError, throwError } from 'rxjs';
import { HTTPResponseError } from '../response';

export interface IAuthInterceptorParams {
  errorStatusCodes: number[];
  onAuthError: () => void;
}

export const AuthInterceptorFactory: HTTPInterceptorFnFactory<[IAuthInterceptorParams]> = (params) => {
  const { errorStatusCodes, onAuthError } = params;

  const authInterceptor: HTTPInterceptorFn = (request, next) => {
    return next(request).pipe(
      catchError((error) => {
        if ((error instanceof HTTPResponseError) && errorStatusCodes.some((c) => c === error.status)) {
          onAuthError();
        }

        return throwError(() => error);
      })
    );
  };

  return authInterceptor;
};
