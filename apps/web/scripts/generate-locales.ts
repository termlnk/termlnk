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
 * apps/web 的 locale 聚合生成器——对齐 apps/desktop/scripts/generate-locales.ts 的契约：
 * 扫 package.json `dependencies` 中具备 `src/locale/<lang>.ts` 的 `@termlnk/*` 包，
 * 输出 `import` + 五种语言各一个 `export const`（用 `merge` 拼接）。
 *
 * 与 desktop 的差异：apps/web 只产一个 locales.ts（无 main/renderer 拆分），所以入口
 * 只需一次调用。函数体几乎照抄，刻意不抽到 internal/shared 以保留 desktop 脚本的
 * 自包含性——首要是"产物可读、变更范围最小"。
 */

import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { dirname, resolve } from 'pathe';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../');

const locales = [
  'en-US',
  'zh-CN',
  'ja-JP',
  'ko-KR',
  'zh-TW',
];

async function generateLocales(pkgPath: string, output: string) {
  const pkg = fs.readJSONSync(pkgPath);

  const header = `// Automatically generate it, don't edit it!!

import { merge } from '@termlnk/core';
`;

  const deps = Object.keys(pkg.dependencies ?? {})
    .filter((dep) => {
      if (dep.startsWith('@termlnk')) {
        const localeDir = resolve(dirname(pkgPath), `./node_modules/${dep}/src/locale`);
        return fs.existsSync(localeDir);
      }
      return false;
    });

  const importStatements = deps.reduce((acc, dep) => {
    const formattedDep = dep.replace(/((@termlnk)\/|-)/g, '');
    locales.forEach((locale) => {
      acc += `import ${formattedDep}${locale.replace(/-/g, '')} from '${dep}/locale/${locale}';\n`;
    });
    return acc;
  }, '');

  const exportStatements = locales.reduce((acc, locale) => {
    const formattedLocale = locale.replace(/-/g, '');
    const depStatements = deps.map((dep) => {
      return `  ${dep.replace(/((@termlnk)\/|-)/g, '')}${formattedLocale}`;
    }).join(',\n');

    acc += `export const ${formattedLocale} = merge(\n  {},\n${depStatements}\n);\n`;
    return acc;
  }, '');

  const content = `${header}\n${importStatements}\n${exportStatements}`;
  fs.writeFileSync(output, content);
}

const pkgPath = resolve(rootDir, './package.json');
const output = resolve(rootDir, './src/locales.ts');
generateLocales(pkgPath, output);
