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

import type { IActivatedExtension, IExtensionDescription, IExtensionHostService, IPluginActivation } from '@termlnk/extension';
import { Disposable, ILogService, Inject, Injector } from '@termlnk/core';
import { ExtensionActivationError } from '@termlnk/extension';
import { createExtensionLogger, InMemoryMemento, PluginContext, StubSecretStorage } from '../api/plugin-context';
import { resolveExtensionModuleUrl } from '../common/extension-module-url';

interface IActivatedRecord extends IActivatedExtension {
  readonly pluginActivation?: IPluginActivation;
}

export class ExtensionHostService extends Disposable implements IExtensionHostService {
  private readonly _activated = new Map<string, IActivatedRecord>();
  private readonly _contexts = new Map<string, PluginContext>();

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async activateExtension(desc: IExtensionDescription): Promise<IActivatedExtension> {
    if (this._activated.has(desc.id)) {
      return this._activated.get(desc.id)!;
    }

    this._logService.debug('[ExtensionHostService]', `Activating extension: ${desc.id}`);

    let extensionModule: any;
    try {
      const mainPath = this._resolveMainPath(desc);
      extensionModule = await import(/* @vite-ignore */ mainPath);
    } catch (err) {
      throw new ExtensionActivationError(
        desc.id,
        `Failed to load extension module from "${desc.manifest.main}"`,
        err
      );
    }

    if (typeof extensionModule.activate !== 'function') {
      throw new ExtensionActivationError(
        desc.id,
        'Extension module does not export an activate() function'
      );
    }

    const context = this._createPluginContext(desc);
    this._contexts.set(desc.id, context);

    let activation: IPluginActivation | void;
    try {
      activation = await extensionModule.activate(context);
    } catch (err) {
      context.dispose();
      this._contexts.delete(desc.id);
      throw new ExtensionActivationError(
        desc.id,
        'activate() threw an error',
        err
      );
    }

    const record: IActivatedRecord = {
      id: desc.id,
      exports: activation ?? {},
      context,
      module: extensionModule,
      pluginActivation: activation ?? undefined,
    };

    this._activated.set(desc.id, record);

    // Status transitions are owned by `ExtensionService` which holds the
    // authoritative lifecycle model; the host service only loads/unloads
    // modules and leaves state propagation to its caller.

    this._logService.log('[ExtensionHostService]', `Extension activated: ${desc.id}`);
    return record;
  }

  async deactivateExtension(extensionId: string): Promise<void> {
    const activated = this._activated.get(extensionId);
    if (!activated) {
      return;
    }

    this._logService.debug('[ExtensionHostService]', `Deactivating extension: ${extensionId}`);

    // Prefer the activation handle returned from activate() over a legacy
    // module.deactivate — Alma-style extensions return a `{ dispose }` object.
    if (activated.pluginActivation?.dispose) {
      try {
        await activated.pluginActivation.dispose();
      } catch (err) {
        this._logService.error(
          '[ExtensionHostService]',
          `Error during activation.dispose() of ${extensionId}`,
          err
        );
      }
    } else if (typeof activated.module.deactivate === 'function') {
      try {
        await activated.module.deactivate();
      } catch (err) {
        this._logService.error(
          '[ExtensionHostService]',
          `Error during deactivate() of ${extensionId}`,
          err
        );
      }
    }

    const context = this._contexts.get(extensionId);
    if (context) {
      context.dispose();
      this._contexts.delete(extensionId);
    }

    this._activated.delete(extensionId);
    this._logService.log('[ExtensionHostService]', `Extension deactivated: ${extensionId}`);
  }

  getActivatedExtension(extensionId: string): IActivatedExtension | undefined {
    return this._activated.get(extensionId);
  }

  getAllActivated(): IActivatedExtension[] {
    return [...this._activated.values()];
  }

  override dispose(): void {
    for (const [id] of this._activated) {
      void this.deactivateExtension(id);
    }
    super.dispose();
  }

  private _resolveMainPath(desc: IExtensionDescription): string {
    return resolveExtensionModuleUrl(desc.id, desc.manifest.main);
  }

  private _createPluginContext(desc: IExtensionDescription): PluginContext {
    const logger = createExtensionLogger(desc.id, this._logService);
    return new PluginContext({
      extensionId: desc.id,
      extensionPath: desc.extensionPath,
      storagePath: `${desc.extensionPath}/.storage`,
      injector: this._injector,
      logger,
      globalState: new InMemoryMemento(),
      secrets: new StubSecretStorage(),
    });
  }
}
