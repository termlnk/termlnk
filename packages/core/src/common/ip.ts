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

const IPV4_PATTERN = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const STRICT_IPV6_PATTERN = /^([\da-f]{1,4}:){7}[\da-f]{1,4}$/i;
const LOOSE_IPV6_PATTERN = /^([\da-f]{1,4}:){2,}[\da-f]{1,4}$/i;

export interface IIPValidationOptions {
  allowCompressedIPv6?: boolean;
}

export function isValidIPv4(value: string): boolean {
  return IPV4_PATTERN.test(value);
}

export function isValidIPv6(value: string, options?: IIPValidationOptions): boolean {
  if (options?.allowCompressedIPv6) {
    return LOOSE_IPV6_PATTERN.test(value);
  }
  return STRICT_IPV6_PATTERN.test(value);
}

export function isValidIP(value: string, options?: IIPValidationOptions): boolean {
  return isValidIPv4(value) || isValidIPv6(value, options);
}
