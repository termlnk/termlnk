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
 * Metadata from the extension registry.
 */
export interface IRegistryExtensionMetadata {
  id: string;
  displayName: string;
  description: string;
  publisher: { name: string };
  npmPackage: string;
  repository?: string;
  license?: string;
  categories: string[];
  keywords: string[];
  icon?: string;
  latestVersion: string;
  stats: { installs: number; rating: number };
}

/**
 * Version info from the extension registry.
 */
export interface IRegistryVersionInfo {
  version: string;
  npmPackage: string;
  engines: { termlnk: string };
  extensionDependencies: string[];
  publishedAt: string;
  changelog?: string;
}

/**
 * Client for the remote extension registry (GitHub-based).
 */
export interface IExtensionRegistryService {
  /**
   * Search extensions by query.
   */
  search(query: string, options?: { category?: string; limit?: number }): Promise<IRegistryExtensionMetadata[]>;

  /**
   * Get metadata for a specific extension.
   */
  getExtensionMetadata(extensionId: string): Promise<IRegistryExtensionMetadata | undefined>;

  /**
   * Get the latest version compatible with the current termlnk version.
   */
  getLatestCompatibleVersion(extensionId: string): Promise<IRegistryVersionInfo | undefined>;

  /**
   * Get featured/recommended extensions.
   */
  getFeatured(): Promise<IRegistryExtensionMetadata[]>;
}

export const IExtensionRegistryService = createIdentifier<IExtensionRegistryService>('extension.registry-service');
