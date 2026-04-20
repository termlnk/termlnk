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

import type { ActivationEvent } from './activation-events';
import type { IExtensionContributes } from './contribution-points';
import { z } from 'zod';

/**
 * Extension categories (for discoverability).
 */
export type ExtensionCategory =
  | 'terminal'
  | 'ssh'
  | 'themes'
  | 'utilities'
  | 'networking'
  | 'ai'
  | 'other';

/**
 * Extension type — drives UI grouping and rendering conventions. Mirrors
 * Alma's plugin type taxonomy.
 */
export type ExtensionType =
  | 'tool'
  | 'ui'
  | 'theme'
  | 'provider'
  | 'transform'
  | 'integration'
  | 'composite';

/**
 * Permission identifiers declared in `manifest.permissions[]`.
 * The host verifies each entry and gates the matching API slice on the
 * `IExtensionContext`. Domain-scoped permissions use `network:domain:<host>`.
 */
export type ExtensionPermission =
  | 'notifications'
  | 'commands'
  | 'tools:register'
  | 'terminal:read'
  | 'terminal:write'
  | 'terminal:session:create'
  | 'storage:global'
  | 'storage:secrets'
  | 'settings:read'
  | 'settings:write'
  | 'network:fetch'
  | `network:domain:${string}`
  | 'ui:statusBar'
  | 'ui:notifications'
  | 'ui:dialogs'
  | 'ui:webview'
  | 'ui:components'
  | 'providers:manage'
  | 'chat:read'
  | 'chat:write';

/**
 * Extension manifest — parsed from a standalone `manifest.json` file at the
 * root of the extension directory. Alma-style flat layout: all extension
 * fields live at the top level instead of being nested under a `termlnk`
 * wrapper.
 */
export interface IExtensionManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  license?: string;
  repository?: string | { url: string };
  keywords?: string[];
  icon?: string;
  main: string;
  type?: ExtensionType;
  categories?: ExtensionCategory[];
  engines: { termlnk: string };
  activationEvents: ActivationEvent[];
  permissions?: ExtensionPermission[];
  contributes?: IExtensionContributes;
  extensionDependencies?: string[];
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const extensionContributesSchema = z.record(z.string(), z.unknown());

const extensionCategorySchema = z.enum([
  'terminal',
  'ssh',
  'themes',
  'utilities',
  'networking',
  'ai',
  'other',
]);

const extensionTypeSchema = z.enum([
  'tool',
  'ui',
  'theme',
  'provider',
  'transform',
  'integration',
  'composite',
]);

const permissionSchema = z.string().refine(
  (val): val is ExtensionPermission => {
    const exact = new Set<string>([
      'notifications',
      'commands',
      'tools:register',
      'terminal:read',
      'terminal:write',
      'terminal:session:create',
      'storage:global',
      'storage:secrets',
      'settings:read',
      'settings:write',
      'network:fetch',
      'ui:statusBar',
      'ui:notifications',
      'ui:dialogs',
      'ui:webview',
      'ui:components',
      'providers:manage',
      'chat:read',
      'chat:write',
    ]);
    if (exact.has(val)) {
      return true;
    }
    return val.startsWith('network:domain:') && val.length > 'network:domain:'.length;
  },
  { message: 'Invalid extension permission' }
);

const activationEventSchema = z.string().refine(
  (val): val is ActivationEvent => {
    if (
      val === '*'
      || val === 'onSSHConnection'
      || val === 'onStartupFinished'
    ) {
      return true;
    }
    const prefixes = [
      'onCommand:',
      'onView:',
      'onUIPart:',
      'onTerminalSession:',
      'onConfig:',
    ];
    return prefixes.some((p) => val.startsWith(p));
  },
  { message: 'Invalid activation event format' }
);

const authorSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    email: z.string().optional(),
    url: z.string().optional(),
  }),
]);

export const extensionManifestSchema = z.object({
  id: z.string().regex(/^[\w-]+\.[\w-]+$/, 'Extension ID must be in format "publisher.name"'),
  name: z.string().min(1),
  version: z.string(),
  description: z.string().optional(),
  author: authorSchema.optional(),
  license: z.string().optional(),
  repository: z.union([z.string(), z.object({ url: z.string() })]).optional(),
  keywords: z.array(z.string()).optional(),
  icon: z.string().optional(),
  main: z.string().min(1),
  type: extensionTypeSchema.optional(),
  categories: z.array(extensionCategorySchema).optional(),
  engines: z.object({ termlnk: z.string() }),
  activationEvents: z.array(activationEventSchema),
  permissions: z.array(permissionSchema).optional(),
  contributes: extensionContributesSchema.optional(),
  extensionDependencies: z.array(z.string()).optional(),
});

/**
 * Validate a raw parsed manifest.json object as an extension manifest.
 */
export function validateManifest(raw: unknown): IExtensionManifest {
  return extensionManifestSchema.parse(raw) as IExtensionManifest;
}
