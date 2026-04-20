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

export interface IContributedTerminalProfile {
  id: string;
  title: string;
  icon?: string;
}

export const contributedTerminalProfileSchema: z.ZodType<IContributedTerminalProfile> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  icon: z.string().optional(),
});

export const contributedTerminalProfilesSchema = z.array(contributedTerminalProfileSchema);

export const TerminalProfilesContributionPoint: IExtensionPointDescriptor<IContributedTerminalProfile[]> = {
  name: 'terminal.profiles',
  schema: contributedTerminalProfilesSchema,
};

declare module '../../manifest/contribution-points' {
  interface IExtensionContributesMap {
    'terminal.profiles': IContributedTerminalProfile[];
  }
}
