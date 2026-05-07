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

export type { CursorStyle, IEncodingGroup, IEncodingItem, ILocalTerminalConfig, ILocalTerminalShellOption, ITerminalAppearanceConfig, IWindowTransparencyConfig, LocalTerminalShell, TerminalRendererEngine } from './config/config';
export { createMissingShellOption, DEFAULT_CONNECT_HEARTBEAT, DEFAULT_CONNECT_TIMEOUT, DEFAULT_CTRL_OR_META_OPEN_TERMINAL_LINK, DEFAULT_CURSOR_BLINK, DEFAULT_CURSOR_STYLE, DEFAULT_ENCODE, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_HOST_ROOT, DEFAULT_LETTER_SPACING, DEFAULT_LOCAL_TERMINAL_SHELL, DEFAULT_PERSISTENCE_SCROLLBACK, DEFAULT_TERM_TYPE, DEFAULT_TERMINAL_RENDERER_ENGINE, DEFAULT_TERMINAL_WORD_SEPARATOR, DEFAULT_WINDOW_TRANSPARENCY_OPACITY, DEFAULT_WINDOWS_LOCAL_TERMINAL_SHELL, ENCODING_GROUPS, getDefaultLocalTerminalConfig, getShellExecutableName, normalizeLocalTerminalConfig, resolveLegacyShellValue } from './config/config';
export { DEFAULT_TERMINAL_INPUT_CONFIG, TERMINAL_INPUT_CONFIG_KEY } from './config/input-config';
export type { ITerminalInputConfig } from './config/input-config';
export { DEFAULT_SHELL_INTEGRATION_CONFIG, normalizeShellIntegrationConfig, SHELL_INTEGRATION_CONFIG_KEY } from './config/shell-integration-config';
export type { IShellIntegrationConfig, ISSHShellIntegrationConfig } from './config/shell-integration-config';
export type { ITerminalConfig } from './controllers/config.schema';
export { TERMINAL_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export { CharProtection, CursorShape, DeviceAttributeType, EraseDisplayMode, EraseLineMode, TabClearMode } from './models/csi';
export type { DcsCommand, DecrqssSetting, IDcsDecrqssCommand, IDcsUnknownCommand, IDcsXtGetTcapCommand, IDcsXtVersionCommand, IDecrqssData, IXtGetTcapData, IXtVersionData } from './models/dcs';
export { HOST_CHAIN_MAX_DEPTH, HostType } from './models/host';
export type { HostItem, HostTree, IAlwaysCredential, ICredential, IHost, IHostChangeEvent, IHostGroup, IHostItemBase, IHostSchema, IHostSettings, IPasswordCredential, IProxy, IRSACredential } from './models/host';
export { PTYSessionStatus } from './models/pty';
export type { IOscEvent, ITerminalCommand, OscEventType } from './models/shell-integration';
export { parseCsi } from './parsers/csi-parser';
export type { CsiCommand, ICursorBackwardCommand, ICursorBackwardTabCommand, ICursorDownCommand, ICursorForwardCommand, ICursorHorizontalTabCommand, ICursorNextLineCommand, ICursorPositionCommand, ICursorPreviousLineCommand, ICursorUpCommand, IDeleteCharacterCommand, IDeleteLineCommand, IDeviceAttributesPrimaryCommand, IDeviceAttributesSecondaryCommand, IDeviceAttributesTertiaryCommand, IDeviceStatusReportCommand, IEraseCharacterCommand, IEraseInDisplayCommand, IEraseInLineCommand, IHorizontalPositionAbsoluteCommand, IHorizontalPositionRelativeCommand, IInsertCharacterCommand, IInsertLineCommand, IKittyKeyboardPopCommand, IKittyKeyboardPushCommand, IKittyKeyboardQueryCommand, IKittyKeyboardSetCommand, IRepeatCharacterCommand, IRequestModeCommand, IResetModeCommand, IRestoreCursorCommand, ISaveCursorCommand, IScrollDownCommand, IScrollUpCommand, ISelectCharProtectionCommand, ISelectGraphicRenditionCommand, ISetCursorStyleCommand, ISetLeftRightMarginsCommand, ISetModeCommand, ISetTopBottomMarginsCommand, ITabClearCommand, IUnknownCsiCommand, IVerticalPositionAbsoluteCommand, IVerticalPositionRelativeCommand, IWindowManipulationCommand, IXtVersionCommand } from './parsers/csi-parser';
export { CsiStreamParser } from './parsers/csi-stream-parser';
export type { ICsiSequence } from './parsers/csi-stream-parser';
export { parseDcs } from './parsers/dcs-parser';
export { DcsStreamParser } from './parsers/dcs-stream-parser';
export type { IDcsSequence } from './parsers/dcs-stream-parser';
export { parseOsc7 } from './parsers/osc-7-parser';
export type { IOsc7Result } from './parsers/osc-7-parser';
export { parseOsc133 } from './parsers/osc-133-parser';
export type { IOsc133CommandEndEvent, IOsc133CommandStartEvent, IOsc133ContinuationPromptEvent, IOsc133Event, IOsc133InputStartEvent, IOsc133OutputStartEvent, IOsc133PromptEndEvent, IOsc133PromptStartEvent, IOsc133PropertyEvent, Osc133ActionType, Osc133Event } from './parsers/osc-133-parser';
export { parseOsc633 } from './parsers/osc-633-parser';
export type { ICommandEndEvent, ICommandLineEvent, ICommandStartEvent, IOsc633Event, IPromptEndEvent, IPromptStartEvent, IPropertyEvent, Osc633Event, Osc633EventType } from './parsers/osc-633-parser';
export { createOscNotificationHandler, isOscNotification, parseOscNotification, registerOscNotificationHandlers } from './parsers/osc-notification-parser';
export type { IOscNotificationResult, OscNotificationType } from './parsers/osc-notification-parser';
export { OscSequenceStreamParser } from './parsers/osc-stream-parser';
export type { IOscSequence } from './parsers/osc-stream-parser';
export { decodeHex, encodeHex, formatDecrqssResponse, formatXtGetTcapResponse, formatXtVersionResponse } from './parsers/response-formatter';
export { TERMINAL_PLUGIN_NAME, TerminalPlugin } from './plugin';
export { IPTYSessionService } from './services/pty-session';
export type { IPTYCreateSessionOptions } from './services/pty.service';
export { IPTYService } from './services/pty.service';
export { IShellIntegrationService, ShellIntegrationService } from './services/shell-integration.service';
