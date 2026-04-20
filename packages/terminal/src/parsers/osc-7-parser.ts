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
 * OSC 7 - Working Directory Report (freedesktop standard)
 *
 * Many modern shells (bash, zsh, fish) emit this sequence to advertise
 * the current working directory. Works for both local and SSH terminals.
 *
 * Format: ESC ] 7 ; file://hostname/path BEL
 * Example: \e]7;file://myhost/home/user\a
 */

export interface IOsc7Result {
  /** Whether parsing was successful */
  success: boolean;
  /** The parsed working directory path (if success) */
  cwd?: string;
  /** The hostname from the URL (if present) */
  hostname?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Parse OSC 7 data (working directory report)
 *
 * @param data - The raw OSC 7 payload (e.g., "file://hostname/path")
 * @returns The parsed result with cwd and hostname
 */
export function parseOsc7(data: string): IOsc7Result {
  const trimmed = data?.trim();

  if (!trimmed) {
    return { success: false, error: 'Empty OSC 7 data' };
  }

  // Handle file:// URL format
  if (trimmed.startsWith('file://')) {
    const withoutScheme = trimmed.slice(7);

    // Extract hostname (before first /)
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex < 0) {
      return { success: false, error: 'Invalid file URL: missing path' };
    }

    const hostname = withoutScheme.slice(0, slashIndex);
    const rawPath = withoutScheme.slice(slashIndex);

    // Decode percent-encoded characters
    const cwd = decodeURIComponentSafe(rawPath);

    return {
      success: true,
      cwd,
      hostname: hostname || undefined,
    };
  }

  // Some implementations may just send a path directly
  if (trimmed.startsWith('/')) {
    return {
      success: true,
      cwd: trimmed,
    };
  }

  return { success: false, error: `Unknown OSC 7 format: ${trimmed}` };
}

/**
 * Safe decodeURIComponent that won't throw on malformed input
 */
function decodeURIComponentSafe(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}
