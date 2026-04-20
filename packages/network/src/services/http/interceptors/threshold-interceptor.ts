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
import { removeAt } from '@termlnk/core';
import { Observable } from 'rxjs';

export interface IThresholdInterceptorFactoryParams {
  maxParallel?: number;
}

type HandlerFn = () => void;

export const ThresholdInterceptorFactory: HTTPInterceptorFnFactory<[Nullable<IThresholdInterceptorFactoryParams>?]> = (params?) => {
  /**
   * The local variable to store handles.
   */
  const handlers: HandlerFn[] = [];
  const ongoingHandlers = new Set<HandlerFn>();

  const tick = (): void => {
    while (ongoingHandlers.size < (params?.maxParallel ?? 1) && handlers.length > 0) {
      const handler = handlers.shift()!;
      ongoingHandlers.add(handler);
      handler();
    }
  };

  return (request, next) => {
    return new Observable((observer) => {
      const handler = () => next(request).subscribe({
        next: (event) => observer.next(event),
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });

      const teardown = () => {
        ongoingHandlers.delete(handler);
        removeAt(handlers, handler);
        tick();
      };

      handlers.push(handler);
      tick();

      return teardown;
    });
  };
};
