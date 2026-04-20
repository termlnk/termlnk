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
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { readJSONSync, writeJSONSync } from 'fs-extra/esm';
import sortKeys from 'sort-keys';
import commonExternals from './common-external';

function filterPackageName(packageName: string): string {
  if (packageName.startsWith('@termlnk/')) {
    return packageName.split('/').slice(0, 2).join('/');
  } else {
    return packageName;
  }
}

export function cleanupPkgPlugin(): Plugin {
  const __pkg = path.resolve(process.cwd(), 'package.json');
  const pkg = readJSONSync(__pkg);

  const externalDeps = {};
  const deps = {};

  return {
    name: 'cleanup-pkg',
    enforce: 'pre',
    apply: 'build',

    resolveId(source) {
      if (source in commonExternals) {
        const value = commonExternals[source];

        if (!(value.version in commonExternals)) {
          externalDeps[value.name] = value.version;
        }
      } else if (isLocalPackage(source)) {
        const name = filterPackageName(source);
        if (name !== pkg.name) {
          const name = filterPackageName(source);
          deps[name] = 'workspace:*';
        }
      }

      return null;
    },

    generateBundle() {
      const hasLocales = existsSync(path.resolve(process.cwd(), 'src/locale'));
      const hasFacade = existsSync(path.resolve(process.cwd(), 'src/facade/index.ts'));
      pkg.publishConfig = {
        access: 'public',
        main: './lib/es/index.js',
        module: './lib/es/index.js',
        exports: {
          '.': {
            import: './lib/es/index.js',
            require: './lib/cjs/index.js',
            types: './lib/types/index.d.ts',
          },
          './*': {
            import: './lib/es/*',
            require: './lib/cjs/*',
            types: './lib/types/index.d.ts',
          },
        },
      };
      if (hasLocales) {
        pkg.exports['./locale/*'] = './src/locale/*.ts';
        pkg.publishConfig.exports['./locale/*'] = {
          import: './lib/es/locale/*.js',
          require: './lib/cjs/locale/*.js',
          types: './lib/types/locale/*.d.ts',
        };
      }
      if (hasFacade) {
        pkg.exports['./facade'] = './src/facade/index.ts';
        pkg.publishConfig.exports['./facade'] = {
          import: './lib/es/facade.js',
          require: './lib/cjs/facade.js',
          types: './lib/types/facade/index.d.ts',
        };
      }
      pkg.publishConfig.exports['./lib/*'] = './lib/*';

      // optionalDependencies 中的包不写入 dependencies/peerDependencies，
      // 保留其"安装失败可静默跳过"的语义（如平台特定原生模块）。
      const optionalKeys = new Set(Object.keys(pkg.optionalDependencies ?? {}));
      const filteredDeps = Object.fromEntries(
        Object.entries(deps).filter(([key]) => !optionalKeys.has(key))
      );

      if (Object.keys(externalDeps).length > 0 || Object.keys(filteredDeps).length > 0) {
        pkg.peerDependencies = sortKeys({ ...externalDeps, ...filteredDeps });
      }

      // Remove the existing dependencies
      if (pkg?.dependencies) {
        for (const key of Object.keys(pkg.dependencies)) {
          if (isLocalPackage(key)) {
            delete pkg.dependencies[key];
          }
        }
        if (Object.keys(filteredDeps).length > 0) {
          pkg.dependencies = sortKeys({ ...pkg.dependencies, ...filteredDeps });
        }
      }

      writeJSONSync(__pkg, pkg, { spaces: 2, EOL: '\n' });
    },
  };
}

export function isLocalPackage(name: string): boolean {
  return name.startsWith('@termlnk');
}
