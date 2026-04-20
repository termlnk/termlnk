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

import type { Plugin } from 'vite';
import commonExternals from './common-external';

const commonExternalKeys = Object.keys(commonExternals);

export function autoDetectedExternalPlugin(): Plugin {
  const globals = {};
  let hasCss = false;

  return {
    name: 'auto-detected-external',
    enforce: 'pre',
    apply: 'build',

    resolveId(source) {
      if (source.endsWith('.css')) {
        hasCss = true;
        return null;
      }

      if (source in commonExternals) {
        globals[source] = commonExternals[source].global;

        return { id: source, external: true };
      } else if (startsWith(source, ['@termlnk'])) {
        globals[source] = convertLibNameFromPackageName(source);

        return { id: source, external: true };
      }

      // Match sub-path imports like '@base-ui/react/switch' or 'lucide-react/icons/Check'
      const matchedKey = commonExternalKeys.find((key) => source.startsWith(`${key}/`));
      if (matchedKey) {
        globals[source] = commonExternals[matchedKey].global;
        return { id: source, external: true };
      }

      return null;
    },

    outputOptions(opts) {
      opts.globals = globals;

      if (hasCss) {
        opts.assetFileNames = 'index.css';
      }

      return opts;
    },
  };
}

function startsWith(source: string, starts: string | string[]): boolean {
  if (typeof starts === 'string') {
    return source.startsWith(starts);
  } else if (Array.isArray(starts)) {
    return starts.some((prefix) => source.startsWith(prefix));
  }
  return false;
}

/**
 * Convert the package name to the library name.
 *
 * @param name
 * @returns Library name
 * @example
 * convertLibNameFromPackageName('@termlnk/fe-common') // DreamDanceFeCommon
 * convertLibNameFromPackageName(''@termlnk/watermark/facade') // DreamDanceWatermarkFacade
 */
export function convertLibNameFromPackageName(name: string) {
  return name
    .replace('/facade', '-facade')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}
