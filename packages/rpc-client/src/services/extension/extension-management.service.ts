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

import type { IExtensionDescription, IRegistryExtensionMetadata } from '@termlnk/extension';
import { createIdentifier, Disposable } from '@termlnk/core';
import { IRPCClientService } from '../rpc-client.service';

export interface IExtensionClientService {
  scanExtensions(): Promise<IExtensionDescription[]>;
  scanLocalExtension(absolutePath: string): Promise<IExtensionDescription>;
  readExtensionFile(extensionId: string, filePath: string): Promise<string>;
  npmInstall(packageName: string, version: string, extensionId: string): Promise<{ path: string }>;
  removeExtension(extensionId: string): Promise<void>;
  showOpenDirectoryDialog(title?: string): Promise<{ canceled: boolean; path: string | null }>;
  isEnabled(extensionId: string): Promise<boolean>;
  enable(extensionId: string): Promise<void>;
  disable(extensionId: string): Promise<void>;
  getDisabledExtensions(): Promise<string[]>;
  getDevPaths(): Promise<string[]>;
  addDevPath(path: string): Promise<void>;
  removeDevPath(path: string): Promise<void>;
  searchRegistry(query: string, options?: { category?: string; limit?: number }): Promise<IRegistryExtensionMetadata[]>;
  getRegistryMetadata(extensionId: string): Promise<IRegistryExtensionMetadata | undefined>;
  getRegistryFeatured(): Promise<IRegistryExtensionMetadata[]>;
}

export const IExtensionClientService = createIdentifier<IExtensionClientService>('rpc-client.extension-client-service');

export class ExtensionClientService extends Disposable implements IExtensionClientService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().extension;
  }

  async scanExtensions(): Promise<IExtensionDescription[]> {
    return this._client.scanExtensions.query() as Promise<IExtensionDescription[]>;
  }

  async scanLocalExtension(absolutePath: string): Promise<IExtensionDescription> {
    return this._client.scanLocalExtension.query(absolutePath) as Promise<IExtensionDescription>;
  }

  async readExtensionFile(extensionId: string, filePath: string): Promise<string> {
    return this._client.readExtensionFile.query({ extensionId, filePath });
  }

  async npmInstall(packageName: string, version: string, extensionId: string): Promise<{ path: string }> {
    const result = await this._client.npmInstall.mutate({ packageName, version, extensionId });
    return { path: result.path };
  }

  async removeExtension(extensionId: string): Promise<void> {
    await this._client.removeExtension.mutate(extensionId);
  }

  async showOpenDirectoryDialog(title?: string): Promise<{ canceled: boolean; path: string | null }> {
    return this._client.showOpenDirectoryDialog.mutate(title ? { title } : undefined);
  }

  async isEnabled(extensionId: string): Promise<boolean> {
    return this._client.isEnabled.query(extensionId);
  }

  async enable(extensionId: string): Promise<void> {
    await this._client.enable.mutate(extensionId);
  }

  async disable(extensionId: string): Promise<void> {
    await this._client.disable.mutate(extensionId);
  }

  async getDisabledExtensions(): Promise<string[]> {
    return this._client.getDisabledExtensions.query();
  }

  async getDevPaths(): Promise<string[]> {
    return this._client.getDevPaths.query();
  }

  async addDevPath(path: string): Promise<void> {
    await this._client.addDevPath.mutate(path);
  }

  async removeDevPath(path: string): Promise<void> {
    await this._client.removeDevPath.mutate(path);
  }

  async searchRegistry(query: string, options?: { category?: string; limit?: number }): Promise<IRegistryExtensionMetadata[]> {
    return this._client.searchRegistry.query({ query, ...options }) as Promise<IRegistryExtensionMetadata[]>;
  }

  async getRegistryMetadata(extensionId: string): Promise<IRegistryExtensionMetadata | undefined> {
    return this._client.getRegistryMetadata.query(extensionId) as Promise<IRegistryExtensionMetadata | undefined>;
  }

  async getRegistryFeatured(): Promise<IRegistryExtensionMetadata[]> {
    return this._client.getRegistryFeatured.query() as Promise<IRegistryExtensionMetadata[]>;
  }
}
