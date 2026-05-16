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
 * Frame codec + encryption combined — turns logical frames into wire bytes
 * and back.
 *
 * Plaintext layout (the bytes that go into NaCl secretbox):
 *
 * ```
 * +--------+--------+----------+----------------+
 * | ver(1) | ch(1)  | flags(1) | seq(4 LE u32)  |
 * +--------+--------+----------+----------------+
 * |             payload (variable)              |
 * +---------------------------------------------+
 * ```
 *
 * Wire layout (ciphertext):
 *
 * ```
 * +-------------+-----------+----------------------------+
 * | "tmst1:"(6) | nonce(24) | secretbox(plaintext layout)|
 * +-------------+-----------+----------------------------+
 * ```
 *
 * See cloud-sync-architecture.md §5.2 (BinaryMuxFrame) and §4.2 (crypto
 * primitives).
 */
export interface IFrameCodecService {
  /** Serialize to plaintext bytes (no encryption) — for unit tests / debug. */
  encodePlain(frame: IFrame): Uint8Array;

  /** Decode plaintext bytes back to a frame — for unit tests / debug. Throws on failure. */
  decodePlain(bytes: Uint8Array): IFrame;

  /**
   * Encrypt + serialize — returns wire bytes
   * (`tmst1:` prefix + nonce + ciphertext + tag). Only the current
   * `SHARED_TERMINAL_FRAME_VERSION` is supported on encode; the decode path
   * dispatches older versions automatically.
   */
  encrypt(frame: IFrame, sharedKey: ISharedKey): Uint8Array;

  /**
   * Decrypt + deserialize — throws on bad key, tampering, unsupported
   * version, or malformed fields.
   *
   * Older wire bytes still decode (backward compatibility is required).
   * The version is encoded in the constant prefix above the ciphertext, so
   * we identify the version from the prefix alone.
   */
  decrypt(wireBytes: Uint8Array, sharedKey: ISharedKey): IFrame;
}

export const IFrameCodecService = createIdentifier<IFrameCodecService>(
  'shared-terminal.frame-codec-service'
);
