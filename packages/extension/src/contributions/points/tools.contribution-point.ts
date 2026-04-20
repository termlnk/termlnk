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
 * A tool contributed by an extension. Tools are invoked by the AI agent — the
 * manifest declares the tool's id and metadata so the agent can discover it;
 * the extension later calls `ctx.tools.register(id, impl)` inside `activate()`
 * to provide the runtime handler.
 */
export interface IContributedTool {
  id: string;
  displayName?: string;
  description?: string;
  schema?: unknown;
}

export const contributedToolSchema: z.ZodType<IContributedTool> = z.object({
  id: z.string().min(1),
  displayName: z.string().optional(),
  description: z.string().optional(),
  schema: z.unknown().optional(),
});

export const contributedToolsSchema = z.array(contributedToolSchema);

export const ToolsContributionPoint: IExtensionPointDescriptor<IContributedTool[]> = {
  name: 'tools',
  schema: contributedToolsSchema,
};

declare module '../../manifest/contribution-points' {
  interface IExtensionContributesMap {
    tools: IContributedTool[];
  }
}
