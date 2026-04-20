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

import type { IDisposable } from '@termlnk/core';
import type { z } from 'zod';
import type { IExtensionDescription } from '../models/extension-description';
import { createIdentifier } from '@termlnk/core';

/**
 * A higher-level contribution abstraction that bundles the manifest schema
 * with the host-side logic that applies each entry.
 *
 * `apply()` is invoked once per contributing extension; the returned
 * disposable rolls back that extension's contribution specifically. This
 * makes the entire pipeline tolerant of dynamic activation/deactivation:
 * the host never needs to hunt for "which pieces belonged to which
 * extension" — each contributor owns its own handle.
 *
 * Compared to the lower-level `IExtensionPoint` (pub/sub of deltas), this
 * interface is what **adapters** and business packages should implement when
 * they want to offer a new manifest key like `providers`, `componentParts`,
 * or `tools`.
 */
export interface IContributionPoint<T = unknown> {
  /** Manifest key under `contributes` (e.g. `'commands'`, `'providers'`) */
  readonly name: string;

  /** Zod schema used to validate the raw manifest slice */
  readonly schema: z.ZodType<T>;

  /**
   * Apply a validated contribution to the host.
   *
   * @param description — the full extension description (for logging / path resolution / error attribution)
   * @param value — the validated value from `manifest.contributes[name]`
   * @returns a disposable that rolls back **this** extension's contribution
   */
  apply(description: IExtensionDescription, value: T): IDisposable;
}

/**
 * Registry of contribution points.
 *
 * Any package that owns a host service (themes, status bar, providers…) can
 * register its own point here, and the extension system will route matching
 * manifest slices to it automatically. Late-arriving points trigger a
 * retroactive replay against already-registered extension contributions so
 * the registration order of business plugins does not matter.
 */
export interface IContributionPointRegistry {
  /**
   * Register a contribution point. Throws if `point.name` is already
   * registered — use one name per point. The returned disposable removes the
   * point and disposes every per-extension binding created through it.
   */
  register<T>(point: IContributionPoint<T>): IDisposable;

  /** Look up a point by its manifest key. */
  getPoint(name: string): IContributionPoint<unknown> | undefined;

  /** Enumerate all currently-registered point names. */
  listNames(): readonly string[];
}

export const IContributionPointRegistry = createIdentifier<IContributionPointRegistry>('extension.contribution-point-registry');
