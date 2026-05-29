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

import type { ISettingsTabDescriptor } from '../../services/settings-tab-registry/settings-tab-registry.service';
import { Disposable, ICommandService, Inject } from '@termlnk/core';
import { BuiltInUIPart, ComponentManagerService, IDialogService, IShortcutService, IUIPartsService } from '@termlnk/ui';
import { Info, Keyboard, LayoutDashboard, Monitor, Palette, Terminal, Unplug, Wand2, Wifi } from 'lucide-react';
import { ToggleSettingsCommand } from '../../commands/toggle-settings.command';
import { SettingsTab } from '../../models/settings.state';
import { ISettingsTabRegistryService } from '../../services/settings-tab-registry/settings-tab-registry.service';
import { SettingsService } from '../../services/settings/settings.service';
import { SETTINGS_PANEL_COMPONENT_NAME, SettingsPanel } from '../../views/settings-panel';
import { AboutTab } from '../../views/settings-panel/components/AboutTab';
import { AppearanceTab } from '../../views/settings-panel/components/AppearanceTab';
import { ColorSchemeTab } from '../../views/settings-panel/components/ColorSchemeTab';
import { InterfaceTab } from '../../views/settings-panel/components/InterfaceTab';
import { MCPTab } from '../../views/settings-panel/components/McpTab';
import { NetworkTab } from '../../views/settings-panel/components/NetworkTab';
import { ShortcutsTab } from '../../views/settings-panel/components/ShortcutsTab';
import { SkillTab } from '../../views/settings-panel/components/SkillTab';
import { TerminalTab } from '../../views/settings-panel/components/TerminalTab';
import { SettingsButton } from '../../views/SettingsButton';
import { ToggleSettingsShortcut } from './shortcut';

export const SETTINGS_DIALOG_ID = 'settings-ui.settings.dialog';

// Built-in tabs owned by settings-ui itself. Tabs that conceptually belong to
// other packages (CHAT/AI_PROVIDER -> agent-ui, ISLAND -> island-ui, ACCOUNT
// -> auth-ui, PLATFORM -> apps/desktop/plugins/electron-renderer) are
// registered by their owning packages via ISettingsTabRegistryService.
const BUILTIN_TABS: ISettingsTabDescriptor[] = [
  {
    id: SettingsTab.APPEARANCE,
    labelKey: 'settings-ui.tab.appearance',
    descriptionKey: 'settings-ui.tab-description.appearance',
    icon: Monitor,
    component: AppearanceTab,
    order: 10,
  },
  {
    id: SettingsTab.INTERFACE,
    labelKey: 'settings-ui.tab.interface',
    descriptionKey: 'settings-ui.tab-description.interface',
    icon: LayoutDashboard,
    component: InterfaceTab,
    order: 20,
  },
  {
    id: SettingsTab.TERMINAL,
    labelKey: 'settings-ui.tab.terminal',
    descriptionKey: 'settings-ui.tab-description.terminal',
    icon: Terminal,
    component: TerminalTab,
    order: 30,
  },
  {
    id: SettingsTab.COLOR_SCHEME,
    labelKey: 'settings-ui.tab.color-scheme',
    descriptionKey: 'settings-ui.tab-description.color-scheme',
    icon: Palette,
    component: ColorSchemeTab,
    order: 40,
  },
  {
    id: SettingsTab.NETWORK,
    labelKey: 'settings-ui.tab.network',
    descriptionKey: 'settings-ui.tab-description.network',
    icon: Wifi,
    component: NetworkTab,
    order: 50,
  },
  {
    id: SettingsTab.MCP,
    labelKey: 'settings-ui.tab.mcp',
    descriptionKey: 'settings-ui.tab-description.mcp',
    icon: Unplug,
    component: MCPTab,
    order: 60,
  },
  {
    id: SettingsTab.SKILL,
    labelKey: 'settings-ui.tab.skill',
    descriptionKey: 'settings-ui.tab-description.skill',
    icon: Wand2,
    component: SkillTab,
    order: 90,
  },
  {
    id: SettingsTab.SHORTCUTS,
    labelKey: 'settings-ui.tab.shortcuts',
    descriptionKey: 'settings-ui.tab-description.shortcuts',
    icon: Keyboard,
    component: ShortcutsTab,
    order: 120,
  },
  {
    id: SettingsTab.ABOUT,
    labelKey: 'settings-ui.tab.about',
    descriptionKey: 'settings-ui.tab-description.about',
    icon: Info,
    component: AboutTab,
    order: 130,
  },
];

export class SettingsController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IDialogService private readonly _dialogService: IDialogService,
    @IShortcutService private readonly _shortcutService: IShortcutService,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @Inject(SettingsService) private readonly _settingsService: SettingsService,
    @ISettingsTabRegistryService private readonly _settingsTabRegistry: ISettingsTabRegistryService
  ) {
    super();
    this._init();
  }

  private _init() {
    this.disposeWithMe(
      this._componentManagerService.register(SETTINGS_PANEL_COMPONENT_NAME, SettingsPanel)
    );

    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.SIDE_TAB_BAR, () => SettingsButton)
    );

    for (const tab of BUILTIN_TABS) {
      this.disposeWithMe(this._settingsTabRegistry.register(tab));
    }

    this.disposeWithMe(
      this._settingsService.stateUpdate$.subscribe((newState) => {
        if (newState.open === true) {
          this._openSettingsDialog();
        } else if (newState.open === false) {
          this._closeSettingsDialog();
        }
      })
    );

    this.disposeWithMe(this._commandService.registerCommand(ToggleSettingsCommand));
    this.disposeWithMe(this._shortcutService.registerShortcut(ToggleSettingsShortcut));
  }

  private _openSettingsDialog() {
    this._dialogService.open({
      id: SETTINGS_DIALOG_ID,
      draggable: true,
      width: 840,
      className: 'tm:overflow-hidden tm:gap-0 tm:p-0',
      mask: true,
      modal: false,
      closable: false,
      disableAutoFocus: true,
      style: {
        maxHeight: 'calc(100vh - 150px)',
      },
      children: { componentId: SETTINGS_PANEL_COMPONENT_NAME },
      onClose: () => this._settingsService.terminate(),
    });
  }

  private _closeSettingsDialog() {
    this._dialogService.close(SETTINGS_DIALOG_ID);
  }
}
