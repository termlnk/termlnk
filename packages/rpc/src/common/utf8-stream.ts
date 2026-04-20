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

import { map, Observable } from 'rxjs';

/**
 * 将 base64 编码的终端数据流解码为 UTF-8 字符串流。
 * 使用流式 TextDecoder 正确处理跨 chunk 的多字节字符（如 CJK、emoji 等）。
 *
 * @param source$ - base64 编码的数据流（来自 tRPC subscription）
 * @returns UTF-8 解码后的字符串流
 *
 * @example
 * ```typescript
 * const decoded$ = decodeBase64Utf8Stream(
 *   trpcSubscriptionToObservable((opts) => client.pty.data$.subscribe(sessionId, opts))
 * );
 * decoded$.subscribe((text) => terminal.write(text));
 * ```
 */
export function decodeBase64Utf8Stream(source$: Observable<string>): Observable<string> {
  return new Observable<string>((subscriber) => {
    const decoder = new TextDecoder('utf-8');

    const subscription = source$
      .pipe(
        map((base64) => {
          return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        })
      )
      .subscribe({
        next: (bytes) => {
          const chunk = decoder.decode(bytes, { stream: true });
          if (chunk.length > 0) {
            subscriber.next(chunk);
          }
        },
        error: (error) => {
          subscriber.error(error);
        },
        complete: () => {
          const flushed = decoder.decode();
          if (flushed.length > 0) {
            subscriber.next(flushed);
          }
          subscriber.complete();
        },
      });

    return () => subscription.unsubscribe();
  });
}
