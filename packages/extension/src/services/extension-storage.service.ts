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

import type { IExtensionDescription } from '../models/extension-description';
import { createIdentifier } from '@termlnk/core';

/**
 * Manages local extension file storage: scanning installed extensions, reading
 * manifests, and resolving absolute paths for files inside an extension.
 */
export interface IExtensionStorageService {
  /**
   * Scan the extensions directory and return all discovered extension descriptions.
   */
  scanExtensions(): Promise<IExtensionDescription[]>;

  /**
   * Scan a single local extension directory and return its description with isDev: true.
   */
  scanLocalExtension(absolutePath: string): Promise<IExtensionDescription>;

  /**
   * Read a file from an installed or dev extension directory.
   */
  readExtensionFile(extensionId: string, filePath: string): string;

  /**
   * Resolve the absolute filesystem path for a file inside an extension. The
   * lookup walks the installed extensions directory first, then any registered
   * dev paths. Returns `null` when the extension is unknown or the relative
   * path escapes the extension root.
   */
  resolveExtensionFilePath(extensionId: string, filePath: string): string | null;
}

export const IExtensionStorageService = createIdentifier<IExtensionStorageService>('extension.storage-service');
