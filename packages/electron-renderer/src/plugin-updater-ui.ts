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
import { DependentOn, Inject, Injector, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { UIPlugin } from '@termlnk/ui';
import { UpdaterController } from './controllers/updater.controller';
import { ElectronRendererPlugin } from './plugin';

export const UPDATER_UI_PLUGIN_NAME = 'UPDATER_UI_PLUGIN';

/**
 * Renders the software-update UI (sidebar button + dialog + auto-check) in the
 * main workbench window.
 *
 * This is intentionally a separate plugin from {@link ElectronRendererPlugin}:
 * the underlying `IUpdaterService` is a generic electron capability that may be
 * consumed from any renderer (e.g. the About tab calling `checkForUpdates`),
 * but the update button and dialog belong to the main workbench only. Keeping
 * them in `ElectronRendererPlugin` caused the island renderer — which also
 * registers that plugin — to mount the update dialog in its chromeless 680×580
 * window, producing the ghost-window artifact.
 */
@DependentOn(ElectronRendererPlugin, UIPlugin)
export class UpdaterUIPlugin extends Plugin {
  static override pluginName = UPDATER_UI_PLUGIN_NAME;

  constructor(
    @Inject(Injector) protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [UpdaterController],
    ];
    registerDependencies(this._injector, dependencies);

    touchDependencies(this._injector, [
      [UpdaterController],
    ]);
  }
}
