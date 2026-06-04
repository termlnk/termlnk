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

import { ICommandService, Inject, Injector, RxDisposable } from '@termlnk/core';
import { BotIcon, BotIconKey, connectInjector } from '@termlnk/design';
import { BuiltInUIPart, ComponentManagerService, IMenuManagerService, IUIPartsService } from '@termlnk/ui';
import { AllowAlwaysCommand } from '../commands/approval/allow-always.command';
import { CopyMessageCommand } from '../commands/copy-message.command';
import { EditUserMessageCommand } from '../commands/edit-user-message.command';
import { RetryMessageCommand } from '../commands/retry-message.command';
import { ToggleAIPanelCommand } from '../commands/toggle-ai-panel.command';
import { IGenerativeUIRegistryService } from '../services/generative-ui/generative-ui-registry.service';
import { ChatPanel } from '../views/chat/ChatPanel';
import { BarChartWidget } from '../views/chat/parts/widgets/BarChartWidget';
import { PieChartWidget } from '../views/chat/parts/widgets/PieChartWidget';
import { WidgetRenderer } from '../views/chat/parts/widgets/WidgetRenderer';
import { menuSchema } from './menu.schema';

const TERMLNK_WIDGET_README_TOOL = 'termlnk_widget_readme';
const TERMLNK_WIDGET_RENDERER_TOOL = 'termlnk_widget_renderer';
const TERMLNK_PIE_CHART_TOOL = 'termlnk_pie_chart';
const TERMLNK_BAR_CHART_TOOL = 'termlnk_bar_chart';

export class ChatPanelController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService,
    @IGenerativeUIRegistryService private readonly generativeUIRegistryService: IGenerativeUIRegistryService
  ) {
    super();

    this._initComponents();
    this._initCommands();
    this._initMenus();
  }

  private _initComponents(): void {
    this.disposeWithMe(
      this._componentManagerService.register(BotIconKey, BotIcon)
    );

    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.RIGHT_SIDEBAR, () => connectInjector(ChatPanel, this._injector))
    );
  }

  private _initCommands(): void {
    this.disposeWithMe(this._commandService.registerCommand(ToggleAIPanelCommand));
    this.disposeWithMe(this._commandService.registerCommand(CopyMessageCommand));
    this.disposeWithMe(this._commandService.registerCommand(RetryMessageCommand));
    this.disposeWithMe(this._commandService.registerCommand(EditUserMessageCommand));
    this.disposeWithMe(this._commandService.registerCommand(AllowAlwaysCommand));
  }

  private _initMenus(): void {
    this._menuManagerService.mergeMenu(menuSchema);
  }

  registerBuiltinGenerativeUIComponents(): void {
    // widgetReadme is purely informational for the LLM; render as nothing in chat.
    this.disposeWithMe(this.generativeUIRegistryService.register({ name: TERMLNK_WIDGET_README_TOOL, render: () => null }));
    this.disposeWithMe(this.generativeUIRegistryService.register({ name: TERMLNK_WIDGET_RENDERER_TOOL, render: WidgetRenderer }));
    this.disposeWithMe(this.generativeUIRegistryService.register({ name: TERMLNK_PIE_CHART_TOOL, render: PieChartWidget }));
    this.disposeWithMe(this.generativeUIRegistryService.register({ name: TERMLNK_BAR_CHART_TOOL, render: BarChartWidget }));
  }
}
