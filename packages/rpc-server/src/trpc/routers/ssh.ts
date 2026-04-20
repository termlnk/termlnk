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

import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { ISSHSessionService, ITerminalSessionNotifyService, observableToAsyncGenerator } from '@termlnk/rpc';
import { HostType } from '@termlnk/terminal';
import { bufferTime, filter, map } from 'rxjs';
import { Client } from 'ssh2';
import { z } from 'zod';
import { DEFAULT_SSH_CONNECTION_TIMEOUT } from '../../config/config';
import { ISSHSocketService } from '../../services/ssh/ssh-socket.service';
import { sessionIdSchema } from '../schema/ssh.schema';
import { publicProcedure, router } from '../trpc';

export type SSHRouter = typeof sshRouter;

export const sshRouter = router({
  createSession: publicProcedure
    .input(z.object({
      hostId: z.string(),
      sessionId: z.string().optional(),
      cols: z.number().optional().default(80),
      rows: z.number().optional().default(24),
      password: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sshSessionService = ctx.injector.get(ISSHSessionService);
      return sshSessionService.createSession(input.hostId, { sessionId: input.sessionId, cols: input.cols, rows: input.rows, password: input.password });
    }),

  closeSession: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const sshSessionService = ctx.injector.get(ISSHSessionService);
      return sshSessionService.closeSession(input);
    }),

  retrySession: publicProcedure
    .input(z.object({ sessionId: sessionIdSchema, password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sshSessionService = ctx.injector.get(ISSHSessionService);
      return sshSessionService.retrySession(input.sessionId, input.password);
    }),

  resize: publicProcedure
    .input(z.object({
      sessionId: sessionIdSchema,
      rows: z.number(),
      cols: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sshSessionService = ctx.injector.get(ISSHSessionService);
      return sshSessionService.resize(input.sessionId, input.rows, input.cols);
    }),

  write: publicProcedure
    .input(z.object({
      sessionId: sessionIdSchema,
      data: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sshSessionService = ctx.injector.get(ISSHSessionService);
      return sshSessionService.write(input.sessionId, input.data);
    }),

  respondKeyboardInteractive: publicProcedure
    .input(z.object({ sessionId: sessionIdSchema, responses: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const session = ctx.injector.get(ISSHSessionService).getSession(input.sessionId);
      session?.respondKeyboardInteractive(input.responses);
    }),

  respondChangePassword: publicProcedure
    .input(z.object({ sessionId: sessionIdSchema, newPassword: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = ctx.injector.get(ISSHSessionService).getSession(input.sessionId);
      session?.respondChangePassword(input.newPassword);
    }),

  data$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const sshSessionService = ctx.injector.get(ISSHSessionService);
      const session = sshSessionService.getSession(input);
      if (!session) {
        throw new Error(`Session ${input} not found`);
      }
      const base64$ = session.data$.pipe(
        bufferTime(8),
        filter((chunks: Uint8Array[]) => chunks.length > 0),
        map((chunks: Uint8Array[]) => {
          const total = chunks.reduce((sum, c) => sum + c.length, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          return Buffer.from(merged).toString('base64');
        })
      );
      yield* observableToAsyncGenerator(base64$);
    }),

  status$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const sshSessionService = ctx.injector.get(ISSHSessionService);
      const session = sshSessionService.getSession(input);
      if (!session) {
        throw new Error(`Session ${input} not found`);
      }
      yield* observableToAsyncGenerator(session.status$);
    }),

  event$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const session = ctx.injector.get(ISSHSessionService).getSession(input);
      if (!session) {
        throw new Error(`Session ${input} not found`);
      }
      yield* observableToAsyncGenerator(session.event$);
    }),

  error$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const sshSessionService = ctx.injector.get(ISSHSessionService);
      const session = sshSessionService.getSession(input);
      if (!session) {
        throw new Error(`Session ${input} not found`);
      }
      yield* observableToAsyncGenerator(session.error$);
    }),

  sessionCreated$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const notifyService = ctx.injector.get(ITerminalSessionNotifyService);
      yield* observableToAsyncGenerator(notifyService.sessionCreated$);
    }),

  sessionClosed$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const notifyService = ctx.injector.get(ITerminalSessionNotifyService);
      yield* observableToAsyncGenerator(notifyService.sessionClosed$);
    }),

  setFocusedSession: publicProcedure
    .input(z.string().nullable())
    .mutation(async ({ ctx, input }) => {
      const notifyService = ctx.injector.get(ITerminalSessionNotifyService);
      notifyService.setFocusedSession(input);
    }),

  testConnection: publicProcedure
    .input(z.object({
      addr: z.string().trim().min(1),
      port: z.number().int().min(1).max(65535),
      credential: z.discriminatedUnion('type', [
        z.object({ type: z.literal('password'), username: z.string(), password: z.string() }),
        z.object({ type: z.literal('rsa'), username: z.string(), privateKey: z.string() }),
      ]),
      proxy: z.object({
        enabled: z.boolean(),
        type: z.enum(['socks5', 'http']),
        host: z.string(),
        port: z.number(),
        username: z.string().optional(),
        password: z.string().optional(),
      }).optional(),
      settings: z.object({
        connectTimeout: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sshSocketService = ctx.injector.get(ISSHSocketService);
      const startedAt = Date.now();

      const tempHost = {
        id: randomUUID(),
        pid: '',
        label: '',
        type: HostType.HOST as const,
        sort: 0,
        addr: input.addr,
        port: input.port,
        credential: input.credential,
        proxy: {
          enabled: input.proxy?.enabled ?? false,
          type: input.proxy?.type ?? 'socks5' as const,
          host: input.proxy?.host ?? '',
          port: input.proxy?.port ?? 0,
          username: input.proxy?.username,
          password: input.proxy?.password,
        },
        settings: {
          connectTimeout: input.settings?.connectTimeout ?? DEFAULT_SSH_CONNECTION_TIMEOUT,
          connectHeartbeat: 0,
          runScript: '',
          encode: 'utf-8',
          x11Forward: false,
          termType: 'xterm-256color',
          fontFamily: '',
          fontSize: 12,
        },
      };

      try {
        const config = await sshSocketService.createConnectConfig(tempHost);
        await new Promise<void>((resolve, reject) => {
          const client = new Client();
          const timer = setTimeout(() => {
            client.destroy();
            reject(new Error('Connection timed out'));
          }, tempHost.settings.connectTimeout);

          client.on('ready', () => {
            clearTimeout(timer);
            client.end();
            resolve();
          });

          client.on('error', (err) => {
            clearTimeout(timer);
            client.destroy();
            reject(err);
          });

          client.connect(config);
        });

        return {
          ok: true as const,
          latency: Date.now() - startedAt,
        };
      } catch (err) {
        return {
          ok: false as const,
          latency: Date.now() - startedAt,
          message: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    }),
});
