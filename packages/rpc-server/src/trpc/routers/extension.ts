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

import { IExtensionRegistryService, IExtensionStateService, IExtensionStorageService } from '@termlnk/extension';
import { IExtensionInstallService } from '@termlnk/extension-core';
import { z } from 'zod';
import { IFileDialogService } from '../../services/file-transfer/file-dialog.service';
import { publicProcedure, router } from '../trpc';

export type ExtensionRouter = typeof extensionRouter;

export const extensionRouter = router({
  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  scanExtensions: publicProcedure.query(async ({ ctx }) => {
    const storageService = ctx.injector.get(IExtensionStorageService);
    return storageService.scanExtensions();
  }),

  scanLocalExtension: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const storageService = ctx.injector.get(IExtensionStorageService);
      return storageService.scanLocalExtension(input);
    }),

  readExtensionFile: publicProcedure
    .input(z.object({
      extensionId: z.string(),
      filePath: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const storageService = ctx.injector.get(IExtensionStorageService);
      return storageService.readExtensionFile(input.extensionId, input.filePath);
    }),

  // ---------------------------------------------------------------------------
  // Install
  // ---------------------------------------------------------------------------

  npmInstall: publicProcedure.input(z.object({
    packageName: z.string(),
    version: z.string(),
    extensionId: z.string(),
  }))
    .mutation(async ({ ctx, input }) => {
      const installService = ctx.injector.get(IExtensionInstallService);
      const result = await installService.npmInstall(input.packageName, input.version, input.extensionId);
      return { success: true, path: result.path };
    }),

  removeExtension: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const installService = ctx.injector.get(IExtensionInstallService);
      await installService.removeExtension(input);
      return { success: true };
    }),

  showOpenDirectoryDialog: publicProcedure
    .input(z.object({
      title: z.string().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const fileDialogService = ctx.injector.get(IFileDialogService);
      const paths = await fileDialogService.showOpenDialog({
        title: input?.title ?? 'Select Extension Directory',
        directory: true,
      });

      if (paths.length === 0) {
        return { canceled: true, path: null };
      }

      return { canceled: false, path: paths[0] };
    }),

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  isEnabled: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const stateService = ctx.injector.get(IExtensionStateService);
      await stateService.load();
      return stateService.isEnabled(input);
    }),

  enable: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const stateService = ctx.injector.get(IExtensionStateService);
      stateService.enable(input);
    }),

  disable: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const stateService = ctx.injector.get(IExtensionStateService);
      stateService.disable(input);
    }),

  getDisabledExtensions: publicProcedure.query(async ({ ctx }) => {
    const stateService = ctx.injector.get(IExtensionStateService);
    await stateService.load();
    return stateService.getDisabledExtensions();
  }),

  getDevPaths: publicProcedure.query(async ({ ctx }) => {
    const stateService = ctx.injector.get(IExtensionStateService);
    await stateService.load();
    return stateService.getDevExtensionPaths();
  }),

  addDevPath: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const stateService = ctx.injector.get(IExtensionStateService);
      stateService.addDevExtensionPath(input);
    }),

  removeDevPath: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const stateService = ctx.injector.get(IExtensionStateService);
      stateService.removeDevExtensionPath(input);
    }),

  // ---------------------------------------------------------------------------
  // Registry
  // ---------------------------------------------------------------------------

  searchRegistry: publicProcedure
    .input(z.object({
      query: z.string(),
      category: z.string().optional(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const registryService = ctx.injector.get(IExtensionRegistryService);
      return registryService.search(input.query, { category: input.category, limit: input.limit });
    }),

  getRegistryMetadata: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const registryService = ctx.injector.get(IExtensionRegistryService);
      return registryService.getExtensionMetadata(input);
    }),

  getRegistryFeatured: publicProcedure.query(async ({ ctx }) => {
    const registryService = ctx.injector.get(IExtensionRegistryService);
    return registryService.getFeatured();
  }),
});
