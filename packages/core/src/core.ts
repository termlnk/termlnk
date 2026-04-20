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

import type { Dependency, IDisposable } from './common/di';
import type { ILocales } from './common/locale';
import type { LocaleType } from './services/locale/locale.service';
import type { LogLevel } from './services/log/log.service';
import type { DependencyOverride } from './services/plugin/plugin-override';
import type { Plugin, PluginCtor } from './services/plugin/plugin.service';
import type { ITheme } from './services/theme/theme';
import { Injector } from './common/di';
import { DisposableCollection, toDisposable } from './common/lifecycle';
import { CommandService, ICommandService } from './services/command/command.service';
import { ConfigService, IConfigService } from './services/config/config.service';
import { ContextService, IContextService } from './services/context/context.service';
import { ErrorService } from './services/error/error.service';
import { IInstanceService, InstanceService } from './services/instance/instance.service';
import { LifecycleStages } from './services/lifecycle/lifecycle';
import { ILifecycleService, LifecycleService } from './services/lifecycle/lifecycle.service';
import { LocaleService } from './services/locale/locale.service';
import { DesktopLogService, ILogService } from './services/log/log.service';
import { INotificationService, NotificationService } from './services/notification/notification.service';
import { mergeOverrideWithDependencies } from './services/plugin/plugin-override';
import { PluginService } from './services/plugin/plugin.service';
import { IThemeService, ThemeService } from './services/theme/theme.service';

export interface ICoreConfig {
  /**
   * The theme of the instance.
   * Theme type (dark/light) is determined by the theme's `type` property.
   */
  theme?: ITheme;

  /**
   * The locale of the instance.
   */
  locale?: LocaleType;

  /**
   * The locales to be used
   */
  locales?: ILocales;

  /**
   * The log level of the instance.
   */
  logLevel?: LogLevel;

  /**
   * The override dependencies of the termlnk instance.
   */
  override?: DependencyOverride;
}

export class Core implements IDisposable {
  private readonly _injector: Injector;
  private _disposingCallbacks = new DisposableCollection();

  constructor(config: Partial<ICoreConfig> = {}, parentInjector?: Injector) {
    this._injector = createCoreInjector(parentInjector, config.override);
    const themeService = this._injector.get(IThemeService);
    const localeService = this._injector.get(LocaleService);
    const logService = this._injector.get(ILogService);

    const { theme, locale, locales, logLevel } = config;
    if (theme) themeService.setTheme(theme);
    if (locales) localeService.load(locales);
    if (locale) localeService.setLocale(locale);
    if (logLevel) logService.setLogLevel(logLevel);
  }

  private get _pluginService(): PluginService {
    return this._injector.get(PluginService);
  }

  start(): void {
    const lifecycleService = this._injector.get(ILifecycleService);
    if (lifecycleService.getStage() < LifecycleStages.Ready) {
      lifecycleService.setStage(LifecycleStages.Ready);
    }
  }

  getInjector(): Injector {
    return this._injector;
  }

  /**
   * Register a callback function which will be called when this instance is disposing.
   *
   * @ignore
   *
   * @param callback The callback function.
   * @returns To remove this callback function from this instance's on disposing list.
   */
  onDispose(callback: () => void): IDisposable {
    const d = this._disposingCallbacks.add(toDisposable(callback));
    return toDisposable(() => d.dispose(true));
  }

  dispose(): void {
    this._disposingCallbacks.dispose();
    this._injector.dispose();
  }

  setLocale(locale: LocaleType): void {
    this._injector.get(LocaleService).setLocale(locale);
  }

  /** Register a plugin into termlnk. */
  registerPlugin<T extends PluginCtor<Plugin>>(plugin: T, config?: ConstructorParameters<T>[0]): void {
    this._pluginService.registerPlugin(plugin, config);
  }

  /**
   * Register multiple plugins into termlnk.
   * @param plugins An array of tuples, where each tuple contains a plugin constructor and its optional configuration.
   */
  registerPlugins<
    T extends readonly (
      | readonly [PluginCtor<Plugin>]
      | readonly [PluginCtor<Plugin>, unknown]
    )[]
  >(
    plugins: {
      readonly [K in keyof T]: T[K] extends readonly [infer P]
        ? P extends PluginCtor<Plugin>
          ? readonly [P]
          : T[K]
        : T[K] extends readonly [infer P, unknown]
          ? P extends PluginCtor<Plugin>
            ? readonly [P, ConstructorParameters<P>[0]?]
            : T[K]
          : T[K];
    }
  ): void {
    plugins.forEach((item) => {
      const [plugin, config] = item;
      this._pluginService.registerPlugin(plugin, config);
    });
  }
}

function createCoreInjector(parentInjector?: Injector, override?: DependencyOverride): Injector {
  const dependencies: Dependency[] = mergeOverrideWithDependencies([
    [ErrorService],
    [LocaleService],
    [PluginService],

    // abstract services
    [ILifecycleService, { useClass: LifecycleService }],
    [IThemeService, { useClass: ThemeService }],
    [IInstanceService, { useClass: InstanceService }],
    [ILogService, { useClass: DesktopLogService, lazy: true }],
    [ICommandService, { useClass: CommandService }],
    [IConfigService, { useClass: ConfigService }],
    [IContextService, { useClass: ContextService }],
    [INotificationService, { useClass: NotificationService, lazy: true }],
  ], override);

  return parentInjector ? parentInjector.createChild(dependencies) : new Injector(dependencies);
}
