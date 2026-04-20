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

import { TerminalSessionBackupRepository } from '@termlnk/database';
import { terminalSessionBackupDataSchema } from '../schema/terminal-session-backup.schema';
import { publicProcedure, router } from '../trpc';

export type TerminalSessionBackupRouter = typeof terminalSessionBackupRouter;

export const terminalSessionBackupRouter = router({
  load: publicProcedure.query(async ({ ctx }) => {
    const repo = ctx.injector.get(TerminalSessionBackupRepository);
    return repo.load();
  }),
  save: publicProcedure.input(terminalSessionBackupDataSchema).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(TerminalSessionBackupRepository);
    return repo.save(input);
  }),
  clear: publicProcedure.mutation(async ({ ctx }) => {
    const repo = ctx.injector.get(TerminalSessionBackupRepository);
    return repo.clear();
  }),
});
