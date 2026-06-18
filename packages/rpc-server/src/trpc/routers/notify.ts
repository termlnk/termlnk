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

import { INotifyService, observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

const createNotifySchema = z.object({
  title: z.string(),
  body: z.string().optional(),
  type: z.enum(['info', 'success', 'warning', 'error']).optional(),
  source: z.enum(['terminal', 'system', 'extension', 'application', 'agent']).optional(),
  groupId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  showDesktop: z.boolean().optional(),
  transient: z.boolean().optional(),
  action: z.object({
    type: z.enum(['command', 'url']),
    commandId: z.string().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    url: z.string().optional(),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type NotifyRouter = typeof notifyRouter;

export const notifyRouter = router({
  notify: publicProcedure
    .input(createNotifySchema)
    .mutation(({ ctx, input }) => {
      const service = ctx.injector.get(INotifyService);
      const notification = service.notify(input);
      return { id: notification.id };
    }),

  markAsRead: publicProcedure
    .input(z.string())
    .mutation(({ ctx, input }) => {
      ctx.injector.get(INotifyService).markAsRead(input);
    }),

  markAllAsRead: publicProcedure
    .mutation(({ ctx }) => {
      ctx.injector.get(INotifyService).markAllAsRead();
    }),

  markGroupAsRead: publicProcedure
    .input(z.string())
    .mutation(({ ctx, input }) => {
      ctx.injector.get(INotifyService).markGroupAsRead(input);
    }),

  remove: publicProcedure
    .input(z.string())
    .mutation(({ ctx, input }) => {
      ctx.injector.get(INotifyService).remove(input);
    }),

  clearAll: publicProcedure
    .mutation(({ ctx }) => {
      ctx.injector.get(INotifyService).clearAll();
    }),

  clearRead: publicProcedure
    .mutation(({ ctx }) => {
      ctx.injector.get(INotifyService).clearRead();
    }),

  getAll: publicProcedure
    .query(({ ctx }) => {
      return ctx.injector.get(INotifyService).getNotifications();
    }),

  getStats: publicProcedure
    .query(({ ctx }) => {
      return ctx.injector.get(INotifyService).getStats();
    }),

  notifications$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(INotifyService);
      yield* observableToAsyncGenerator(service.notifications$);
    }),

  unreadCount$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(INotifyService);
      yield* observableToAsyncGenerator(service.unreadCount$);
    }),

  event$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(INotifyService);
      yield* observableToAsyncGenerator(service.notificationEvent$);
    }),
});
