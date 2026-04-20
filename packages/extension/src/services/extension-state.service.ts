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

import { createIdentifier } from '@termlnk/core';

/**
 * Manages enabled/disabled state for extensions.
 */
export interface IExtensionStateService {
  /**
   * Check if an extension is enabled.
   */
  isEnabled(extensionId: string): boolean;

  /**
   * Enable an extension.
   */
  enable(extensionId: string): void;

  /**
   * Disable an extension.
   */
  disable(extensionId: string): void;

  /**
   * Get all disabled extension IDs.
   */
  getDisabledExtensions(): string[];

  /**
   * Get all dev extension paths.
   */
  getDevExtensionPaths(): string[];

  /**
   * Add a dev extension path.
   */
  addDevExtensionPath(path: string): void;

  /**
   * Remove a dev extension path.
   */
  removeDevExtensionPath(path: string): void;

  /**
   * Load state from storage.
   */
  load(): Promise<void>;

  /**
   * Persist state to storage.
   */
  save(): Promise<void>;
}

export const IExtensionStateService = createIdentifier<IExtensionStateService>('extension.state-service');
