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
import type { IExtensionDescription } from '../models/extension-description';
import { createIdentifier } from '@termlnk/core';

export interface IExtensionChangeEvent {
  extensionId: string;
  kind: 'installed' | 'activated' | 'deactivated' | 'uninstalled' | 'enabled' | 'disabled';
}

/**
 * Main orchestrator for the extension system.
 */
export interface IExtensionService {
  /**
   * Initialize the extension system: scan, register contributions, and activate '*' extensions.
   */
  initialize(): Promise<void>;

  /**
   * Activate extensions matching a specific activation event.
   */
  activateByEvent(event: string): Promise<void>;

  /**
   * Get all known extension descriptions.
   */
  getExtensions(): IExtensionDescription[];

  /**
   * Get a specific extension description by ID.
   */
  getExtension(extensionId: string): IExtensionDescription | undefined;

  /**
   * Enable an extension.
   */
  enableExtension(extensionId: string): Promise<void>;

  /**
   * Disable an extension.
   */
  disableExtension(extensionId: string): Promise<void>;

  /**
   * Uninstall an extension.
   */
  uninstallExtension(extensionId: string): Promise<void>;

  /**
   * Load a local development extension from an absolute path.
   */
  loadLocalExtension(path: string): Promise<void>;

  /**
   * Install a remote extension from the npm registry. Downloads the package to
   * the config directory, rescans, registers contributions, and activates.
   */
  installRemoteExtension(input: { extensionId: string; npmPackage: string; version: string }): Promise<void>;

  /**
   * Remove a local development extension (does not delete files).
   */
  removeLocalExtension(extensionId: string): Promise<void>;

  /**
   * Reload an extension (deactivate → re-scan → re-activate).
   */
  reloadExtension(extensionId: string): Promise<void>;

  /**
   * Observable of extension changes.
   */
  readonly onChange$: Observable<IExtensionChangeEvent>;
}

export const IExtensionService = createIdentifier<IExtensionService>('extension.service');
