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

export function removeAt<T>(arr: T[], item: T): boolean {
  const index = arr.indexOf(item);
  if (index > -1) {
    arr.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Asynchronous variant of `Array.find()`, returning the first element in
 * the array for which the predicate returns true.
 *
 * This implementation does not bail early and waits for all promises to
 * resolve before returning.
 */
export async function findAsync<T>(array: readonly T[], predicate: (element: T, index: number) => Promise<boolean>): Promise<T | undefined> {
  const results = await Promise.all(array.map(
    async (element, index) => ({ element, ok: await predicate(element, index) })
  ));

  return results.find((r) => r.ok)?.element;
}

/**
 * Rotate an array without mutating the original array.
 * @param arr the array to be rotated
 * @param steps how many steps to rotate
 * @returns the rotated array, it is another array, the original array is not mutated.
 */
export function rotate<T>(arr: Readonly<T[]>, steps: number): readonly T[] {
  if (arr.length === 0) {
    return arr;
  }

  const offset = steps % arr.length;
  return [...arr.slice(offset), ...arr.slice(0, offset)];
}

export function groupBy<T>(arr: Readonly<T[]>, keyFn: (v: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  arr.forEach((element) => {
    const key = keyFn(element);

    let group = groups.get(key);
    if (!groups.has(key)) {
      group = [];
      groups.set(key, group);
    }

    group!.push(element);
  });

  return groups;
}
