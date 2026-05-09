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

import { createIdentifier } from '@termlnk/core';

/**
 * 设备名提供者——auth-core 用此抽象向后端登记 deviceName，避免直接依赖 `node:os`。
 *
 * 各端典型实现：
 * - Electron 主进程：包装 `os.hostname()`，留空时返回 'Unknown device'
 * - 浏览器 SPA：navigator.userAgent 解析或 prompt 用户输入；持久化到 localStorage
 * - React Native：expo-device（Device.deviceName）+ AsyncStorage 持久化
 *
 * 用法：
 * - HttpAuthService 通过 Quantity.OPTIONAL 注入；未注册时降级为 'Unknown device'
 * - 永远是同步调用——不允许阻塞 register/login 主路径
 */
export interface IDeviceNameProvider {
  getName(): string;
}

export const IDeviceNameProvider = createIdentifier<IDeviceNameProvider>(
  'auth.device-name-provider'
);
