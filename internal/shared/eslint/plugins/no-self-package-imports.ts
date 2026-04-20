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

import path from 'node:path';

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow self package imports in packages directory except facade',
    },
    messages: {
      noSelfImport: 'Package cannot import itself: "{{importPath}}" in {{packageName}}',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    const normalizedPath = filename.split(path.sep).join('/');

    const isInPackages = normalizedPath.includes('/packages/');
    const isInFacade = normalizedPath.includes('/facade/');

    if (!isInPackages || isInFacade) {
      return {};
    }

    // get parent dir
    const parentDirMatch = normalizedPath.match(/\/([^/]+)\/packages\//);
    if (!parentDirMatch) {
      return {};
    }

    const parentDir = parentDirMatch[1];
    const packagePrefix = parentDir === 'termlnk' ? '@termlnk/' : null;

    if (!packagePrefix) {
      return {};
    }

    // get package name
    const packageMatch = normalizedPath.match(/\/packages\/([^/]+)/);
    if (!packageMatch) {
      return {};
    }

    const packageName = packageMatch[1];
    const possiblePackageName = `${packagePrefix}${packageName}`;

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;

        if (importPath === possiblePackageName) {
          context.report({
            node,
            messageId: 'noSelfImport',
            data: {
              importPath,
              packageName: importPath,
            },
          });
        }
      },
    };
  },
};
