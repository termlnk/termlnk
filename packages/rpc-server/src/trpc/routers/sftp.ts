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
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { filter } from 'rxjs';
import { ISFTPSessionService } from '../../services/sftp/sftp-session.service';
import { sftpChmodSchema, sftpCreateSessionSchema, sftpDownloadSchema, sftpPathSchema, sftpRenameSchema, sftpRespondChangePasswordSchema, sftpRespondKeyboardInteractiveSchema, sftpRetrySessionSchema, sftpSessionIdSchema, sftpUploadDirectorySchema, sftpUploadSchema, sftpWriteFileSchema } from '../schema/sftp.schema';
import { publicProcedure, router } from '../trpc';

export type SFTPRouter = typeof sftpRouter;

export const sftpRouter = router({
  createSession: publicProcedure
    .input(sftpCreateSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.createSession(input.hostId, { password: input.password });
    }),

  closeSession: publicProcedure
    .input(sftpSessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.closeSession(input);
    }),

  retrySession: publicProcedure
    .input(sftpRetrySessionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.retrySession(input.sessionId, input.password);
    }),

  respondKeyboardInteractive: publicProcedure
    .input(sftpRespondKeyboardInteractiveSchema)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.injector.get(ISFTPSessionService).getSession(input.sessionId);
      session?.respondKeyboardInteractive(input.responses, input.viaHopId);
    }),

  respondChangePassword: publicProcedure
    .input(sftpRespondChangePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.injector.get(ISFTPSessionService).getSession(input.sessionId);
      session?.respondChangePassword(input.newPassword, input.viaHopId);
    }),

  list: publicProcedure
    .input(sftpPathSchema)
    .query(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.list(input.sessionId, input.path);
    }),

  stat: publicProcedure
    .input(sftpPathSchema)
    .query(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.stat(input.sessionId, input.path);
    }),

  mkdir: publicProcedure
    .input(sftpPathSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.mkdir(input.sessionId, input.path);
    }),

  rmdir: publicProcedure
    .input(sftpPathSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.rmdir(input.sessionId, input.path);
    }),

  unlink: publicProcedure
    .input(sftpPathSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.unlink(input.sessionId, input.path);
    }),

  rename: publicProcedure
    .input(sftpRenameSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.rename(input.sessionId, input.oldPath, input.newPath);
    }),

  chmod: publicProcedure
    .input(sftpChmodSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.chmod(input.sessionId, input.path, input.mode);
    }),

  readFile: publicProcedure
    .input(sftpPathSchema)
    .query(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      const buf = await service.readFile(input.sessionId, input.path);
      return buf.toString('base64');
    }),

  writeFile: publicProcedure
    .input(sftpWriteFileSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      const data = Buffer.from(input.content, 'base64');
      return service.writeFile(input.sessionId, input.path, data);
    }),

  realpath: publicProcedure
    .input(sftpPathSchema)
    .query(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.realpath(input.sessionId, input.path);
    }),

  download: publicProcedure
    .input(sftpDownloadSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.download(input.sessionId, input.remotePath, input.localPath);
    }),

  upload: publicProcedure
    .input(sftpUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.upload(input.sessionId, input.localPath, input.remotePath);
    }),

  uploadDirectory: publicProcedure
    .input(sftpUploadDirectorySchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.uploadDirectory(input.sessionId, input.localBasePath, input.remoteBasePath, input.entries);
    }),

  cancelTransfer: publicProcedure
    .input(sftpSessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(ISFTPSessionService);
      return service.cancelTransfer(input);
    }),

  status$: publicProcedure
    .input(sftpSessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const session = ctx.injector.get(ISFTPSessionService).getSession(input);
      if (!session) {
        throw new Error(`SFTP session ${input} not found`);
      }
      yield* observableToAsyncGenerator(session.status$);
    }),

  event$: publicProcedure
    .input(sftpSessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const session = ctx.injector.get(ISFTPSessionService).getSession(input);
      if (!session) {
        throw new Error(`SFTP session ${input} not found`);
      }
      yield* observableToAsyncGenerator(session.event$);
    }),

  transferProgress$: publicProcedure
    .input(sftpSessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const service = ctx.injector.get(ISFTPSessionService);
      const progress$ = service.transferProgress$.pipe(
        filter((task) => task.sessionId === input)
      );
      yield* observableToAsyncGenerator(progress$);
    }),
});
