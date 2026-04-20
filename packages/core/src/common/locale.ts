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

import { merge } from '../common/lodash';

export type LanguageValue = string | string[] | ILanguagePack | ILanguagePack[] | boolean;

export interface ILanguagePack {
  [key: string]: LanguageValue;
}

export interface ILocales {
  [key: string]: ILanguagePack;
}

type MergeLocalesInput = Record<string, any>;

/**
 * Merges multiple locale objects into a single locale object.
 * It can accept either multiple locale objects as arguments or a single array of locale objects.
 * @param locales - An array of locale objects or multiple locale objects.
 * @returns A merged locale object containing all key-value pairs from the input locales.
 */
export function mergeLocales(...locales: (MergeLocalesInput | MergeLocalesInput[])[]): MergeLocalesInput {
  let mergedLocales: MergeLocalesInput[];
  if (locales.length === 1 && Array.isArray(locales[0])) {
    mergedLocales = locales[0] as MergeLocalesInput[];
  } else {
    mergedLocales = locales as MergeLocalesInput[];
  }
  return merge({}, ...mergedLocales);
}
