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

import type { ICreateWindowOptions } from '@termlnk/electron';
import type { IRPCContext } from '@termlnk/rpc';
import { IWindowManagerService, WindowEvent } from '@termlnk/electron';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { publicProcedure, router } from '@termlnk/rpc-server';
import { BrowserWindow } from 'electron';
import { z } from 'zod';

function getWindowManagerService(ctx: IRPCContext) {
  return ctx.injector.get(IWindowManagerService);
}

export const windowRouter = router({
  getCurrentWindowId: publicProcedure.query(async ({ ctx }) => {
    if (ctx.windowId === undefined) {
      throw new Error('windowId not found in RPC context');
    }
    return ctx.windowId;
  }),
  createWindow: publicProcedure.input(z.object({
    url: z.string(),
    options: z.any().optional() as z.ZodType<ICreateWindowOptions | undefined>,
  })).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).createWindow(input.url, input?.options);
  }),
  hasWindow: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).hasWindow(input);
  }),
  showWindow: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).showWindow(input);
  }),
  hideWindow: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).hideWindow(input);
  }),
  minimizeWindow: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).minimizeWindow(input);
  }),
  maximizeWindow: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).maximizeWindow(input);
  }),
  toggleMaximizeWindow: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).toggleMaximizeWindow(input);
  }),
  toggleFullScreen: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).toggleFullScreen(input);
  }),
  closeWindow: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).closeWindow(input);
  }),
  destroyWindow: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).destroyWindow(input);
  }),
  setAlwaysOnTop: publicProcedure.input(z.object({
    id: z.number(),
    flag: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).setAlwaysOnTop(input.id, input.flag);
  }),
  setOpacity: publicProcedure.input(z.object({
    id: z.number(),
    opacity: z.number().min(0).max(1),
  })).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).setOpacity(input.id, input.opacity);
  }),
  setVibrancy: publicProcedure.input(z.object({
    id: z.number(),
    type: z.string().nullable(),
  })).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).setVibrancy(input.id, input.type);
  }),
  setBackgroundMaterial: publicProcedure.input(z.object({
    id: z.number(),
    material: z.string(),
  })).mutation(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).setBackgroundMaterial(input.id, input.material);
  }),
  getWindowState: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    return getWindowManagerService(ctx).getWindowState(input);
  }),
  getWindowState$: publicProcedure.input(z.number()).subscription(async function* ({ ctx, input }) {
    const observable = getWindowManagerService(ctx).getWindowState$(input);
    yield* observableToAsyncGenerator(observable);
  }),
  onWindowEvent$: publicProcedure.input(z.object({
    id: z.number(),
    event: z.enum(Object.values(WindowEvent) as [WindowEvent, ...WindowEvent[]]).optional(),
  })).subscription(async function* ({ ctx, input }) {
    const observable = getWindowManagerService(ctx).onWindowEvent$(input.id, input?.event);
    yield* observableToAsyncGenerator(observable);
  }),
  setIgnoreMouseEvents: publicProcedure.input(z.object({
    id: z.number(),
    ignore: z.boolean(),
    forward: z.boolean().optional(),
  })).mutation(async ({ input }) => {
    const win = BrowserWindow.fromId(input.id);
    if (win) {
      win.setIgnoreMouseEvents(input.ignore, { forward: input.forward ?? false });
    }
  }),
});

export type WindowRouter = typeof windowRouter;
