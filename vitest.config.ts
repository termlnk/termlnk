import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// @ts-ignore
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findVitestConfigs(): string[] {
  const baseDirs = [
    path.resolve(__dirname, './packages'),
    path.resolve(__dirname, './internal'),
  ];

  const vitestConfigPaths: string[] = [];

  function traverseDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const packageJsonPath = path.join(fullPath, 'package.json');
        if (existsSync(packageJsonPath)) {
          const viteConfigPath = path.join(fullPath, 'vitest.config.ts');
          if (existsSync(viteConfigPath)) {
            vitestConfigPaths.push(viteConfigPath);
          }
        } else {
          traverseDir(fullPath);
        }
      }
    }
  }

  for (const baseDir of baseDirs) {
    if (existsSync(baseDir)) {
      traverseDir(baseDir);
    }
  }

  return vitestConfigPaths;
}

export default defineConfig({
  test: {
    projects: [
      ...findVitestConfigs(),
    ],
  },
});
