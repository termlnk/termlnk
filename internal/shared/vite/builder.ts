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

import type { InlineConfig } from 'vite';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { copySync, readJsonSync, removeSync } from 'fs-extra/esm';
import { mergeConfig, build as viteBuild } from 'vite';
import dts from 'vite-plugin-dts';
import { cleanupPkgPlugin, convertLibNameFromPackageName } from './plugins';
import sharedConfig from './shared.config';

interface IBuildExecuterOptions {
  pkg: {
    name: string;
  };
  entry: Record<string, string>;
}

async function buildESM(inlineConfig: InlineConfig, options: IBuildExecuterOptions) {
  const { entry } = options;

  await Promise.all(Object.keys(entry).map((key) => {
    const basicConfig: InlineConfig = {
      build: {
        emptyOutDir: false,
        outDir: 'lib',
        lib: {
          entry: {
            [key]: entry[key],
          },
          fileName: () => `es/${key}.js`,
          cssFileName: 'index',
          formats: ['es'],
        },
        rolldownOptions: {
          output: {
            codeSplitting: false,
          },
        },
      },
    };

    const config: InlineConfig = mergeConfig(inlineConfig, basicConfig);

    if (key === 'index') {
      config.plugins?.unshift(cleanupPkgPlugin());
      config.plugins?.push(
        dts({
          entryRoot: 'src',
          outDir: 'lib/types',
          clearPureImport: false,
          exclude: ['**/__tests__/**'],
        })
      );
    }

    return viteBuild(config);
  }));

  const __dirname = cwd();
  const libDir = resolve(__dirname, 'lib');
  const esmDir = resolve(__dirname, 'lib/es');

  copySync(esmDir, libDir);
}

async function buildCJS(inlineConfig: InlineConfig, options: IBuildExecuterOptions) {
  const { entry } = options;

  return Promise.all(Object.keys(entry).map((key) => {
    const config: InlineConfig = mergeConfig(inlineConfig, {
      build: {
        emptyOutDir: false,
        outDir: 'lib',
        lib: {
          entry: {
            [key]: entry[key],
          },
          fileName: () => `cjs/${key}.js`,
          cssFileName: 'index',
          formats: ['cjs'],
        },
        rolldownOptions: {
          output: {
            codeSplitting: false,
          },
        },
      },
    });

    return viteBuild(config);
  }));
}

async function buildUMD(inlineConfig: InlineConfig, options: IBuildExecuterOptions) {
  const { pkg, entry } = options;

  return Promise.all(Object.keys(entry).map((key) => {
    let name = convertLibNameFromPackageName(pkg.name);
    if (key.includes('facade')) {
      name = `${name}Facade`;
    }
    if (key.includes('locale')) {
      const localeKey = key.split('/')[1];
      name = `${name}${convertLibNameFromPackageName(localeKey)}`;
    }

    const config: InlineConfig = mergeConfig(inlineConfig, {
      build: {
        emptyOutDir: false,
        outDir: 'lib',
        lib: {
          entry: {
            [key]: entry[key],
          },
          name,
          fileName: () => `umd/${key}.js`,
          cssFileName: 'index',
          formats: ['umd'],
        },
      },
    });

    return viteBuild(config);
  }));
}

export interface IBuildOptions {
  /**
   * Skip UMD build
   * @default true
   * @description If true, UMD build will be skipped. Useful for packages that run in Node.js environment.
   */
  skipUMD?: boolean;

  /**
   * Cleanup all compiled files
   * @default false
   */
  cleanup?: boolean;

  /**
   * Condition to build node first
   * @default false
   */
  nodeFirst?: boolean;
}

export async function build(options?: IBuildOptions) {
  const { skipUMD = true, cleanup = false, nodeFirst = false } = options ?? {};
  const __dirname = cwd();
  const pkg = readJsonSync(resolve(__dirname, 'package.json'));

  if (cleanup) {
    [
      resolve(__dirname, './lib'),
      resolve(__dirname, './coverage'),
    ].forEach((dir) => {
      if (existsSync(dir)) {
        removeSync(dir);
      }
    });
  }

  const entry: Record<string, string> = {
    index: resolve(__dirname, 'src/index.ts'),
  };
  const hasFacade = existsSync(resolve(__dirname, 'src/facade/index.ts'));
  const hasLocales = existsSync(resolve(__dirname, 'src/locale'));

  if (hasFacade) {
    entry.facade = resolve(__dirname, 'src/facade/index.ts');
  }
  if (hasLocales) {
    const locales = readdirSync(resolve(__dirname, 'src/locale'));
    for (const file of locales) {
      if (statSync(resolve(__dirname, 'src/locale', file)).isDirectory() || !file.includes('-')) {
        continue;
      }
      const localeValue = file.replace('.ts', '');
      entry[`locale/${localeValue}`] = resolve(__dirname, 'src/locale', file);
    }
  }

  const baseConfig: InlineConfig = mergeConfig(sharedConfig, {
    resolve: {
      conditions: nodeFirst ? ['node', 'default'] : undefined,
    },
  });

  const buildExecuterOptions: IBuildExecuterOptions = {
    pkg,
    entry,
  };

  // Clean up stale chunk files in lib/ root (leftovers from previous builds)
  const libDir = resolve(__dirname, './lib');
  if (existsSync(libDir)) {
    for (const entry of readdirSync(libDir)) {
      const fullPath = resolve(libDir, entry);
      if (!statSync(fullPath).isDirectory()) {
        removeSync(fullPath);
      }
    }
  }

  await buildESM(baseConfig, buildExecuterOptions);
  await buildCJS(baseConfig, buildExecuterOptions);
  if (!skipUMD) {
    await buildUMD(baseConfig, buildExecuterOptions);
  }
}
