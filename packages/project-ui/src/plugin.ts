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

import type { Dependency, Injector } from '@termlnk/core';
import type { IProjectUIPluginConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { IProjectContextService, ProjectPlugin } from '@termlnk/project';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { TerminalUIPlugin } from '@termlnk/terminal-ui';
import { UIPlugin } from '@termlnk/ui';
import { PROJECT_UI_PLUGIN_NAME } from './common/constants';
import { defaultPluginConfig, PROJECT_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { ProjectUIController } from './controllers/project-ui.controller';
import { ProjectContextService } from './services/project-context.service';
import { IProjectExplorerService, ProjectExplorerService } from './services/project-explorer.service';

export { PROJECT_UI_PLUGIN_NAME };

@DependentOn(UIPlugin, TerminalUIPlugin, RPCClientPlugin, ProjectPlugin)
export class ProjectUIPlugin extends Plugin {
  static override pluginName = PROJECT_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IProjectUIPluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(PROJECT_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IProjectContextService, { useClass: ProjectContextService }],
      [IProjectExplorerService, { useClass: ProjectExplorerService }],
      [ProjectUIController],
    ];
    registerDependencies(
      this._injector,
      mergeOverrideWithDependencies(dependencies, this._config.override)
    );
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [IProjectContextService],
      [IProjectExplorerService],
      [ProjectUIController],
    ]);
  }
}
