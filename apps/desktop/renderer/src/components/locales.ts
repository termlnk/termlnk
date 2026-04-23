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

import agentuienUS from '@termlnk/agent-ui/locale/en-US';

import agentuijaJP from '@termlnk/agent-ui/locale/ja-JP';
import agentuikoKR from '@termlnk/agent-ui/locale/ko-KR';
import agentuizhCN from '@termlnk/agent-ui/locale/zh-CN';
import agentuizhTW from '@termlnk/agent-ui/locale/zh-TW';
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
import islanduienUS from '@termlnk/island-ui/locale/en-US';
import islanduijaJP from '@termlnk/island-ui/locale/ja-JP';
import islanduikoKR from '@termlnk/island-ui/locale/ko-KR';
import islanduizhCN from '@termlnk/island-ui/locale/zh-CN';
import islanduizhTW from '@termlnk/island-ui/locale/zh-TW';
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
  agentuienUS,
  designenUS,
  electronrendererenUS,
  extensionuienUS,
  islanduienUS,
  settingsuienUS,
  sftpuienUS,
  terminaluienUS,
  uienUS
);
export const zhCN = merge(
  {},
  agentuizhCN,
  designzhCN,
  electronrendererzhCN,
  extensionuizhCN,
  islanduizhCN,
  settingsuizhCN,
  sftpuizhCN,
  terminaluizhCN,
  uizhCN
);
export const jaJP = merge(
  {},
  agentuijaJP,
  designjaJP,
  electronrendererjaJP,
  extensionuijaJP,
  islanduijaJP,
  settingsuijaJP,
  sftpuijaJP,
  terminaluijaJP,
  uijaJP
);
export const koKR = merge(
  {},
  agentuikoKR,
  designkoKR,
  electronrendererkoKR,
  extensionuikoKR,
  islanduikoKR,
  settingsuikoKR,
  sftpuikoKR,
  terminaluikoKR,
  uikoKR
);
export const zhTW = merge(
  {},
  agentuizhTW,
  designzhTW,
  electronrendererzhTW,
  extensionuizhTW,
  islanduizhTW,
  settingsuizhTW,
  sftpuizhTW,
  terminaluizhTW,
  uizhTW
);
