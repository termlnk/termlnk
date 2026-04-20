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

import type { IDisposable, Injector } from '@termlnk/core';
import type {
  ExtensionPermission,
  IComponentRegistration,
  IConfirmDialogOptions,
  IExtensionContext,
  IExtensionLogger,
  IExtensionMemento,
  IInputBoxOptions,
  IPermissionService,
  IPluginCommandsAPI,
  IPluginEventsAPI,
  IPluginProviderDefinition,
  IPluginProvidersAPI,
  IPluginSettingsAPI,
  IPluginToolsAPI,
  IPluginUIAPI,
  IPluginWorkspaceAPI,
  IProgress,
  IProgressOptions,
  IQuickPickItem,
  IQuickPickOptions,
  ISecretStorage,
  IShowMessageOptions,
  IStatusBarItemHandle,
  IStatusBarItemOptions,
  IToolDefinition,
  MessageType,
  PermissionManifest,
} from '@termlnk/extension';
import { IProviderRegistryService } from '@termlnk/agent';
import { ICommandService, IConfigService, ILogService, INotificationService, toDisposable } from '@termlnk/core';
import { createGatedAPI, ExtensionDisposableScope, IPermissionService as IPermissionServiceId } from '@termlnk/extension';
import { IStatusBarService, IUIPartsService } from '@termlnk/ui';
import { IHookService } from '../services/hook.service';
import { IToolRegistryService } from '../services/tool-registry.service';

export interface IPluginContextOptions {
  extensionId: string;
  extensionPath: string;
  storagePath: string;
  injector: Injector;
  logger: IExtensionLogger;
  globalState: IExtensionMemento;
  secrets: ISecretStorage;
}

/**
 * The plugin-facing context object. All APIs available to an extension hang
 * off `context` — there is no free-standing `termlnk.xxx` namespace.
 *
 * Every API slice is a thin adapter onto an existing host service; the
 * adapter adds extension-id scoping, logger prefixing, and automatic
 * disposable tracking. Every disposable returned from any API slice is
 * registered into the extension's `ExtensionDisposableScope`, so deactivation
 * reliably rolls back **all** host-side side-effects even if the extension
 * author forgot to track them manually.
 *
 * The legacy `subscriptions` array is preserved for Alma-style extensions
 * that prefer explicit push-based cleanup; disposables placed there are
 * cascaded through the scope on `dispose()` as well.
 */
export class PluginContext implements IExtensionContext {
  readonly subscriptions: IDisposable[] = [];
  readonly extensionId: string;
  readonly extensionPath: string;
  readonly logger: IExtensionLogger;
  readonly globalState: IExtensionMemento;
  readonly secrets: ISecretStorage;

  readonly commands: IPluginCommandsAPI;
  readonly ui: IPluginUIAPI;
  readonly events: IPluginEventsAPI;
  readonly tools: IPluginToolsAPI;
  readonly providers: IPluginProvidersAPI;
  readonly settings: IPluginSettingsAPI;
  readonly workspace: IPluginWorkspaceAPI;

  private readonly _injector: Injector;
  private readonly _storagePath: string;
  private readonly _scope: ExtensionDisposableScope;
  private readonly _permissionService: IPermissionService;
  private _disposed = false;

  constructor(options: IPluginContextOptions) {
    this.extensionId = options.extensionId;
    this.extensionPath = options.extensionPath;
    this._storagePath = options.storagePath;
    this._injector = options.injector;
    this.logger = options.logger;
    this.globalState = options.globalState;
    this.secrets = options.secrets;
    this._scope = new ExtensionDisposableScope(this.extensionId);
    this._permissionService = options.injector.get(IPermissionServiceId);

    this.commands = this._gate(this._createCommandsAPI(), {
      register: 'commands',
      execute: 'commands',
    });
    this.ui = this._gate(this._createUIAPI(), {
      showNotification: 'notifications',
      showQuickPick: 'ui:dialogs',
      showInputBox: 'ui:dialogs',
      showConfirmDialog: 'ui:dialogs',
      withProgress: 'ui:notifications',
      createStatusBarItem: 'ui:statusBar',
      registerComponent: 'ui:components' as ExtensionPermission,
    });
    this.events = this._createEventsAPI();
    this.tools = this._gate(this._createToolsAPI(), {
      register: 'tools:register',
    });
    this.providers = this._gate(this._createProvidersAPI(), {
      register: 'providers:manage',
    });
    this.settings = this._createSettingsAPI();
    this.workspace = this._createWorkspaceAPI();
  }

  private _gate<T extends object>(
    raw: T,
    manifest: PermissionManifest<T>
  ): T {
    return createGatedAPI(raw, manifest, this._permissionService, this.extensionId);
  }

