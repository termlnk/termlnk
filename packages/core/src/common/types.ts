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

export type Nullable<T> = T | null | undefined;

export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

/**
 * @returns whether the provided parameter is a JavaScript String or not.
 */
export function isString(str: unknown): str is string {
  return (typeof str === 'string');
}

/**
 * @returns whether the provided parameter is a JavaScript Array and each element in the array is a string.
 */
export function isStringArray(value: unknown): value is string[] {
  return isArrayOf(value, isString);
}

/**
 * @returns whether the provided parameter is a JavaScript Array and each element in the array satisfies the provided type guard.
 */
export function isArrayOf<T>(value: unknown, check: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(check);
}

/**
 * @returns whether the provided parameter is of type `object` but **not**
 * `null`, an `array`, a `regexp`, nor a `date`.
 */
export function isObject(obj: unknown): obj is object {
  // The method can't do a type cast since there are type (like strings) which
  // are subclasses of any put not positvely matched by the function. Hence type
  // narrowing results in wrong results.
  return typeof obj === 'object'
    && obj !== null
    && !Array.isArray(obj)
    && !(obj instanceof RegExp)
    && !(obj instanceof Date);
}

/**
 * @returns whether the provided parameter is of type `Buffer` or Uint8Array dervived type
 */
export function isTypedArray(obj: unknown): obj is object {
  const TypedArray = Object.getPrototypeOf(Uint8Array);
  return typeof obj === 'object'
    && obj instanceof TypedArray;
}

/**
 * In **contrast** to just checking `typeof` this will return `false` for `NaN`.
 * @returns whether the provided parameter is a JavaScript Number or not.
 */
export function isNumber(obj: unknown): obj is number {
  return (typeof obj === 'number' && !isNaN(obj));
}

/**
 * @returns whether the provided parameter is an Iterable, casting to the given generic
 */
export function isIterable<T>(obj: unknown): obj is Iterable<T> {
  return !!obj && typeof (obj as any)[Symbol.iterator] === 'function';
}

/**
 * @returns whether the provided parameter is a JavaScript Boolean or not.
 */
export function isBoolean(obj: unknown): obj is boolean {
  return (obj === true || obj === false);
}

/**
 * @returns whether the provided parameter is undefined.
 */
export function isUndefined(obj: unknown): obj is undefined {
  return (typeof obj === 'undefined');
}

/**
 * @returns whether the provided parameter is defined.
 */
export function isDefined<T>(arg: T | null | undefined): arg is T {
  return !isUndefinedOrNull(arg);
}

/**
 * @returns whether the provided parameter is undefined or null.
 */
export function isUndefinedOrNull(obj: unknown): obj is undefined | null {
  return (isUndefined(obj) || obj === null);
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * @returns whether the provided parameter is an empty JavaScript Object or not.
 */
export function isEmptyObject(obj: unknown): obj is object {
  if (!isObject(obj)) {
    return false;
  }

  for (const key in obj) {
    if (hasOwnProperty.call(obj, key)) {
      return false;
    }
  }

  return true;
}

/**
 * @returns whether the provided parameter is a JavaScript Function or not.
 */
export function isFunction(obj: unknown): obj is Function {
  return (typeof obj === 'function');
}

/**
 * @returns whether the provided parameters is are JavaScript Function or not.
 */
export function areFunctions(...objects: unknown[]): boolean {
  return objects.length > 0 && objects.every(isFunction);
}
