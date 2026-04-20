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

export function trimClassNamePlugin() {
  return {
    name: 'vite-plugin-trim-classname',
    transform(code, id) {
      if (id.endsWith('.tsx')) {
        const transformedCode = code.replace(
          /className: `([^`}]+)`/g,
          (match, classNameValue) => {
            const cleanedClassName = classNameValue
              .replace(/\n/g, ' ')
              .replace(/\s{2,}/g, ' ')
              .trim();
            return `className: \`${cleanedClassName}\``;
          }
        ).replace(
          /clsx\(`([^`}]+)`/g,
          (match, classNameValue) => {
            const cleanedClassName = classNameValue
              .replace(/\n/g, ' ')
              .replace(/\s{2,}/g, ' ')
              .trim();
            return `clsx(\`${cleanedClassName}\``;
          }
        );

        return {
          code: transformedCode,
          map: null,
        };
      }
      return null;
    },
  };
}
