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

import acpuienUS from '@termlnk/acp-ui/locale/en-US';
import acpuijaJP from '@termlnk/acp-ui/locale/ja-JP';
import acpuikoKR from '@termlnk/acp-ui/locale/ko-KR';
import acpuizhCN from '@termlnk/acp-ui/locale/zh-CN';
import acpuizhTW from '@termlnk/acp-ui/locale/zh-TW';
import agentuienUS from '@termlnk/agent-ui/locale/en-US';

import agentuijaJP from '@termlnk/agent-ui/locale/ja-JP';
import agentuikoKR from '@termlnk/agent-ui/locale/ko-KR';
import agentuizhCN from '@termlnk/agent-ui/locale/zh-CN';
import agentuizhTW from '@termlnk/agent-ui/locale/zh-TW';
import authuienUS from '@termlnk/auth-ui/locale/en-US';
import authuijaJP from '@termlnk/auth-ui/locale/ja-JP';
import authuikoKR from '@termlnk/auth-ui/locale/ko-KR';
import authuizhCN from '@termlnk/auth-ui/locale/zh-CN';
import authuizhTW from '@termlnk/auth-ui/locale/zh-TW';
import browseruienUS from '@termlnk/browser-ui/locale/en-US';
import browseruijaJP from '@termlnk/browser-ui/locale/ja-JP';
import browseruikoKR from '@termlnk/browser-ui/locale/ko-KR';
import browseruizhCN from '@termlnk/browser-ui/locale/zh-CN';
import browseruizhTW from '@termlnk/browser-ui/locale/zh-TW';
import { merge } from '@termlnk/core';
import designenUS from '@termlnk/design/locale/en-US';
import designjaJP from '@termlnk/design/locale/ja-JP';
import designkoKR from '@termlnk/design/locale/ko-KR';
import designzhCN from '@termlnk/design/locale/zh-CN';
import designzhTW from '@termlnk/design/locale/zh-TW';
import electronrendererenUS from '@termlnk/electron-renderer/locale/en-US';
import electronrendererjaJP from '@termlnk/electron-renderer/locale/ja-JP';
import electronrendererkoKR from '@termlnk/electron-renderer/locale/ko-KR';
import electronrendererzhCN from '@termlnk/electron-renderer/locale/zh-CN';
import electronrendererzhTW from '@termlnk/electron-renderer/locale/zh-TW';
import extensionuienUS from '@termlnk/extension-ui/locale/en-US';
import extensionuijaJP from '@termlnk/extension-ui/locale/ja-JP';
import extensionuikoKR from '@termlnk/extension-ui/locale/ko-KR';
import extensionuizhCN from '@termlnk/extension-ui/locale/zh-CN';
import extensionuizhTW from '@termlnk/extension-ui/locale/zh-TW';
import portforwardinguienUS from '@termlnk/port-forwarding-ui/locale/en-US';
import portforwardinguijaJP from '@termlnk/port-forwarding-ui/locale/ja-JP';
import portforwardinguikoKR from '@termlnk/port-forwarding-ui/locale/ko-KR';
import portforwardinguizhCN from '@termlnk/port-forwarding-ui/locale/zh-CN';
import portforwardinguizhTW from '@termlnk/port-forwarding-ui/locale/zh-TW';
import projectuienUS from '@termlnk/project-ui/locale/en-US';
import projectuijaJP from '@termlnk/project-ui/locale/ja-JP';
import projectuikoKR from '@termlnk/project-ui/locale/ko-KR';
import projectuizhCN from '@termlnk/project-ui/locale/zh-CN';
import projectuizhTW from '@termlnk/project-ui/locale/zh-TW';
import settingsuienUS from '@termlnk/settings-ui/locale/en-US';
import settingsuijaJP from '@termlnk/settings-ui/locale/ja-JP';
import settingsuikoKR from '@termlnk/settings-ui/locale/ko-KR';
import settingsuizhCN from '@termlnk/settings-ui/locale/zh-CN';
import settingsuizhTW from '@termlnk/settings-ui/locale/zh-TW';
import sftpuienUS from '@termlnk/sftp-ui/locale/en-US';
import sftpuijaJP from '@termlnk/sftp-ui/locale/ja-JP';
import sftpuikoKR from '@termlnk/sftp-ui/locale/ko-KR';
import sftpuizhCN from '@termlnk/sftp-ui/locale/zh-CN';
import sftpuizhTW from '@termlnk/sftp-ui/locale/zh-TW';
import sharedterminaluienUS from '@termlnk/shared-terminal-ui/locale/en-US';
import sharedterminaluijaJP from '@termlnk/shared-terminal-ui/locale/ja-JP';
import sharedterminaluikoKR from '@termlnk/shared-terminal-ui/locale/ko-KR';
import sharedterminaluizhCN from '@termlnk/shared-terminal-ui/locale/zh-CN';
import sharedterminaluizhTW from '@termlnk/shared-terminal-ui/locale/zh-TW';
import snippetuienUS from '@termlnk/snippet-ui/locale/en-US';
import snippetuijaJP from '@termlnk/snippet-ui/locale/ja-JP';
import snippetuikoKR from '@termlnk/snippet-ui/locale/ko-KR';
import snippetuizhCN from '@termlnk/snippet-ui/locale/zh-CN';
import snippetuizhTW from '@termlnk/snippet-ui/locale/zh-TW';
import syncuienUS from '@termlnk/sync-ui/locale/en-US';
import syncuijaJP from '@termlnk/sync-ui/locale/ja-JP';
import syncuikoKR from '@termlnk/sync-ui/locale/ko-KR';
import syncuizhCN from '@termlnk/sync-ui/locale/zh-CN';
import syncuizhTW from '@termlnk/sync-ui/locale/zh-TW';
import terminaluienUS from '@termlnk/terminal-ui/locale/en-US';
import terminaluijaJP from '@termlnk/terminal-ui/locale/ja-JP';
import terminaluikoKR from '@termlnk/terminal-ui/locale/ko-KR';
import terminaluizhCN from '@termlnk/terminal-ui/locale/zh-CN';
import terminaluizhTW from '@termlnk/terminal-ui/locale/zh-TW';
import uienUS from '@termlnk/ui/locale/en-US';
import uijaJP from '@termlnk/ui/locale/ja-JP';
import uikoKR from '@termlnk/ui/locale/ko-KR';
import uizhCN from '@termlnk/ui/locale/zh-CN';
import uizhTW from '@termlnk/ui/locale/zh-TW';

