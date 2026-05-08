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

import { Buffer } from 'node:buffer';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/hashes 2.x exports only `.js` subpaths
import { hkdf } from '@noble/hashes/hkdf.js';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/hashes 2.x exports only `.js` subpaths
import { sha256 } from '@noble/hashes/sha2.js';
import { HKDF_INFO, MASTER_KEY_DERIVATION } from '@termlnk/auth';
import { argon2id } from 'hash-wasm';

const TEXT_ENCODER = new TextEncoder();

/** 派生出的三把子密钥（auth/enc/index）；长度均为 32 字节。 */
export interface IDerivedSubKeys {
  readonly authKey: Uint8Array;
  readonly encKey: Uint8Array;
  readonly indexKey: Uint8Array;
}

/**
 * 构造 Argon2id 输入 salt：`utf8(lowercased(email)) || base64decode(saltB64)`。
 *
 * 设计要点：
 * - 邮箱固定部分实现"同一密码 + 不同账号 → 不同 master key"——防止跨账号字典攻击
 * - 服务端发的随机部分保证用户首次注册时具备不可预测的熵
 * - 邮箱归一化（trim + lowercase）以避免大小写差异导致重复登录派生不同 key
 */
export function computeArgon2Salt(email: string, saltB64: string): Uint8Array {
  const emailBytes = TEXT_ENCODER.encode(email.trim().toLowerCase());
  const randomBytes = Buffer.from(saltB64, 'base64');
  if (randomBytes.length === 0) {
    throw new Error('Argon2 salt material is empty: serverSaltB64 must decode to >= 1 byte');
  }
  const out = new Uint8Array(emailBytes.length + randomBytes.length);
  out.set(emailBytes, 0);
  out.set(randomBytes, emailBytes.length);
  return out;
}

/**
 * 用 Argon2id 把用户主密码拉伸成 32 字节 master key。
 *
 * 参数读取自 `@termlnk/auth` 的 `MASTER_KEY_DERIVATION`（OWASP 2023 推荐基线）。
 * 在主进程内执行：hash-wasm 通过 WASM 计算，纯 JS 跨平台一致。
 *
 * @param password 用户明文密码（瞬时使用；调用方应在派生后立即丢弃引用）
 * @param salt     `computeArgon2Salt` 的输出
 */
export async function deriveMasterKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return await argon2id({
    password,
    salt,
    parallelism: MASTER_KEY_DERIVATION.parallelism,
    iterations: MASTER_KEY_DERIVATION.iterations,
    memorySize: MASTER_KEY_DERIVATION.memoryKiB,
    hashLength: MASTER_KEY_DERIVATION.outputBytes,
    outputType: 'binary',
  });
}

/**
 * 用 HKDF-SHA256 把 master key 拆成三把独立用途的子密钥。
 *
 * 三把密钥相互不可推导（HKDF 单向 + 不同 info 标签提供 domain separation）：
 * 服务端拿到 authKey 也无法反推 encKey/indexKey。
 *
 * @param masterKey `deriveMasterKey` 输出（32 字节）
 * @param salt      可选 HKDF salt；通常省略即可（HKDF 已内置 PRK extract，info 已提供 domain separation）
 */
export function deriveSubKeys(masterKey: Uint8Array, salt: Uint8Array = new Uint8Array(0)): IDerivedSubKeys {
  return {
    authKey: hkdf(sha256, masterKey, salt, TEXT_ENCODER.encode(HKDF_INFO.AUTH), MASTER_KEY_DERIVATION.outputBytes),
    encKey: hkdf(sha256, masterKey, salt, TEXT_ENCODER.encode(HKDF_INFO.ENC), MASTER_KEY_DERIVATION.outputBytes),
    indexKey: hkdf(sha256, masterKey, salt, TEXT_ENCODER.encode(HKDF_INFO.INDEX), MASTER_KEY_DERIVATION.outputBytes),
  };
}

/** 尽力清零 Uint8Array（V8 可能持有副本，不能完全保证，仅减少残留窗口）。 */
export function zeroize(buf: Uint8Array | null | undefined): void {
  if (!buf) {
    return;
  }
  buf.fill(0);
}
