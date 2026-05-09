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

import type { IFrame } from '../models/frame';
import type { ISharedKey } from '../models/keypair';
import { createIdentifier } from '@termlnk/core';

/**
 * 帧编解码 + 加密一体服务——把逻辑帧序列化为 wire 字节流，反之亦然。
 *
 * Wire 格式（明文层布局，即将进入 NaCl secretbox 的字节）：
 *
 * ```
 * +--------+--------+----------+----------------+
 * | ver(1) | ch(1)  | flags(1) | seq(4 LE u32)  |
 * +--------+--------+----------+----------------+
 * |             payload (variable)              |
 * +---------------------------------------------+
 * ```
 *
 * Wire 格式（密文层）：
 *
 * ```
 * +-------------+-----------+--------------------------+
 * | "tmst1:"(6) | nonce(24) | secretbox(明文层)         |
 * +-------------+-----------+--------------------------+
 * ```
 *
 * 设计依据：cloud-sync-architecture.md §5.2 BinaryMuxFrame + §4.2 加密原语决策。
 */
export interface IFrameCodecService {
  /**
   * 将逻辑帧序列化为明文字节（不加密）——单元测试 / debug 用。
   */
  encodePlain(frame: IFrame): Uint8Array;

  /**
   * 解码明文字节为逻辑帧——单元测试 / debug 用。失败抛错。
   */
  decodePlain(bytes: Uint8Array): IFrame;

  /**
   * 加密 + 序列化——返回 wire 字节流（含 `tmst1:` 前缀 + nonce + 密文 + tag）。
   * 仅支持 SHARED_TERMINAL_FRAME_VERSION 当前版本；旧版本由 decode 路径自动 dispatch。
   */
  encrypt(frame: IFrame, sharedKey: ISharedKey): Uint8Array;

  /**
   * 解密 + 反序列化——失败抛错（密钥错 / 篡改 / 不支持版本 / 非法字段）。
   *
   * 旧版本 wire bytes 仍能解码（向后兼容铁律）；版本字段在密文层之前的常量前缀，
   * 通过前缀字符串识别版本即可。
   */
  decrypt(wireBytes: Uint8Array, sharedKey: ISharedKey): IFrame;
}

export const IFrameCodecService = createIdentifier<IFrameCodecService>(
  'shared-terminal.frame-codec-service'
);