export const enUS = merge(
  {},
  acpuienUS,
  agentuienUS,
  authuienUS,
  browseruienUS,
  designenUS,
  electronrendererenUS,
  extensionuienUS,
  portforwardinguienUS,
  projectuienUS,
  settingsuienUS,
  sftpuienUS,
  snippetuienUS,
  sharedterminaluienUS,
  syncuienUS,
  terminaluienUS,
  uienUS
);
export const zhCN = merge(
  {},
  acpuizhCN,
  agentuizhCN,
  authuizhCN,
  browseruizhCN,
  designzhCN,
  electronrendererzhCN,
  extensionuizhCN,
  portforwardinguizhCN,
  projectuizhCN,
  settingsuizhCN,
  sftpuizhCN,
  snippetuizhCN,
  sharedterminaluizhCN,
  syncuizhCN,
  terminaluizhCN,
  uizhCN
);
export const jaJP = merge(
  {},
  acpuijaJP,
  agentuijaJP,
  authuijaJP,
  browseruijaJP,
  designjaJP,
  electronrendererjaJP,
  extensionuijaJP,
  portforwardinguijaJP,
  projectuijaJP,
  settingsuijaJP,
  sftpuijaJP,
  snippetuijaJP,
  sharedterminaluijaJP,
  syncuijaJP,
  terminaluijaJP,
  uijaJP
);
export const koKR = merge(
  {},
  acpuikoKR,
  agentuikoKR,
  authuikoKR,
  browseruikoKR,
  designkoKR,
  electronrendererkoKR,
  extensionuikoKR,
  portforwardinguikoKR,
  projectuikoKR,
  settingsuikoKR,
  sftpuikoKR,
  snippetuikoKR,
  sharedterminaluikoKR,
  syncuikoKR,
  terminaluikoKR,
  uikoKR
);
export const zhTW = merge(
  {},
  acpuizhTW,
  agentuizhTW,
  authuizhTW,
  browseruizhTW,
  designzhTW,
  electronrendererzhTW,
  extensionuizhTW,
  portforwardinguizhTW,
  projectuizhTW,
  settingsuizhTW,
  sftpuizhTW,
  snippetuizhTW,
  sharedterminaluizhTW,
  syncuizhTW,
  terminaluizhTW,
  uizhTW
);
