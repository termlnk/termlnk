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

import './global.css';

export { ToggleRightSidebarCommand } from './commands/toggle-right-sidebar.command';
export { generateCSSVariables } from './common/css-var';
export { fromEvent, fromGlobalEvent } from './common/event';
export { injectUIFontToDOM, removeUIFontFromDOM } from './common/inject-ui-font';
export { DEFAULT_UI_FONT_FAMILY, DEFAULT_UI_FONT_SIZE, UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IUIConfig } from './controllers/config.schema';
export { UI_PLUGIN_NAME, UIPlugin } from './plugin';

export { ComponentManagerService } from './services/component/component-manager.service';
export type { ComponentList, ComponentType, IComponent, IComponentOptions } from './services/component/component-manager.service';
export { ContentRouterService, DEFAULT_PAGE_ID, IContentRouterService } from './services/content-router/content-router.service';
export type { IContentPage } from './services/content-router/content-router.service';
export { DialogService, IDialogService } from './services/dialog/dialog.service';
export { DOMEventObserver } from './services/event/dom-event-observer';
export type { IIMEState } from './services/event/dom-event-observer';
export { SIDE_TAB_BAR_WIDTH_REM } from './services/layout/layout.constants';
export { DesktopLayoutService, ILayoutService } from './services/layout/layout.service';
export { MenuItemType, MenuPosition } from './services/menu/menu';
export type { IMenuItem, IMenuItemFactory, IMenuSchema, MenuConfig, MenuItemConfig, MenuSchemaType } from './services/menu/menu';
export { IMenuManagerService, MenuManagerService } from './services/menu/menu-manager.service';
export { mergeMenuConfigs } from './services/menu/menu-utils';
export { BuiltInUIPart, IUIPartsService, UIPartsService } from './services/parts/parts.service';
export type { ComponentRenderer } from './services/parts/parts.service';
export { IPlatformService, PlatformService } from './services/platform/platform.service';
export { ResizableService } from './services/resizable/resizable.service';
export { KeyCode, KeyCodeToChar, MetaKeys } from './services/shortcut/keycode';
export { IShortcutService, ShortcutService } from './services/shortcut/shortcut.service';
export type { IShortcutItem } from './services/shortcut/shortcut.service';
export { SideTabBarService } from './services/side-tab-bar/side-tab-bar.service';
export { IStatusBarService, StatusBarService } from './services/status-bar/status-bar.service';
export type { IStatusBarItem } from './services/status-bar/status-bar.service';
export { ThemeSwitcherService } from './services/theme-switcher/theme-switcher.service';
export { ComponentContainer, useComponentsOfPart } from './views/components/ComponentContainer';
export type { IComponentContainerProps } from './views/components/ComponentContainer';
export type { ICustomWrapperProps } from './views/components/custom-wrapper';
export { CustomWrapper } from './views/components/custom-wrapper';
export { NotificationIcon, NotificationPanel } from './views/components/notification';
export { TooltipWrapper } from './views/components/tooltip/TooltipWrapper';
export type { ITooltipWrapperProps } from './views/components/tooltip/TooltipWrapper';
