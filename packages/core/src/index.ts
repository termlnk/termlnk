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

import { installShims } from './common/shims';

installShims();

export * from './common/array';
export * from './common/async';
export * from './common/dayjs';
export * from './common/di';
export * from './common/environment';
export * from './common/error';
export * from './common/extpath';
export * from './common/ip';
export * from './common/lifecycle';
export * from './common/locale';
export * from './common/lodash';
export * from './common/nanoid';
export * from './common/path';
export * from './common/platform';
export { defaultUriKit, getComparisonKey, UriKit } from './common/resources';
export type { IUriKit } from './common/resources';
export { afterTime, bufferDebounceTime, convertObservableToBehaviorSubject, fromCallback, takeAfter } from './common/rxjs';
export { sequence, sequenceAsync } from './common/sequence';
export type { ISequenceExecuteResult } from './common/sequence';
export { awaitTime, delayAnimationFrame } from './common/timer';
export * from './common/types';
export * from './common/uri';
export { Core, type ICoreConfig } from './core';
export type { ICreateNotificationParams, INotification, INotificationAction, INotificationEvent, INotificationFilter, INotificationStats, NotificationEventType, NotificationPriority, NotificationSource, NotificationType } from './models/notification.model';
export { SftpModel, TerminalModel } from './models/ssh';
export { UnitModel, UnitType } from './models/unit';
export { EventState, EventSubject, fromEventSubject, type IEventObserver } from './observer/observable';
export { CommandService, ICommandService, NilCommand, sequenceExecute, sequenceExecuteAsync } from './services/command/command.service';
export type { CommandListener, ICommand, ICommandInfo, IExecutionOptions, IMultiCommand, IMutationCommonParams } from './services/command/command.service';
export { ConfigService, IConfigService } from './services/config/config.service';
export type { IConfigOptions } from './services/config/config.service';
export { ContextService, IContextService } from './services/context/context.service';
export { ErrorService } from './services/error/error.service';
export type { IError } from './services/error/error.service';
export type { ICreateUnitOptions, UnitCtor } from './services/instance/instance.service';
export { IInstanceService, InstanceService } from './services/instance/instance.service';
export { LifecycleNameMap, LifecycleStages } from './services/lifecycle/lifecycle';
export { ILifecycleService, LifecycleService, LifecycleUnreachableError } from './services/lifecycle/lifecycle.service';
export { LocaleService, LocaleType } from './services/locale/locale.service';
export type { ILogContext } from './services/log/context';
export { DesktopLogService, ILogService, LogLevel } from './services/log/log.service';
export { INotificationService, NotificationService } from './services/notification/notification.service';
export { mergeOverrideWithDependencies } from './services/plugin/plugin-override';
export type { DependencyOverride, NullableDependencyPair } from './services/plugin/plugin-override';
export { DependentOn, DependentOnSymbol, Plugin, PluginService, PluginStore, PluginType } from './services/plugin/plugin.service';
export type { PluginCtor } from './services/plugin/plugin.service';
export type { IBase16Colors, IBase30Colors, ICustomTheme, ITheme } from './services/theme/theme';
export { IThemeService, ThemeService } from './services/theme/theme.service';
export type { IUpdateError, IUpdateInfo, IUpdateProgress } from './services/updater/type';
export { UpdateStatus } from './services/updater/type';
export { IUpdaterService } from './services/updater/updater.service';
