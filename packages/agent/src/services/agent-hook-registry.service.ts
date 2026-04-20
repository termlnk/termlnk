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

import type { Observable } from 'rxjs';
import type { ExternalAgentType } from '../models/agent-hook';
import type { IAgentHookAdapter } from './agent-hook-adapter.service';
import { createIdentifier } from '@termlnk/core';

/**
 * Registry that manages all agent hook adapters.
 *
 * Provides install/uninstall orchestration across all registered adapters
 * and exposes the adapter collection as an observable stream.
 */
export interface IAgentHookRegistryService {
  /** All registered adapters */
  readonly adapters$: Observable<IAgentHookAdapter[]>;

  /** Register an adapter */
  registerAdapter(adapter: IAgentHookAdapter): void;

  /** Get adapter for a specific agent type */
  getAdapter(agentType: ExternalAgentType): IAgentHookAdapter | undefined;

  /** Get all registered adapters */
  getAdapters(): IAgentHookAdapter[];

  /** Install hooks for all enabled, available agents */
  installAll(port: number, token: string): Promise<void>;

  /** Uninstall hooks for all agents */
  uninstallAll(): Promise<void>;

  /** Check which agents are available on this system */
  getAvailableAgents(): Promise<ExternalAgentType[]>;
}

export const IAgentHookRegistryService = createIdentifier<IAgentHookRegistryService>(
  'agent.agent-hook-registry-service'
);
