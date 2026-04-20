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

import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { dirname, resolve } from 'pathe';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../');

const mainDir = resolve(rootDir, './main');
const rendererDir = resolve(rootDir, './renderer');

const locales = [
  'en-US',
  'zh-CN',
  'ja-JP',
  'ko-KR',
  'zh-TW',
];

/**
 * Generate locales files
 */
async function generateLocales(pkgPath: string, output: string | Array<string>) {
  const pkg = fs.readJSONSync(pkgPath);

  const header = `// Automatically generate it, don't edit it!!

import { merge } from '@termlnk/core';
`;

  const deps = Object.keys(pkg.dependencies)
    .filter((dep) => {
      if (dep.startsWith('@termlnk')) {
        const localeDir = resolve(dirname(pkgPath), `./node_modules/${dep}/src/locale`);
        return fs.existsSync(localeDir);
      }
      return false;
    });

  const importStatements = deps.reduce((acc, dep) => {
    const formattedDep = dep.replace(/((@termlnk)\/|\-)/g, '');
    locales.forEach((locale) => {
      acc += `import ${formattedDep}${locale.replace(/-/g, '')} from '${dep}/locale/${locale}';\n`;
    });
    return acc;
  }, '');

  const exportStatements = locales.reduce((acc, locale) => {
    const formattedLocale = locale.replace(/-/g, '');
    const depStatements = deps.map((dep) => {
      return `  ${dep.replace(/((@termlnk)\/|\-)/g, '')}${formattedLocale}`;
    }).join(',\n');

    acc += `export const ${formattedLocale} = merge(\n  {},\n${depStatements}\n);\n`;
    return acc;
  }, '');

  const content = `${header}\n${importStatements}\n${exportStatements}`;

  if (typeof output === 'string') {
    fs.writeFileSync(output, content);
  } else if (Array.isArray(output)) {
    output.forEach((v) => fs.writeFileSync(v, content));
  }
}

// main
const mainPkgPath = resolve(mainDir, './package.json');
const mainOutput = resolve(mainDir, './src/locales.ts');
generateLocales(mainPkgPath, mainOutput);

// renderer
const rendererPkgPath = resolve(rendererDir, './package.json');
const rendererOutput = resolve(rendererDir, './src/components/locales.ts');
generateLocales(rendererPkgPath, rendererOutput);
