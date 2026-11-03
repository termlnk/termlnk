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
import type {
  IACPProviderCapabilities,
  IACPProviderDescriptor,
  IACPProviderStatus,
} from '../models/acp-provider';
import { createIdentifier } from '@termlnk/core';

export interface IACPDiscoveryService {
  /** All known providers with their current availability. */
  readonly providers$: Observable<IACPProviderStatus[]>;
  /** Only enabled, installed / on-demand providers, ordered for menu display. */
  readonly launchableProviders$: Observable<IACPProviderStatus[]>;

  /** Synchronous snapshot of `providers$`. */
  get providers(): IACPProviderStatus[];
  /** Synchronous snapshot of `launchableProviders$`. */
  get launchableProviders(): IACPProviderStatus[];

  refresh(): Promise<void>;
  addUserProvider(descriptor: Omit<IACPProviderDescriptor, 'source'>): Promise<void>;
  removeUserProvider(id: string): Promise<void>;
  getProvider(id: string): IACPProviderStatus | undefined;

  setProviderEnabled(id: string, enabled: boolean): Promise<void>;
  /**
   * Spawns the agent, reads what it advertises, then shuts it down. Cached; pass
   * `force` to re-probe.
   */
  probeCapabilities(id: string, force?: boolean): Promise<IACPProviderCapabilities>;
  /** Records a model id the agent did not advertise but the user wants anyway. */
  addCustomModel(providerId: string, modelId: string): Promise<void>;
  removeCustomModel(providerId: string, modelId: string): Promise<void>;
}

export const IACPDiscoveryService = createIdentifier<IACPDiscoveryService>(
  'acp.acp-discovery-service'
);
