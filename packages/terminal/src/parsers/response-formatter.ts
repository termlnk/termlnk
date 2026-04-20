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

/**
 * DCS Response Formatters
 *
 * These functions format DCS response strings that the terminal
 * writes back to the PTY in response to device queries.
 */

const DCS = '\x1BP';
const ST = '\x1B\\';

/**
 * Format an XTVERSION response
 *
 * Response format: DCS > | Name(Version) ST
 *
 * @param name - Terminal name (e.g., "Termlnk")
 * @param version - Terminal version (e.g., "0.0.0")
 * @returns The complete DCS response string
 *
 * @example
 * formatXtVersionResponse('Termlnk', '0.0.0')
 * // Returns: '\x1bP>|Termlnk(0.0.0)\x1b\\'
 */
export function formatXtVersionResponse(name: string, version: string): string {
  return `${DCS}>|${name}(${version})${ST}`;
}

/**
 * Format a DECRQSS response
 *
 * Response format:
 * - Valid: DCS 1 $ r <setting> ST
 * - Invalid: DCS 0 $ r ST
 *
 * @param valid - Whether the requested setting is supported
 * @param setting - The setting value to report
 * @returns The complete DCS response string
 */
export function formatDecrqssResponse(valid: boolean, setting: string): string {
  if (valid) {
    return `${DCS}1$r${setting}${ST}`;
  }
  return `${DCS}0$r${ST}`;
}

/**
 * Format an XTGETTCAP response for a single capability
 *
 * Response format:
 * - Found: DCS 1 + r <hex-name> = <hex-value> ST
 * - Not found: DCS 0 + r <hex-name> ST
 *
 * @param hexName - Hex-encoded capability name
 * @param hexValue - Hex-encoded capability value (undefined if not found)
 * @returns The complete DCS response string
 */
export function formatXtGetTcapResponse(hexName: string, hexValue?: string): string {
  if (hexValue !== undefined) {
    return `${DCS}1+r${hexName}=${hexValue}${ST}`;
  }
  return `${DCS}0+r${hexName}${ST}`;
}

/**
 * Encode a string to hex pairs (for XTGETTCAP responses)
 *
 * @param str - The string to encode
 * @returns Hex-encoded string
 */
export function encodeHex(str: string): string {
  return Array.from(str)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decode hex pairs to a string (for XTGETTCAP requests)
 *
 * @param hex - The hex string to decode
 * @returns Decoded string
 */
export function decodeHex(hex: string): string {
  const chars: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    chars.push(String.fromCharCode(Number.parseInt(hex.substring(i, i + 2), 16)));
  }
  return chars.join('');
}
