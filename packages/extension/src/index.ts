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

export type { EventListener, ExtensionUIPart, HookListener, IComponentRegistration, IConfirmDialogOptions, IEventHandle, IExtensionContext, IExtensionLogger, IExtensionMemento, IHookContext, IHookOptions, IInputBoxOptions, IPluginActivateFunction, IPluginActivation, IPluginCommandsAPI, IPluginEventsAPI, IPluginProviderChatRequest, IPluginProviderDefinition, IPluginProviderModelInfo, IPluginProvidersAPI, IPluginSettingsAPI, IPluginToolsAPI, IPluginUIAPI, IPluginWorkspaceAPI, IProgress, IProgressOptions, IQuickPickItem, IQuickPickOptions, ISecretStorage, IShowMessageOptions, IStatusBarItemHandle, IStatusBarItemOptions, IToolDefinition, MessageType, PluginProviderSdkType } from './api/extension-context';
export { ExtensionActivationError, ExtensionError, ExtensionInstallError, ExtensionManifestError } from './common/extension-errors';
export { EXTENSION_DATA_DIR_NAME, EXTENSION_STATE_FILENAME, EXTENSION_STATE_STORAGE_KEY, EXTENSIONS_DIR_NAME } from './common/extension-paths';
export type { IContributionPoint } from './contributions/contribution-point';
export { IContributionPointRegistry } from './contributions/contribution-point';
export { ContributionPointRegistry } from './contributions/contribution-point-registry';
export { IContributionRegistry } from './contributions/contribution-registry';
export * from './contributions/points';
export { EXTENSION_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IExtensionConfig } from './controllers/config.schema';
export type { HookContractOf, HookInputOf, HookOutputOf, IHookContract, IModelPricing, ITerminalSessionSnapshot, ITokenUsage, IToolExecutionContext } from './hooks/hook-contracts';
export type { ExtensionHookName } from './hooks/hook-names';
export type { IHookInvokable } from './hooks/invoke-hook';
export { invokeHook } from './hooks/invoke-hook';
export { ExtensionDisposableScope } from './lifecycle/extension-disposable-scope';
export type { IExtensionStatusChange } from './lifecycle/extension-lifecycle.service';
export { ExtensionLifecycleService, IExtensionLifecycleService } from './lifecycle/extension-lifecycle.service';
export type { ActivationEvent } from './manifest/activation-events';
export { parseActivationEvent } from './manifest/activation-events';
export type { IExtensionContributes, IExtensionContributesMap } from './manifest/contribution-points';
export type { ExtensionCategory, ExtensionPermission, ExtensionType, IExtensionManifest } from './manifest/extension-manifest';
export { extensionManifestSchema, validateManifest } from './manifest/extension-manifest';
export type { IActivatedExtension, IExtensionContextLike, IExtensionDescription, IExtensionInfo, IExtensionModule } from './models/extension-description';
export { ExtensionStatus } from './models/extension-status';
export { EXTENSION_PLUGIN_NAME, ExtensionPlugin } from './plugin';
export type { IExtensionPoint, IExtensionPointContribution, IExtensionPointDelta, IExtensionPointDescriptor, IExtensionPointHandler } from './registry/extension-point';
export { ExtensionPointRegistry, IExtensionPointRegistry } from './registry/extension-point-registry';
export type { PermissionManifest } from './security/gated-api';
export { createGatedAPI } from './security/gated-api';
export type { PermissionDecision } from './security/permission.service';
export { IPermissionService, PermissionDeniedError, PermissionNotDeclaredError, PermissionService } from './security/permission.service';
export { IExtensionHostService } from './services/extension-host.service';
export { IExtensionRegistryService } from './services/extension-registry.service';
export type { IRegistryExtensionMetadata, IRegistryVersionInfo } from './services/extension-registry.service';
export { IExtensionStateService } from './services/extension-state.service';
export { IExtensionStorageService } from './services/extension-storage.service';
export type { IExtensionChangeEvent } from './services/extension.service';
export { IExtensionService } from './services/extension.service';
