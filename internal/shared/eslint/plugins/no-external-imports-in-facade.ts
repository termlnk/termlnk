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
      description: 'Disallow imports from outside facade directory in facade files',
    },
    messages: {
      noExternalImports: 'Imports from outside facade directory are not allowed in facade files: "{{importPath}}"',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    const normalizedPath = filename.split(path.sep).join('/');
    const isFacadeFile = normalizedPath.includes('/facade/');

    if (!isFacadeFile) {
      return {};
    }

    const currentDir = path.dirname(filename);

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;

        if (importPath[0] !== '.') {
          return;
        }

        const resolvedPath = path.resolve(currentDir, importPath).split(path.sep).join('/');

        if (!resolvedPath.includes('/facade/')) {
          context.report({
            node,
            messageId: 'noExternalImports',
            data: { importPath },
          });
        }
      },
    };
  },
};
