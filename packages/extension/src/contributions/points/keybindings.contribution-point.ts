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

/**
 * A keybinding contribution — user-friendly string format like "Ctrl+Shift+P".
 * Platform-specific overrides can be supplied via `mac` / `win` / `linux`.
 */
export interface IContributedKeybinding {
  command: string;
  key: string;
  mac?: string;
  linux?: string;
  win?: string;
  when?: string;
}

export const contributedKeybindingSchema: z.ZodType<IContributedKeybinding> = z.object({
  command: z.string().min(1),
  key: z.string().min(1),
  mac: z.string().optional(),
  linux: z.string().optional(),
  win: z.string().optional(),
  when: z.string().optional(),
});

export const contributedKeybindingsSchema = z.array(contributedKeybindingSchema);

export const KeybindingsContributionPoint: IExtensionPointDescriptor<IContributedKeybinding[]> = {
  name: 'keybindings',
  schema: contributedKeybindingsSchema,
};

declare module '../../manifest/contribution-points' {
  interface IExtensionContributesMap {
    keybindings: IContributedKeybinding[];
  }
}
