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

import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { takeAfter } from '../rxjs';

describe('takeAfter', () => {
  it('emits values and completes once the condition is met', () => {
    const source$ = new Subject<number>();
    const values: number[] = [];
    let completed = false;

    source$.pipe(takeAfter((v) => v >= 2)).subscribe({
      next: (v) => values.push(v),
      complete: () => {
        completed = true;
      },
    });

    source$.next(1);
    source$.next(2);
    source$.next(3);

    expect(values).toEqual([1, 2]);
    expect(completed).toBe(true);
  });

  it('unsubscribes from the source after the condition completes the stream', () => {
    const source$ = new Subject<number>();

    source$.pipe(takeAfter((v) => v >= 2)).subscribe();
    expect(source$.observed).toBe(true);

    source$.next(1);
    expect(source$.observed).toBe(true);

    source$.next(2);
    expect(source$.observed).toBe(false);
  });

  it('unsubscribes from the source when downstream unsubscribes early', () => {
    const source$ = new Subject<number>();

    const subscription = source$.pipe(takeAfter((v) => v >= 10)).subscribe();
    expect(source$.observed).toBe(true);

    subscription.unsubscribe();
    expect(source$.observed).toBe(false);
  });

  it('unsubscribes from the source when the source errors', () => {
    const source$ = new Subject<number>();
    let caught: unknown;

    source$.pipe(takeAfter((v) => v >= 10)).subscribe({
      error: (error) => {
        caught = error;
      },
    });

    source$.error(new Error('boom'));
    expect(caught).toBeInstanceOf(Error);
    expect(source$.observed).toBe(false);
  });
});
