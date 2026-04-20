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

import { IFileTransferService, observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export type FileTransferRouter = typeof fileTransferRouter;

export const fileTransferRouter = router({
  transferEvent$: publicProcedure
    .input(z.string())
    .subscription(async function* ({ ctx, input }) {
      const fileTransferService = ctx.injector.get(IFileTransferService);
      yield* observableToAsyncGenerator(fileTransferService.transferEvent$(input));
    }),

  cancelTransfer: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const fileTransferService = ctx.injector.get(IFileTransferService);
      fileTransferService.cancelTransfer(input);
    }),
});
