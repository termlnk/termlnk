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

/** NaCl box / secretbox backed by tweetnacl-js. Separate from @noble/ciphers (sync layer) to isolate key derivation paths. */
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

  wrapSessionKey(sessionKey: Uint8Array, recipientPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array {
    if (sessionKey.length !== nacl.secretbox.keyLength) {
      throw new Error(`[SharedTerminalCryptoService] sessionKey must be ${nacl.secretbox.keyLength} bytes, got ${sessionKey.length}`);
    }
    return this.box(sessionKey, recipientPublicKey, mySecretKey);
  }

  unwrapSessionKey(payload: Uint8Array, senderPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array {
    const plain = this.boxOpen(payload, senderPublicKey, mySecretKey);
    if (plain.length !== nacl.secretbox.keyLength) {
      throw new Error(`[SharedTerminalCryptoService] unwrapped sessionKey is not ${nacl.secretbox.keyLength} bytes (got ${plain.length}); refusing to use`);
    }
    return plain;
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
