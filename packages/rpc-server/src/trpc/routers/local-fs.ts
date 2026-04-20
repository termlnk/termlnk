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

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export type LocalFsRouter = typeof localFsRouter;

export const localFsRouter = router({
  list: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const entries = await fs.readdir(input, { withFileTypes: true });
      const results = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(input, entry.name);
          try {
            const stats = await fs.stat(fullPath);
            return {
              filename: entry.name,
              isDirectory: entry.isDirectory(),
              isSymlink: entry.isSymbolicLink(),
              size: stats.size,
              mtime: Math.floor(stats.mtimeMs / 1000),
              atime: Math.floor(stats.atimeMs / 1000),
              mode: stats.mode,
            };
          } catch {
            return {
              filename: entry.name,
              isDirectory: entry.isDirectory(),
              isSymlink: entry.isSymbolicLink(),
              size: 0,
              mtime: 0,
              atime: 0,
              mode: 0,
            };
          }
        })
      );
      return results;
    }),

  stat: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const stats = await fs.stat(input);
      return {
        size: stats.size,
        mtime: Math.floor(stats.mtimeMs / 1000),
        atime: Math.floor(stats.atimeMs / 1000),
        mode: stats.mode,
        isDirectory: stats.isDirectory(),
        isSymlink: stats.isSymbolicLink(),
      };
    }),

  getHomePath: publicProcedure.query(() => {
    return os.homedir();
  }),

  getSeparator: publicProcedure.query(() => {
    return path.sep;
  }),

  exists: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      try {
        await fs.access(input);
        return true;
      } catch {
        return false;
      }
    }),

  walkDir: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const results: Array<{ absolutePath: string; relativePath: string; isDirectory: boolean }> = [];

      async function walk(dir: string, relativeBase: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            results.push({ absolutePath: fullPath, relativePath, isDirectory: true });
            await walk(fullPath, relativePath);
          } else {
            results.push({ absolutePath: fullPath, relativePath, isDirectory: false });
          }
        }
      }

      await walk(input, '');
      return results;
    }),

  mkdir: publicProcedure
    .input(z.string())
    .mutation(async ({ input }) => {
      await fs.mkdir(input, { recursive: true });
    }),
});
