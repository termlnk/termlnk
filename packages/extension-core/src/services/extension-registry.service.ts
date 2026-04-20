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

import type { IExtensionRegistryService, IRegistryExtensionMetadata, IRegistryVersionInfo } from '@termlnk/extension';
import { Disposable, ILogService } from '@termlnk/core';

const DEFAULT_REGISTRY_BASE_URL = 'https://raw.githubusercontent.com/termlnk/termlnk-extensions/main';
const REGISTRY_CACHE_TTL_MS = 5 * 60 * 1000;

interface IRegistryEntry {
  id: string;
  path?: string;
  displayName: string;
  description: string;
  version: string;
  author?: string | { name: string; email?: string; url?: string };
  publisher: { name: string };
  npmPackage: string;
  repository?: string;
  license?: string;
  categories?: string[];
  keywords?: string[];
  engines?: { termlnk: string };
  featured?: boolean;
  stats?: { installs: number; rating: number };
}

interface IRegistryFile {
  version: string;
  lastUpdated?: string;
  extensions: IRegistryEntry[];
}

export class ExtensionRegistryService extends Disposable implements IExtensionRegistryService {
  private _baseUrl = DEFAULT_REGISTRY_BASE_URL;
  private _cache: { data: IRegistryFile; expiresAt: number } | null = null;

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async search(query: string, options?: { category?: string; limit?: number }): Promise<IRegistryExtensionMetadata[]> {
    const registry = await this._fetchRegistry();
    const q = query.trim().toLowerCase();
    const category = options?.category;
    const limit = options?.limit ?? 50;

    const filtered = registry.extensions.filter((entry) => {
      if (category && !entry.categories?.includes(category)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        entry.id.toLowerCase().includes(q)
        || entry.displayName.toLowerCase().includes(q)
        || entry.description.toLowerCase().includes(q)
        || (entry.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false)
      );
    });

    return filtered.slice(0, limit).map((entry) => this._toMetadata(entry));
  }

  async getExtensionMetadata(extensionId: string): Promise<IRegistryExtensionMetadata | undefined> {
    const registry = await this._fetchRegistry();
    const entry = registry.extensions.find((e) => e.id === extensionId);
    return entry ? this._toMetadata(entry) : undefined;
  }

  async getLatestCompatibleVersion(extensionId: string): Promise<IRegistryVersionInfo | undefined> {
    const registry = await this._fetchRegistry();
    const entry = registry.extensions.find((e) => e.id === extensionId);
    if (!entry) {
      return undefined;
    }
    return {
      version: entry.version,
      npmPackage: entry.npmPackage,
      engines: entry.engines ?? { termlnk: '*' },
      extensionDependencies: [],
      publishedAt: registry.lastUpdated ?? '',
    };
  }

  async getFeatured(): Promise<IRegistryExtensionMetadata[]> {
    const registry = await this._fetchRegistry();
    return registry.extensions
      .filter((entry) => entry.featured === true)
      .map((entry) => this._toMetadata(entry));
  }

  private _toMetadata(entry: IRegistryEntry): IRegistryExtensionMetadata {
    return {
      id: entry.id,
      displayName: entry.displayName,
      description: entry.description,
      publisher: entry.publisher,
      npmPackage: entry.npmPackage,
      repository: entry.repository,
      license: entry.license,
      categories: entry.categories ?? [],
      keywords: entry.keywords ?? [],
      latestVersion: entry.version,
      stats: entry.stats ?? { installs: 0, rating: 0 },
    };
  }

  private async _fetchRegistry(): Promise<IRegistryFile> {
    const now = Date.now();
    if (this._cache && this._cache.expiresAt > now) {
      return this._cache.data;
    }

    const url = `${this._baseUrl}/registry.json`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this._logService.warn('[ExtensionRegistryService]', `Registry fetch failed: ${response.status} ${response.statusText}`);
        return this._cache?.data ?? { version: '0', extensions: [] };
      }
      const data = await response.json() as IRegistryFile;
      if (!Array.isArray(data.extensions)) {
        this._logService.warn('[ExtensionRegistryService]', 'Registry payload missing "extensions" array');
        return { version: '0', extensions: [] };
      }
      this._cache = { data, expiresAt: now + REGISTRY_CACHE_TTL_MS };
      return data;
    } catch (err) {
      this._logService.warn('[ExtensionRegistryService]', 'Failed to fetch registry', err);
      return this._cache?.data ?? { version: '0', extensions: [] };
    }
  }
}
