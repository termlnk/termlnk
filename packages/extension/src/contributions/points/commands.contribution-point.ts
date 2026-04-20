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

import type { IExtensionPointDescriptor } from '../../registry/extension-point';
import { z } from 'zod';

export interface IContributedCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string;
  enablement?: string;
}

export const contributedCommandSchema: z.ZodType<IContributedCommand> = z.object({
  command: z.string(),
  title: z.string(),
  category: z.string().optional(),
  icon: z.string().optional(),
  enablement: z.string().optional(),
});

export const contributedCommandsSchema = z.array(contributedCommandSchema);

export const CommandsContributionPoint: IExtensionPointDescriptor<IContributedCommand[]> = {
  name: 'commands',
  schema: contributedCommandsSchema,
};

declare module '../../manifest/contribution-points' {
  interface IExtensionContributesMap {
    commands: IContributedCommand[];
  }
}
