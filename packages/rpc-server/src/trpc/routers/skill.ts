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

import type { ISkill } from '@termlnk/agent';
import { ISkillDiscoveryService, ISkillInstallerService, ISkillStateService } from '@termlnk/agent';
import { SkillRepository } from '@termlnk/database';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export type SkillRouter = typeof skillRouter;

export const skillRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const repo = ctx.injector.get(SkillRepository);
    const skillEntities = await repo.getAll();
    return skillEntities.map((entity) => {
      return {
        id: entity.id,
        name: entity.name,
        description: '',
        path: entity.path,
        source: entity.source,
        version: entity.version,
        author: '',
        tags: [],
        allowedTools: [],
        alwaysInject: false,
        enabled: entity.enabled,
        sortOrder: entity.sortOrder,
        checksum: entity.checksum,
      } as ISkill;
    });
  }),
  getEnabled: publicProcedure.query(async ({ ctx }) => {
    const repo = ctx.injector.get(SkillRepository);
    const skillEntities = await repo.getEnabled();
    return skillEntities.map((entity) => {
      return {
        id: entity.id,
        name: entity.name,
        description: '',
        path: entity.path,
        source: entity.source,
        version: entity.version,
        author: '',
        tags: [],
        allowedTools: [],
        alwaysInject: false,
        enabled: entity.enabled,
        sortOrder: entity.sortOrder,
        checksum: entity.checksum,
      } as ISkill;
    });
  }),
  setEnabled: publicProcedure.input(z.object({
    id: z.string(),
    enabled: z.boolean(),
  })).mutation(async ({ input, ctx }) => {
    const stateService = ctx.injector.get(ISkillStateService);
    return stateService.setEnabled(input.id, input.enabled);
  }),
  setSortOrder: publicProcedure.input(z.object({
    id: z.string(),
    sortOrder: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const stateService = ctx.injector.get(ISkillStateService);
    return stateService.setSortOrder(input.id, input.sortOrder);
  }),
  getContent: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const stateService = ctx.injector.get(ISkillStateService);
    return stateService.getSkillContent(input);
  }),
  refresh: publicProcedure.mutation(async ({ ctx }) => {
    const stateService = ctx.injector.get(ISkillStateService);
    return stateService.refresh();
  }),
  getRepositories: publicProcedure.query(async ({ ctx }) => {
    const installerService = ctx.injector.get(ISkillInstallerService);
    return installerService.getRepositories();
  }),
  addRepository: publicProcedure.input(z.object({
    repository: z.string().trim().min(1),
    branch: z.string().trim().optional(),
    subdirectory: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const installerService = ctx.injector.get(ISkillInstallerService);
    const stateService = ctx.injector.get(ISkillStateService);
    const repository = await installerService.addRepository(input);
    await stateService.refresh();
    return repository;
  }),
  updateRepository: publicProcedure.input(z.object({
    id: z.string().trim().min(1),
    repository: z.string().trim().min(1),
    branch: z.string().trim().optional(),
    subdirectory: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const installerService = ctx.injector.get(ISkillInstallerService);
    const stateService = ctx.injector.get(ISkillStateService);
    const repository = await installerService.updateRepository(input);
    await stateService.refresh();
    return repository;
  }),
  removeRepository: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const installerService = ctx.injector.get(ISkillInstallerService);
    const stateService = ctx.injector.get(ISkillStateService);
    await installerService.removeRepository(input);
    await stateService.refresh();
  }),
  uninstall: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const installerService = ctx.injector.get(ISkillInstallerService);
    const stateService = ctx.injector.get(ISkillStateService);
    await installerService.uninstall(input);
    await stateService.refresh();
  }),
  getRepositoryMarketplaceItems: publicProcedure.input(z.string().optional()).query(async ({ input, ctx }) => {
    const discoveryService = ctx.injector.get(ISkillDiscoveryService);
    return discoveryService.discoverRepositorySkills(input);
  }),
  installRepositorySkill: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const discoveryService = ctx.injector.get(ISkillDiscoveryService);
    const installerService = ctx.injector.get(ISkillInstallerService);
    const stateService = ctx.injector.get(ISkillStateService);
    const skill = (await discoveryService.discoverRepositorySkills()).find((item) => item.id === input);

    if (!skill) {
      throw new Error(`Repository marketplace skill not found: ${input}`);
    }

    await installerService.installFromPath(skill.path);
    await stateService.refresh();
  }),
  onChanged$: publicProcedure.subscription(async function* ({ ctx }) {
    const repo = ctx.injector.get(SkillRepository);
    yield* observableToAsyncGenerator(repo.changed$);
  }),
});
