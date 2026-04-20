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

import type { IActivatedExtension, IExtensionDescription } from '../models/extension-description';
import { createIdentifier } from '@termlnk/core';

/**
 * Responsible for loading extension code and managing activation/deactivation.
 */
export interface IExtensionHostService {
  /**
   * Activate an extension by loading its module and calling activate().
   */
  activateExtension(desc: IExtensionDescription): Promise<IActivatedExtension>;

  /**
   * Deactivate an extension by calling deactivate() and disposing context.
   */
  deactivateExtension(extensionId: string): Promise<void>;

  /**
   * Get an activated extension by ID.
   */
  getActivatedExtension(extensionId: string): IActivatedExtension | undefined;

  /**
   * Get all activated extensions.
   */
  getAllActivated(): IActivatedExtension[];
}

export const IExtensionHostService = createIdentifier<IExtensionHostService>('extension.host-service');
