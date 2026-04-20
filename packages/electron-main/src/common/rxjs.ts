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

import type { Observable } from 'rxjs';

export interface IIteratorResult<T> {
  value: T;
  done: boolean;
}

export function toAsyncIterable<T>(observable: Observable<T>, signal?: AbortSignal): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<T> {
      const values: T[] = [];
      let resolveNext: ((value: IIteratorResult<T>) => void) | null = null;
      let rejectNext: ((err: unknown) => void) | null = null;
      let completed = false;
      let error: unknown = null;

      const subscription = observable.subscribe({
        next(value) {
          if (resolveNext) {
            resolveNext({ value, done: false });
            resolveNext = null;
          } else {
            values.push(value);
          }
        },
        error(err) {
          error = err;
          if (rejectNext) {
            rejectNext(err);
          }
          completed = true;
        },
        complete() {
          completed = true;
          if (resolveNext) {
            resolveNext({ value: undefined as T, done: true });
          }
        },
      });

      signal?.addEventListener('abort', () => {
        subscription.unsubscribe();
        completed = true;
        if (resolveNext) {
          resolveNext({ value: undefined as T, done: true });
        }
      });

      return {
        next(): Promise<IIteratorResult<T>> {
          if (values.length > 0) {
            return Promise.resolve({ value: values.shift()!, done: false });
          }
          if (error) {
            return Promise.reject(error);
          }
          if (completed) {
            return Promise.resolve({ value: undefined as T, done: true });
          }
          return new Promise((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });
        },
        return(): Promise<IIteratorResult<T>> {
          subscription.unsubscribe();
          return Promise.resolve({ value: undefined as T, done: true });
        },
      };
    },
  };
}
