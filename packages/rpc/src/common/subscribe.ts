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

import { Observable } from 'rxjs';

// Adapt an RxJS Observable to an AsyncGenerator so it can be returned from a tRPC
// subscription resolver.
export async function* observableToAsyncGenerator<T>(observable: Observable<T>): AsyncGenerator<T> {
  const buffer: T[] = [];
  let resolve: (() => void) | null = null;
  let completed = false;
  let error: Error | null = null;

  const notify = () => {
    if (resolve) {
      resolve();
      resolve = null;
    }
  };

  const subscription = observable.subscribe({
    next: (value) => {
      buffer.push(value);
      notify();
    },
    error: (err) => {
      error = err;
      completed = true;
      notify();
    },
    complete: () => {
      completed = true;
      notify();
    },
  });

  try {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!completed || buffer.length > 0) {
      if (buffer.length === 0) {
        await new Promise<void>((r) => {
          resolve = r;
        });
      }

      while (buffer.length > 0) {
        const value = buffer.shift()!;
        yield value;
      }

      if (error) {
        throw error;
      }
    }
  } finally {
    subscription.unsubscribe();
  }
}

// Minimal tRPC subscription shape: anything exposing a `subscribe` method that takes
// onData / onError / onComplete callbacks.
interface TRPCSubscriptionLike<TData> {
  subscribe: (opts: {
    onData: (data: TData) => void;
    onError: (err: Error) => void;
    onComplete: () => void;
  }) => { unsubscribe: () => void };
}

// Adapt a tRPC subscription (either the object or a function returning the subscribe
// handle) to an RxJS Observable. Pass a function form when the subscription needs input
// arguments — e.g. `(opts) => client.window.getWindowState$.subscribe({ input: id }, opts)`.
export function trpcSubscriptionToObservable<TData>(
  subscription: TRPCSubscriptionLike<TData>
): Observable<TData>;
export function trpcSubscriptionToObservable<TData>(
  subscribeFn: (opts: {
    onData: (data: TData) => void;
    onError: (err: Error) => void;
    onComplete: () => void;
  }) => { unsubscribe: () => void }
): Observable<TData>;
export function trpcSubscriptionToObservable<TData>(
  subscriptionOrFn: TRPCSubscriptionLike<TData> | ((opts: {
    onData: (data: TData) => void;
    onError: (err: Error) => void;
    onComplete: () => void;
  }) => { unsubscribe: () => void })
): Observable<TData> {
  return new Observable<TData>((subscriber) => {
    const subscribe = typeof subscriptionOrFn === 'function'
      ? subscriptionOrFn
      : subscriptionOrFn.subscribe.bind(subscriptionOrFn);

    const subscription = subscribe({
      onData: (data) => subscriber.next(data),
      onError: (err) => subscriber.error(err),
      onComplete: () => subscriber.complete(),
    });

    return () => subscription.unsubscribe();
  });
}
