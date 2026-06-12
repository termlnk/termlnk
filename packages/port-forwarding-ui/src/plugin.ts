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

import type { Dependency } from '@termlnk/core';
import type { IPortForwardingUIConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { UIPlugin } from '@termlnk/ui';
import { AuthEventController } from './controllers/auth-event.controller';
import { defaultPluginConfig, PORT_FORWARDING_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { PortForwardingUIController } from './controllers/port-forwarding-ui.controller';
import { RuleDialogController } from './controllers/rule-dialog.controller';
import { IRuleContextService, RuleContextService } from './services/rule-context/rule-context.service';
import { IRuleDialogService, RuleDialogService } from './services/rule-dialog/rule-dialog.service';

export const PORT_FORWARDING_UI_PLUGIN_NAME = 'PORT_FORWARDING_UI_PLUGIN';

@DependentOn(UIPlugin, RPCClientPlugin)
export class PortForwardingUIPlugin extends Plugin {
  static override pluginName = PORT_FORWARDING_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IPortForwardingUIConfig = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(PORT_FORWARDING_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();
    touchDependencies(this._injector, [
      [PortForwardingUIController],
      [RuleDialogController],
      [AuthEventController],
    ]);
  }

  private _initDependencies(): void {
    const dependencies: Dependency[] = [
      [PortForwardingUIController],
      [RuleDialogController],
      [AuthEventController],
      [IRuleContextService, { useClass: RuleContextService }],
      [IRuleDialogService, { useClass: RuleDialogService }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
