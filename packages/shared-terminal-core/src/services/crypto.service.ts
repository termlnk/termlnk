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

import type { IKeypair, ISharedKey, ISharedTerminalCryptoService } from '@termlnk/shared-terminal';
import nacl from 'tweetnacl';

/**
 * NaCl box / secretbox 实现——基于 tweetnacl-js（paseo 实证库）。
 *
 * 安全语义：
 * - 公钥编码：32 bytes 原始字节；wire / QR 上序列化为 base64url
 * - 私钥：永不出主进程内存（OS keychain 持久化由 PairingService 处理）
 * - nonce：每次加密 randomBytes(24)；NaCl 24-byte nonce 抗碰撞
 *
 * **库选型**：与 paseo 一致，避免与 @noble/ciphers（同步层用）的密钥派生路径混淆——
 * 加密路径独立、bug 影响面独立。
 */
export class SharedTerminalCryptoService implements ISharedTerminalCryptoService {
  generateKeypair(): IKeypair {
    const kp = nacl.box.keyPair();
    return { publicKey: kp.publicKey, secretKey: kp.secretKey };
  }

  deriveSharedKey(theirPublicKey: Uint8Array, mySecretKey: Uint8Array): ISharedKey {
    if (theirPublicKey.length !== nacl.box.publicKeyLength) {
      throw new Error(`[SharedTerminalCryptoService] invalid public key length ${theirPublicKey.length}, expected ${nacl.box.publicKeyLength}`);
    }
    if (mySecretKey.length !== nacl.box.secretKeyLength) {
      throw new Error(`[SharedTerminalCryptoService] invalid secret key length ${mySecretKey.length}, expected ${nacl.box.secretKeyLength}`);
    }
    return { bytes: nacl.box.before(theirPublicKey, mySecretKey) };
  }

  box(plaintext: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const cipher = nacl.box(plaintext, nonce, theirPublicKey, mySecretKey);
    return concatBytes(nonce, cipher);
  }

  boxOpen(payload: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array {
    if (payload.length < nacl.box.nonceLength + nacl.box.overheadLength) {
      throw new Error('[SharedTerminalCryptoService] box payload too short');
    }
    const nonce = payload.subarray(0, nacl.box.nonceLength);
    const cipher = payload.subarray(nacl.box.nonceLength);
    const plain = nacl.box.open(cipher, nonce, theirPublicKey, mySecretKey);
    if (!plain) {
      throw new Error('[SharedTerminalCryptoService] box decryption failed (key mismatch / tampered)');
    }
    return plain;
  }

  secretBox(plaintext: Uint8Array, sharedKey: ISharedKey): Uint8Array {
    if (sharedKey.bytes.length !== nacl.secretbox.keyLength) {
      throw new Error(`[SharedTerminalCryptoService] invalid sharedKey length ${sharedKey.bytes.length}, expected ${nacl.secretbox.keyLength}`);
    }
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const cipher = nacl.secretbox(plaintext, nonce, sharedKey.bytes);
    return concatBytes(nonce, cipher);
  }

  secretBoxOpen(payload: Uint8Array, sharedKey: ISharedKey): Uint8Array {
    if (sharedKey.bytes.length !== nacl.secretbox.keyLength) {
      throw new Error(`[SharedTerminalCryptoService] invalid sharedKey length ${sharedKey.bytes.length}, expected ${nacl.secretbox.keyLength}`);
    }
    if (payload.length < nacl.secretbox.nonceLength + nacl.secretbox.overheadLength) {
      throw new Error('[SharedTerminalCryptoService] secretbox payload too short');
    }
    const nonce = payload.subarray(0, nacl.secretbox.nonceLength);
    const cipher = payload.subarray(nacl.secretbox.nonceLength);
    const plain = nacl.secretbox.open(cipher, nonce, sharedKey.bytes);
    if (!plain) {
      throw new Error('[SharedTerminalCryptoService] secretbox decryption failed (key mismatch / tampered)');
    }
    return plain;
  }

  generateSessionKey(): Uint8Array {
    return nacl.randomBytes(nacl.secretbox.keyLength);
  }

  randomNonce(): Uint8Array {
    return nacl.randomBytes(nacl.box.nonceLength);
  }

  randomBytes(length: number): Uint8Array {
    if (length <= 0 || !Number.isInteger(length)) {
      throw new Error(`[SharedTerminalCryptoService] invalid length ${length}`);
    }
    return nacl.randomBytes(length);
  }
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