  /**
   * Expose the scope so the host (ExtensionHostService) can force-dispose
   * in the rare case the extension's `dispose()` hangs or throws.
   */
  get scope(): ExtensionDisposableScope {
    return this._scope;
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;

    // Drain the legacy subscriptions array first so extension-authored
    // resources (not returned from context APIs) also get cleaned up.
    for (const sub of this.subscriptions.splice(0)) {
      try {
        sub.dispose();
      } catch {
        // swallow — extensions must not break the host on dispose
      }
    }

    // Cascade all scope-tracked disposables.
    this._scope.dispose();

    // Belt-and-suspenders: host-level registries that shard by extensionId
    // should also be swept, in case anything slipped past the scope (e.g. a
    // future API that forgot to call `scope.track`).
    this._injector.get(IHookService).unregisterAllFor(this.extensionId);
    this._injector.get(IToolRegistryService).unregisterAllFor(this.extensionId);
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  private _createCommandsAPI(): IPluginCommandsAPI {
    const injector = this._injector;
    const scope = this._scope;
    return {
      register: <TArgs extends unknown[] = unknown[], TResult = unknown>(
        commandId: string,
        handler: (...args: TArgs) => TResult | Promise<TResult>
      ): IDisposable => {
        const commandService = injector.get(ICommandService);
        return scope.track(commandService.registerCommand({
          id: commandId,
          handler: (_accessor, params) => {
            const args = params === undefined ? [] : [params];
            return handler(...(args as TArgs)) as ReturnType<typeof handler>;
          },
        }));
      },

      execute: async <TResult = unknown, TArgs extends unknown[] = unknown[]>(
        commandId: string,
        ...args: TArgs
      ): Promise<TResult> => {
        const commandService = injector.get(ICommandService);
        return commandService.executeCommand(commandId, args[0] as object | undefined) as Promise<TResult>;
      },
    };
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  private _createUIAPI(): IPluginUIAPI {
    const injector = this._injector;
    const extensionId = this.extensionId;
    const scope = this._scope;

    return {
      async showNotification(
        type: MessageType,
        message: string,
        options?: IShowMessageOptions
      ): Promise<string | undefined> {
        const notificationService = injector.get(INotificationService);
        notificationService.notify({
          title: message,
          body: options?.detail,
          type: type === 'success' ? 'info' : type,
          source: 'extension',
          groupId: extensionId,
        });
        return undefined;
      },

      async showQuickPick<T>(
        _items: ReadonlyArray<IQuickPickItem<T>>,
        _options?: IQuickPickOptions
      ): Promise<IQuickPickItem<T> | ReadonlyArray<IQuickPickItem<T>> | undefined> {
        const logger = injector.get(ILogService);
        logger.warn('[PluginContext]', 'showQuickPick is not yet backed by a UI — returning undefined');
        return undefined;
      },

      async showInputBox(_options?: IInputBoxOptions): Promise<string | undefined> {
        const logger = injector.get(ILogService);
        logger.warn('[PluginContext]', 'showInputBox is not yet backed by a UI — returning undefined');
        return undefined;
      },

      async showConfirmDialog(options: IConfirmDialogOptions): Promise<boolean> {
        const notificationService = injector.get(INotificationService);
        notificationService.notify({
          title: options.title,
          body: options.message,
          type: options.destructive ? 'warning' : 'info',
          source: 'extension',
          groupId: extensionId,
        });
        return false;
      },

      async withProgress<T>(options: IProgressOptions, task: (progress: IProgress) => Promise<T>): Promise<T> {
        const notificationService = injector.get(INotificationService);
        const handle = notificationService.notify({
          title: options.title,
          type: 'info',
          source: 'extension',
          groupId: extensionId,
        });
        const progress: IProgress = {
          report: (_update) => {
            // Notification payload is readonly; future work can surface progress
            // via a dedicated host UI. For now we drop increments.
          },
        };
        try {
          return await task(progress);
        } finally {
          notificationService.remove(handle.id);
        }
      },

      createStatusBarItem(options: IStatusBarItemOptions): IStatusBarItemHandle {
        const statusBarService = injector.get(IStatusBarService);
        const namespacedId = options.id.startsWith(`ext.${extensionId}.`)
          ? options.id
          : `ext.${extensionId}.${options.id}`;
        const normalized: IStatusBarItemOptions = { ...options, id: namespacedId };
        const disposable = scope.track(statusBarService.registerItem(normalized));
        return {
          id: namespacedId,
          update: (patch) => statusBarService.updateItem(namespacedId, patch),
          dispose: () => disposable.dispose(),
        };
      },

      registerComponent(options: IComponentRegistration) {
        const partsService = injector.get(IUIPartsService);
        // `IUIPartsService.registerComponent` receives a synchronous factory
        // that returns a React component class; the extension contract uses
        // `unknown` to stay framework-agnostic, so we funnel the cast here.
        type ReactLikeComponent = Parameters<typeof partsService.registerComponent>[1];
        const factory = options.component as ReactLikeComponent;
        return scope.track(partsService.registerComponent(options.part, factory));
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Events / Hooks
  // ---------------------------------------------------------------------------

  private _createEventsAPI(): IPluginEventsAPI {
    const injector = this._injector;
    const extensionId = this.extensionId;
    const scope = this._scope;

    // `on` is overloaded in IPluginEventsAPI (strongly-typed ExtensionHookName
    // variant + generic fallback). Implement via an untyped inner function
    // and expose it through the overloaded interface via assertion — TS
    // cannot infer variance across the two overloads otherwise.
    const onImpl = (hookId: string, listener: (input: any, output: any) => void | Promise<void>, options?: { priority?: number }): IDisposable => {
      const hookService = injector.get(IHookService);
      return scope.track(hookService.on(hookId, listener as (input: unknown, output: unknown) => void | Promise<void>, { ...options, extensionId }));
    };

    return {
      on: onImpl as IPluginEventsAPI['on'],
      emit<TPayload>(eventId: string, payload: TPayload): void {
        const hookService = injector.get(IHookService);
        hookService.emit(eventId, payload);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------

  private _createToolsAPI(): IPluginToolsAPI {
    const injector = this._injector;
    const extensionId = this.extensionId;
    const scope = this._scope;

    return {
      register: <TParams = unknown, TResult = unknown>(
        definition: IToolDefinition<TParams, TResult>
      ): IDisposable => {
        const registry = injector.get(IToolRegistryService);
        return scope.track(registry.register(extensionId, definition as IToolDefinition));
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Providers (LLM providers contributed at runtime)
  // ---------------------------------------------------------------------------

  private _createProvidersAPI(): IPluginProvidersAPI {
    const injector = this._injector;
    const extensionId = this.extensionId;
    const scope = this._scope;

    return {
      register: (definition: IPluginProviderDefinition): IDisposable => {
        // The provider registry lives in `@termlnk/agent-ui`; if the agent
        // subsystem is absent (headless/tests) report the miss via the log
        // stream and return a no-op disposable so extensions do not crash.
        if (!injector.has(IProviderRegistryService)) {
          const logger = injector.get(ILogService);
          logger.warn(
            '[PluginContext]',
            `providers.register("${definition.id}") from ${extensionId}: IProviderRegistryService is not available; ignoring`
          );
          return toDisposable(() => {});
        }
        const registry = injector.get(IProviderRegistryService);
        return scope.track(registry.register(extensionId, definition));
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Settings (namespaced: ext.<id>.<key>)
  // ---------------------------------------------------------------------------

  private _createSettingsAPI(): IPluginSettingsAPI {
    const injector = this._injector;
    const scope = this._scope;
    const prefix = `ext.${this.extensionId}.`;

    return {
      get: <T>(section: string, defaultValue?: T): T | undefined => {
        const configService = injector.get(IConfigService);
        return configService.getConfig<T>(`${prefix}${section}`, defaultValue) ?? defaultValue;
      },

      update: (section, value) => {
        const configService = injector.get(IConfigService);
        configService.setConfig(`${prefix}${section}`, value);
      },

      onDidChange: (listener) => {
        const configService = injector.get(IConfigService);
        const sub = configService.configChanged$.subscribe((changed) => {
          for (const key of Object.keys(changed)) {
            if (key.startsWith(prefix)) {
              listener({ section: key.slice(prefix.length) });
            }
          }
        });
        return scope.track(toDisposable(sub));
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Workspace (extension-scoped paths)
  // ---------------------------------------------------------------------------

  private _createWorkspaceAPI(): IPluginWorkspaceAPI {
    const extensionPath = this.extensionPath;
    const storagePath = this._storagePath;
    return {
      get extensionPath() { return extensionPath; },
      get storagePath() { return storagePath; },
      resolvePath(relative: string): string {
        return `${extensionPath}/${relative.replace(/^\.\//, '')}`;
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createExtensionLogger(extensionId: string, logService: ILogService): IExtensionLogger {
  const tag = `[ext:${extensionId}]`;
  return {
    info: (message, ...args) => logService.log(tag, message, ...args),
    warn: (message, ...args) => logService.warn(tag, message, ...args),
    error: (message, ...args) => logService.error(tag, message, ...args),
    debug: (message, ...args) => logService.debug(tag, message, ...args),
  };
}

export class InMemoryMemento implements IExtensionMemento {
  private readonly _data = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T | undefined {
    if (this._data.has(key)) {
      return this._data.get(key) as T;
    }
    return defaultValue;
  }

  async set(key: string, value: unknown): Promise<void> {
    this._data.set(key, value);
  }

  keys(): readonly string[] {
    return [...this._data.keys()];
  }
}

export class StubSecretStorage implements ISecretStorage {
  private readonly _data = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this._data.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this._data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this._data.delete(key);
  }
}
