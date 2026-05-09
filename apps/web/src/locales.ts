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

import authuienUS from '@termlnk/auth-ui/locale/en-US';
import authuijaJP from '@termlnk/auth-ui/locale/ja-JP';
import authuikoKR from '@termlnk/auth-ui/locale/ko-KR';
import authuizhCN from '@termlnk/auth-ui/locale/zh-CN';
import authuizhTW from '@termlnk/auth-ui/locale/zh-TW';
import { merge } from '@termlnk/core';
import designenUS from '@termlnk/design/locale/en-US';
import designjaJP from '@termlnk/design/locale/ja-JP';
import designkoKR from '@termlnk/design/locale/ko-KR';
import designzhCN from '@termlnk/design/locale/zh-CN';
import designzhTW from '@termlnk/design/locale/zh-TW';

/**
 * 浏览器端聚合 locale——目前仅 auth-ui + design 两个 UI 包；后续接入更多包
 * （sync-ui / settings-ui 等）时按 apps/desktop/renderer/src/components/locales.ts
 * 同样的合并模式扩展。
 *
 * **必须**注入到 Core 配置才能让 LoginForm / RegisterForm 拿到翻译——
 * 否则 LocaleService.translate 会输出 `[LocaleService]: Locale not initialized`。
 */
export const enUS = merge({}, authuienUS, designenUS);
export const zhCN = merge({}, authuizhCN, designzhCN);
export const zhTW = merge({}, authuizhTW, designzhTW);
export const jaJP = merge({}, authuijaJP, designjaJP);
export const koKR = merge({}, authuikoKR, designkoKR);
