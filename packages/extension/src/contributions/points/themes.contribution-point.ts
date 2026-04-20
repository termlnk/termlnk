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

export interface IContributedTheme {
  id: string;
  label: string;
  path: string;
  uiTheme?: 'dark' | 'light';
}

export const contributedThemeSchema: z.ZodType<IContributedTheme> = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().min(1),
  uiTheme: z.enum(['dark', 'light']).optional(),
});

export const contributedThemesSchema = z.array(contributedThemeSchema);

export const ThemesContributionPoint: IExtensionPointDescriptor<IContributedTheme[]> = {
  name: 'themes',
  schema: contributedThemesSchema,
};

declare module '../../manifest/contribution-points' {
  interface IExtensionContributesMap {
    themes: IContributedTheme[];
  }
}
