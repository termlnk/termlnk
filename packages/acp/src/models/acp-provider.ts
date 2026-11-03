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

/** A launchable ACP agent, either from the built-in catalog or user-defined. */
export interface IACPProviderDescriptor {
  id: string;
  title: string;
  description: string;
  /** argv; the first element is probed against PATH. */
  command: readonly [string, ...string[]];
  env?: Readonly<Record<string, string>>;
  installLink?: string;
  /**
   * Version the command pins, for display only. Absent when the command runs
   * whatever is installed rather than a pinned package.
   */
  version?: string;
  /** Key into the provider icon set; falls back to a letter avatar. */
  iconId?: string;
  /** User-defined providers are editable and removable in settings. */
  source: 'catalog' | 'user';
}

export type ACPProviderAvailability =
  /** Binary resolved on PATH — ready to launch. */
  | { state: 'installed'; resolvedPath: string; version?: string }
  /** Launcher present (npx/bunx) but the package downloads on first run. */
  | { state: 'on-demand' }
  /** Binary not found. */
  | { state: 'missing' };

export interface IACPProviderStatus {
  descriptor: IACPProviderDescriptor;
  availability: ACPProviderAvailability;
  /**
   * Disabled providers stay configured but drop out of the launch menu. Being on
   * PATH is not consent to appear in it.
   */
  enabled: boolean;
  /** Last successful capability probe, if one has run. */
  capabilities?: IACPProviderCapabilities;
}

/**
 * What an agent reported during a throwaway probe session. Cached because
 * probing spawns the agent, and settings should not respawn it on every render.
 */
export interface IACPProviderCapabilities {
  models: IACPProviderModel[];
  modes: IACPProviderMode[];
  /** Epoch millis of the probe that produced this. */
  probedAt: number;
}

export interface IACPProviderModel {
  id: string;
  name: string;
  /** User-added ids that the agent did not advertise. */
  custom?: boolean;
}

export interface IACPProviderMode {
  id: string;
  name: string;
}
