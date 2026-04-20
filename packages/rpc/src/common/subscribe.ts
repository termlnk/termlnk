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

/**
 * 将 RxJS Observable 转换为 AsyncGenerator
 * 用于 tRPC subscription 返回
 *
 * @param observable - RxJS Observable
 * @returns AsyncGenerator 用于 tRPC subscription
 *
 * @example
 * ```typescript
 * const observable = someService.getData$();
 * yield* observableToAsyncGenerator(observable);
 * ```
 */
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

/**
 * tRPC subscription 对象，包含 subscribe 方法
 */
interface TRPCSubscriptionLike<TData> {
  subscribe: (opts: {
    onData: (data: TData) => void;
    onError: (err: Error) => void;
    onComplete: () => void;
  }) => { unsubscribe: () => void };
}

/**
 * 将 tRPC subscription 转换为 RxJS Observable
 * 用于在客户端订阅 tRPC subscription
 *
 * @param subscription - tRPC subscription 对象或函数，接收 onData/onError/onComplete 回调
 * @returns Observable 用于 RxJS 流处理
 *
 * @example
 * ```typescript
 * // 方式 1：直接传入 tRPC subscription 对象（无 input 的 subscription）
 * const onChanged$ = trpcSubscriptionToObservable(client.host.onChanged$);
 *
 * // 方式 2：传入函数（有 input 的 subscription）
 * const windowState$ = trpcSubscriptionToObservable(
 *   (opts) => client.window.getWindowState$.subscribe({ input: 1 }, opts)
 * );
 *
 * windowState$.subscribe({
 *   next: (state) => console.log('Window state:', state),
 *   error: (err) => console.error('Error:', err),
 *   complete: () => console.log('Completed'),
 * });
 * ```
 */
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
    // 判断是 subscription 对象还是函数
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
