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

export interface IContributedStatusBarItem {
  id: string;
  text: string;
  alignment?: 'left' | 'right';
  priority?: number;
  command?: string;
  tooltip?: string;
  icon?: string;
  color?: string;
}

export const contributedStatusBarItemSchema: z.ZodType<IContributedStatusBarItem> = z.object({
  id: z.string().min(1),
  text: z.string(),
  alignment: z.enum(['left', 'right']).optional(),
  priority: z.number().optional(),
  command: z.string().optional(),
  tooltip: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const contributedStatusBarSchema = z.array(contributedStatusBarItemSchema);

export const StatusBarContributionPoint: IExtensionPointDescriptor<IContributedStatusBarItem[]> = {
  name: 'statusBar',
  schema: contributedStatusBarSchema,
};

declare module '../../manifest/contribution-points' {
  interface IExtensionContributesMap {
    statusBar: IContributedStatusBarItem[];
  }
}
