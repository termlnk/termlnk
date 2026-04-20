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

export interface IContributedMenuItem {
  command: string;
  when?: string;
  group?: string;
  order?: number;
  title?: string;
  icon?: string;
}

export const contributedMenuItemSchema: z.ZodType<IContributedMenuItem> = z.object({
  command: z.string().min(1),
  when: z.string().optional(),
  group: z.string().optional(),
  order: z.number().optional(),
  title: z.string().optional(),
  icon: z.string().optional(),
});

export const contributedMenusSchema = z.record(z.string(), z.array(contributedMenuItemSchema));

export const MenusContributionPoint: IExtensionPointDescriptor<Record<string, IContributedMenuItem[]>> = {
  name: 'menus',
  schema: contributedMenusSchema,
};

declare module '../../manifest/contribution-points' {
  interface IExtensionContributesMap {
    menus: Record<string, IContributedMenuItem[]>;
  }
}
