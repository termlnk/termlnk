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

import type { IExtensionPointDescriptor } from '../../registry/extension-point';
import { CommandsContributionPoint } from './commands.contribution-point';
import { ConfigurationContributionPoint } from './configuration.contribution-point';
import { KeybindingsContributionPoint } from './keybindings.contribution-point';
import { MenusContributionPoint } from './menus.contribution-point';
import { StatusBarContributionPoint } from './status-bar.contribution-point';
import { TerminalProfilesContributionPoint } from './terminal-profiles.contribution-point';
import { ThemesContributionPoint } from './themes.contribution-point';
import { ToolsContributionPoint } from './tools.contribution-point';

export * from './commands.contribution-point';
export * from './configuration.contribution-point';
export * from './keybindings.contribution-point';
export * from './menus.contribution-point';
export * from './status-bar.contribution-point';
export * from './terminal-profiles.contribution-point';
export * from './themes.contribution-point';
export * from './tools.contribution-point';

export const BUILT_IN_CONTRIBUTION_POINTS: ReadonlyArray<IExtensionPointDescriptor<unknown>> = [
  CommandsContributionPoint as IExtensionPointDescriptor<unknown>,
  MenusContributionPoint as IExtensionPointDescriptor<unknown>,
  KeybindingsContributionPoint as IExtensionPointDescriptor<unknown>,
  StatusBarContributionPoint as IExtensionPointDescriptor<unknown>,
  ThemesContributionPoint as IExtensionPointDescriptor<unknown>,
  TerminalProfilesContributionPoint as IExtensionPointDescriptor<unknown>,
  ConfigurationContributionPoint as IExtensionPointDescriptor<unknown>,
  ToolsContributionPoint as IExtensionPointDescriptor<unknown>,
];
