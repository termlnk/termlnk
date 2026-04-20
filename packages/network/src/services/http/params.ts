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

type ValidParamType = string | number | boolean;

export class HTTPParams {
  constructor(readonly params?: { [key: string]: ValidParamType | ValidParamType[] }) {
    // empty
  }

  toString(): string {
    if (!this.params) {
      return '';
    }

    return Object.keys(this.params)
      .map((key) => {
        const value = this.params![key];
        if (Array.isArray(value)) {
          return value
            .map((v) => `${key}=${v}`)
            .join('&');
        }

        return `${key}=${value}`;
      })
      .join('&');
  }
}
