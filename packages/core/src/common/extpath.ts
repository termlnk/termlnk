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

import { CharCode } from './char-code';
import { normalize, posix } from './path';
import { isWindows } from './platform';

export function isPathSeparator(code: number) {
  return code === CharCode.Slash || code === CharCode.Backslash;
}

/**
 * Takes a Windows OS path and changes backward slashes to forward slashes.
 * This should only be done for OS paths from Windows (or user provided paths potentially from Windows).
 * Using it on a Linux or MaxOS path might change it.
 */
export function toSlashes(osPath: string) {
  return osPath.replace(/[\\/]/g, posix.sep);
}

/**
 * Takes a Windows OS path (using backward or forward slashes) and turns it into a posix path:
 * - turns backward slashes into forward slashes
 * - makes it absolute if it starts with a drive letter
 * This should only be done for OS paths from Windows (or user provided paths potentially from Windows).
 * Using it on a Linux or MaxOS path might change it.
 */
export function toPosixPath(osPath: string) {
  if (!osPath.includes('/')) {
    osPath = toSlashes(osPath);
  }
  if (/^[a-zA-Z]:(\/|$)/.test(osPath)) { // starts with a drive letter
    osPath = `/${osPath}`;
  }
  return osPath;
}

/**
 * Computes the _root_ this path, like `getRoot('c:\files') === c:\`,
 * `getRoot('files:///files/path') === files:///`,
 * or `getRoot('\\server\shares\path') === \\server\shares\`
 */
export function getRoot(path: string, sep: string = posix.sep): string {
  if (!path) {
    return '';
  }

  const len = path.length;
  const firstLetter = path.charCodeAt(0);
  if (isPathSeparator(firstLetter)) {
    if (isPathSeparator(path.charCodeAt(1))) {
      // UNC candidate \\localhost\shares\ddd
      //               ^^^^^^^^^^^^^^^^^^^
      if (!isPathSeparator(path.charCodeAt(2))) {
        let pos = 3;
        const start = pos;
        for (; pos < len; pos++) {
          if (isPathSeparator(path.charCodeAt(pos))) {
            break;
          }
        }
        if (start !== pos && !isPathSeparator(path.charCodeAt(pos + 1))) {
          pos += 1;
          for (; pos < len; pos++) {
            if (isPathSeparator(path.charCodeAt(pos))) {
              return path.slice(0, pos + 1) // consume this separator
                .replace(/[\\/]/g, sep);
            }
          }
        }
      }
    }

    // /user/far
    // ^
    return sep;
  } else if (isWindowsDriveLetter(firstLetter)) {
    // check for windows drive letter c:\ or c:

    if (path.charCodeAt(1) === CharCode.Colon) {
      if (isPathSeparator(path.charCodeAt(2))) {
        // C:\fff
        // ^^^
        return path.slice(0, 2) + sep;
      } else {
        // C:
        // ^^
        return path.slice(0, 2);
      }
    }
  }

  // check for URI
  // scheme://authority/path
  // ^^^^^^^^^^^^^^^^^^^
  let pos = path.indexOf('://');
  if (pos !== -1) {
    pos += 3; // 3 -> "://".length
    for (; pos < len; pos++) {
      if (isPathSeparator(path.charCodeAt(pos))) {
        return path.slice(0, pos + 1); // consume this separator
      }
    }
  }

  return '';
}

export function isWindowsDriveLetter(char0: number): boolean {
  // eslint-disable-next-line style/no-mixed-operators
  return char0 >= CharCode.A && char0 <= CharCode.Z || char0 >= CharCode.a && char0 <= CharCode.z;
}

export function hasDriveLetter(path: string, isWindowsOS: boolean = isWindows): boolean {
  if (isWindowsOS) {
    return isWindowsDriveLetter(path.charCodeAt(0)) && path.charCodeAt(1) === CharCode.Colon;
  }

  return false;
}

export function isRootOrDriveLetter(path: string): boolean {
  const pathNormalized = normalize(path);

  if (isWindows) {
    if (path.length > 3) {
      return false;
    }

    return hasDriveLetter(pathNormalized) &&
      (path.length === 2 || pathNormalized.charCodeAt(2) === CharCode.Backslash);
  }

  return pathNormalized === posix.sep;
}
