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

import type { IContributionRegistry, IExtensionChangeEvent, IExtensionDescription, IExtensionHostService, IExtensionLifecycleService, IExtensionService, IPermissionService } from '@termlnk/extension';
import type { Observable } from 'rxjs';
import { Disposable, ILogService, Inject, Injector } from '@termlnk/core';
import { ExtensionStatus, IContributionRegistry as IContributionRegistryId, IExtensionHostService as IExtensionHostServiceId, IExtensionLifecycleService as IExtensionLifecycleServiceId, IPermissionService as IPermissionServiceId, parseActivationEvent } from '@termlnk/extension';
import { IExtensionManagementService } from '@termlnk/rpc-client';
import { Subject } from 'rxjs';

export class ExtensionService extends Disposable implements IExtensionService {
  private readonly _onChange$ = new Subject<IExtensionChangeEvent>();
  readonly onChange$: Observable<IExtensionChangeEvent> = this._onChange$.asObservable();

  private readonly _extensions = new Map<string, IExtensionDescription>();
  private _initialized = false;

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @ILogService private readonly _logService: ILogService,
    @IExtensionManagementService private readonly _extensionManagementService: IExtensionManagementService,
    @IExtensionHostServiceId private readonly _hostService: IExtensionHostService,
    @IContributionRegistryId private readonly _contributionRegistry: IContributionRegistry,
    @IExtensionLifecycleServiceId private readonly _lifecycleService: IExtensionLifecycleService,
    @IPermissionServiceId private readonly _permissionService: IPermissionService
  ) {
    super();
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._logService.log('[ExtensionService]', 'Initializing extension system...');

    // 1. Scan installed extensions via backend
    const descriptions = await this._extensionManagementService.scanExtensions();
    this._logService.log('[ExtensionService]', `Found ${descriptions.length} extension(s)`);

    // 2. Scan dev extension paths via backend
    const devPaths = await this._extensionManagementService.getDevPaths();
    for (const devPath of devPaths) {
      try {
        const devDesc = await this._extensionManagementService.scanLocalExtension(devPath);
        if (!descriptions.some((d) => d.id === devDesc.id)) {
          descriptions.push(devDesc);
        }
      } catch (err) {
        this._logService.warn('[ExtensionService]', `Failed to scan dev extension at ${devPath}`, err);
        await this._extensionManagementService.removeDevPath(devPath);
      }
    }

    // 3. Load disabled state from backend
    const disabledIds = await this._extensionManagementService.getDisabledExtensions();
    const disabledSet = new Set(disabledIds);

    for (const desc of descriptions) {
      this._extensions.set(desc.id, desc);
      this._seedPermissions(desc);

      if (disabledSet.has(desc.id)) {
        this._setStatus(desc, ExtensionStatus.Disabled);
        continue;
      }

      this._setStatus(desc, ExtensionStatus.Installed);

      if (desc.manifest.contributes) {
        this._contributionRegistry.registerContributions(desc);
      }
    }

    // 4. Activate extensions with '*' activation event
    await this.activateByEvent('*');
  }

  async activateByEvent(event: string): Promise<void> {
    const toActivate: IExtensionDescription[] = [];

    for (const [, desc] of this._extensions) {
      if (desc.status !== ExtensionStatus.Installed && desc.status !== ExtensionStatus.Deactivated) {
        continue;
      }

      const events = desc.manifest.activationEvents;
      const shouldActivate = events.some((ae) => {
        if (ae === event) {
          return true;
        }

        const parsed = parseActivationEvent(ae);
        if (parsed.type === event) {
          return true;
        }

        if (ae === '*') {
          return event === '*';
        }

        return false;
      });

      if (shouldActivate) {
        toActivate.push(desc);
      }
    }

    for (const desc of toActivate) {
      await this._activateExtension(desc);
    }
  }

  getExtensions(): IExtensionDescription[] {
    return [...this._extensions.values()];
  }

  getExtension(extensionId: string): IExtensionDescription | undefined {
    return this._extensions.get(extensionId);
  }

  async enableExtension(extensionId: string): Promise<void> {
    const desc = this._extensions.get(extensionId);
    if (!desc) {
      return;
    }

    await this._extensionManagementService.enable(extensionId);

    if (desc.manifest.contributes) {
      this._contributionRegistry.registerContributions(desc);
    }

    this._setStatus(desc, ExtensionStatus.Installed);
    this._onChange$.next({ extensionId, kind: 'enabled' });
  }

  async disableExtension(extensionId: string): Promise<void> {
    const desc = this._extensions.get(extensionId);
    if (!desc) {
      return;
    }

    await this._deactivateIfActive(desc);
    this._contributionRegistry.unregisterContributions(extensionId);

    await this._extensionManagementService.disable(extensionId);
    this._setStatus(desc, ExtensionStatus.Disabled);
    this._onChange$.next({ extensionId, kind: 'disabled' });
  }

  async uninstallExtension(extensionId: string): Promise<void> {
    const desc = this._extensions.get(extensionId);
    if (!desc) {
      return;
    }

    await this._deactivateIfActive(desc);
    this._contributionRegistry.unregisterContributions(extensionId);

    if (!desc.isDev) {
      try {
        await this._extensionManagementService.removeExtension(extensionId);
      } catch (err) {
        this._logService.error('[ExtensionService]', `Failed to remove extension files for ${extensionId}`, err);
      }
    }

    this._extensions.delete(extensionId);
    this._permissionService.clear(extensionId);
    this._lifecycleService.remove(extensionId);
    this._onChange$.next({ extensionId, kind: 'uninstalled' });
  }

  async loadLocalExtension(path: string): Promise<void> {
    this._logService.log('[ExtensionService]', `Loading local extension from: ${path}`);

    const desc = await this._extensionManagementService.scanLocalExtension(path);

    const existing = this._extensions.get(desc.id);
    if (existing) {
      await this._deactivateIfActive(existing);
      this._contributionRegistry.unregisterContributions(desc.id);
    }

    this._extensions.set(desc.id, desc);
    this._seedPermissions(desc);
    await this._extensionManagementService.addDevPath(path);
    await this._extensionManagementService.enable(desc.id);

    this._setStatus(desc, ExtensionStatus.Installed);

    if (desc.manifest.contributes) {
      this._contributionRegistry.registerContributions(desc);
    }

    await this._activateExtension(desc);
    this._onChange$.next({ extensionId: desc.id, kind: 'installed' });
  }

  async installRemoteExtension(input: { extensionId: string; npmPackage: string; version: string }): Promise<void> {
    const { extensionId, npmPackage, version } = input;
    this._logService.log('[ExtensionService]', `Installing remote extension ${extensionId} from ${npmPackage}@${version}`);

    await this._extensionManagementService.npmInstall(npmPackage, version, extensionId);

    const installed = await this._extensionManagementService.scanExtensions();
    const desc = installed.find((d) => d.id === extensionId);
    if (!desc) {
      throw new Error(`Installed extension not found after rescan: ${extensionId}`);
    }

    const existing = this._extensions.get(desc.id);
    if (existing) {
      await this._deactivateIfActive(existing);
      this._contributionRegistry.unregisterContributions(desc.id);
    }

    this._extensions.set(desc.id, desc);
    this._seedPermissions(desc);
    this._setStatus(desc, ExtensionStatus.Installed);

    if (desc.manifest.contributes) {
      this._contributionRegistry.registerContributions(desc);
    }

    await this._activateExtension(desc);
    this._onChange$.next({ extensionId: desc.id, kind: 'installed' });
  }

  async removeLocalExtension(extensionId: string): Promise<void> {
    const desc = this._extensions.get(extensionId);
    if (!desc || !desc.isDev) {
      return;
    }

    await this._deactivateIfActive(desc);
    this._contributionRegistry.unregisterContributions(extensionId);
    await this._extensionManagementService.removeDevPath(desc.extensionPath);
    this._extensions.delete(extensionId);
    this._permissionService.clear(extensionId);
    this._lifecycleService.remove(extensionId);
    this._onChange$.next({ extensionId, kind: 'uninstalled' });
  }

  async reloadExtension(extensionId: string): Promise<void> {
    const desc = this._extensions.get(extensionId);
    if (!desc) {
      return;
    }

    this._logService.log('[ExtensionService]', `Reloading extension: ${extensionId}`);

    await this._deactivateIfActive(desc);
    this._contributionRegistry.unregisterContributions(extensionId);

    try {
      const newDesc = desc.isDev
        ? await this._extensionManagementService.scanLocalExtension(desc.extensionPath)
        : (await this._extensionManagementService.scanExtensions()).find((d) => d.id === extensionId);

      if (!newDesc) {
        this._setStatus(desc, ExtensionStatus.Error, 'Extension not found after re-scan');
        this._onChange$.next({ extensionId, kind: 'deactivated' });
        return;
      }

      this._extensions.set(extensionId, newDesc);
      this._seedPermissions(newDesc);
      this._setStatus(newDesc, ExtensionStatus.Installed);

      if (newDesc.manifest.contributes) {
        this._contributionRegistry.registerContributions(newDesc);
      }

      await this._activateExtension(newDesc);
      this._onChange$.next({ extensionId, kind: 'activated' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._setStatus(desc, ExtensionStatus.Error, message);
      this._logService.error('[ExtensionService]', `Failed to reload extension ${extensionId}`, err);
    }
  }

  override dispose(): void {
    this._onChange$.complete();
    this._extensions.clear();
    super.dispose();
  }

  private async _activateExtension(desc: IExtensionDescription): Promise<void> {
    this._setStatus(desc, ExtensionStatus.Activating);
    try {
      await this._hostService.activateExtension(desc);
      this._setStatus(desc, ExtensionStatus.Activated);
      this._onChange$.next({ extensionId: desc.id, kind: 'activated' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._setStatus(desc, ExtensionStatus.Error, message);
      this._logService.error(
        '[ExtensionService]',
        `Failed to activate extension ${desc.id}`,
        err
      );
    }
  }

  private async _deactivateIfActive(desc: IExtensionDescription): Promise<void> {
    if (desc.status !== ExtensionStatus.Activated && desc.status !== ExtensionStatus.Activating) {
      return;
    }

    this._setStatus(desc, ExtensionStatus.Deactivating);
    try {
      await this._hostService.deactivateExtension(desc.id);
      this._setStatus(desc, ExtensionStatus.Deactivated);
      this._onChange$.next({ extensionId: desc.id, kind: 'deactivated' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._setStatus(desc, ExtensionStatus.Error, message);
      this._logService.error(
        '[ExtensionService]',
        `Failed to deactivate extension ${desc.id}`,
        err
      );
    }
  }

  private _setStatus(desc: IExtensionDescription, status: ExtensionStatus, error?: string): void {
    desc.status = status;
    desc.error = error;
    this._lifecycleService.setStatus(desc.id, status, error);
  }

  private _seedPermissions(desc: IExtensionDescription): void {
    const permissions = desc.manifest.permissions ?? [];
    this._permissionService.clear(desc.id);
    if (permissions.length > 0) {
      this._permissionService.declare(desc.id, permissions);
    }
  }
}
