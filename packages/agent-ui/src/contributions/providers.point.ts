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

import type { IProviderRegistryService } from '@termlnk/agent';
import type { IContributionPoint, IExtensionDescription } from '@termlnk/extension';
import type { z } from 'zod';
import { IProviderRegistryService as IProviderRegistryServiceId } from '@termlnk/agent';
import { ILogService, toDisposable } from '@termlnk/core';
import { z as zod } from 'zod';

/**
 * Static, declarative half of the `providers` contribution point.
 *
 * Extensions can list providers in their manifest so the host renders the
 * provider picker (name, icon) before the extension activates. The live
 * SDK-level registration — `getModels`, `createChatCompletion` — always
 * happens programmatically via `ctx.providers.register(definition)` inside
 * `activate()`, because it requires closures that a manifest cannot express.
 */
export interface IContributedProvider {
  id: string;
  name: string;
  icon?: string;
  sdkType?: 'openai' | 'openai-compatible' | 'anthropic' | 'anthropic-messages' | 'google' | 'custom';
}

export const contributedProviderSchema: z.ZodType<IContributedProvider> = zod.object({
  id: zod.string().min(1),
  name: zod.string().min(1),
  icon: zod.string().optional(),
  sdkType: zod.enum(['openai', 'openai-compatible', 'anthropic', 'anthropic-messages', 'google', 'custom']).optional(),
});

export const contributedProvidersSchema = zod.array(contributedProviderSchema);

declare module '@termlnk/extension' {
  interface IExtensionContributesMap {
    providers: IContributedProvider[];
  }
}

/**
 * `providers` contribution point.
 *
 * Extensions declare provider **metadata** in their manifest; this point
 * forwards the metadata into the settings UI so providers show up in the
 * picker even before the extension is activated (at which point the extension
 * will call `ctx.providers.register()` to attach the actual SDK handlers).
 *
 * Note: the registry here does *not* store the live `IProviderDefinition`
 * functions — those arrive at `activate()` time and have a different
 * lifecycle. The contribution point only manages the static metadata half.
 */
export class ProvidersPoint implements IContributionPoint<IContributedProvider[]> {
  readonly name = 'providers';
  readonly schema: z.ZodType<IContributedProvider[]> = contributedProvidersSchema;

  constructor(
    @IProviderRegistryServiceId private readonly _registry: IProviderRegistryService,
    @ILogService private readonly _logService: ILogService
  ) {}

  apply(description: IExtensionDescription, providers: IContributedProvider[]): ReturnType<IContributionPoint<IContributedProvider[]>['apply']> {
    // Register each provider as a **metadata-only** shell. The extension's
    // activate() will later re-register with the full definition, which
    // seamlessly overrides this stub.
    const disposables = providers.map((p) => this._registry.register(description.id, {
      id: p.id,
      name: p.name,
      icon: p.icon,
      sdkType: p.sdkType,
      getModels: async () => [],
      createChatCompletion: async () => {
        this._logService.warn(
          '[ProvidersPoint]',
          `Provider "${p.id}" was invoked before extension ${description.id} activated; returning empty response`
        );
        return { content: '' };
      },
    }));

    return toDisposable(() => {
      for (const d of disposables) {
        d.dispose();
      }
    });
  }
}
