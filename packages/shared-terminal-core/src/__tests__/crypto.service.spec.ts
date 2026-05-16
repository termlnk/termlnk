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

import { describe, expect, it } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';

const crypto = new SharedTerminalCryptoService();

describe('sharedTerminalCryptoService', () => {
  it('generateKeypair produces 32-byte public + 32-byte secret', () => {
    const kp = crypto.generateKeypair();
    expect(kp.publicKey).toHaveLength(32);
    expect(kp.secretKey).toHaveLength(32);
    // not all zeros
    expect(kp.publicKey.some((b) => b !== 0)).toBe(true);
    expect(kp.secretKey.some((b) => b !== 0)).toBe(true);
  });

  it('deriveSharedKey is symmetric: alice derive(bobPub, aliceSec) == bob derive(alicePub, bobSec)', () => {
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    const aSk = crypto.deriveSharedKey(bob.publicKey, alice.secretKey);
    const bSk = crypto.deriveSharedKey(alice.publicKey, bob.secretKey);
    expect(aSk.bytes).toEqual(bSk.bytes);
    expect(aSk.bytes).toHaveLength(32);
  });

  it('box round-trips between alice and bob', () => {
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    const message = new TextEncoder().encode('hello multiplayer');
    const cipher = crypto.box(message, bob.publicKey, alice.secretKey);
    const plain = crypto.boxOpen(cipher, alice.publicKey, bob.secretKey);
    expect(new TextDecoder().decode(plain)).toBe('hello multiplayer');
  });

  it('boxOpen with wrong key fails', () => {
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    const eve = crypto.generateKeypair();
    const cipher = crypto.box(new Uint8Array([1, 2, 3]), bob.publicKey, alice.secretKey);
    expect(() => crypto.boxOpen(cipher, alice.publicKey, eve.secretKey)).toThrow(/decryption failed/);
  });

  it('secretBox round-trips with shared key', () => {
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    const sk = crypto.deriveSharedKey(bob.publicKey, alice.secretKey);
    const message = new TextEncoder().encode('PTY frame chunk');
    const cipher = crypto.secretBox(message, sk);
    const plain = crypto.secretBoxOpen(cipher, sk);
    expect(plain).toEqual(message);
  });

  it('secretBoxOpen rejects tampered ciphertext', () => {
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    const sk = crypto.deriveSharedKey(bob.publicKey, alice.secretKey);
    const cipher = crypto.secretBox(new Uint8Array([1, 2, 3, 4, 5]), sk);
    cipher[cipher.length - 1] ^= 0x01;
    expect(() => crypto.secretBoxOpen(cipher, sk)).toThrow(/decryption failed/);
  });

  it('generateSessionKey returns 32 bytes', () => {
    const k = crypto.generateSessionKey();
    expect(k).toHaveLength(32);
    expect(k.some((b) => b !== 0)).toBe(true);
  });

  it('randomNonce returns 24 bytes', () => {
    const n = crypto.randomNonce();
    expect(n).toHaveLength(24);
  });

  it('randomBytes rejects invalid length', () => {
    expect(() => crypto.randomBytes(0)).toThrow();
    expect(() => crypto.randomBytes(-1)).toThrow();
    expect(() => crypto.randomBytes(1.5)).toThrow();
  });

  it('deriveSharedKey rejects invalid public key length', () => {
    const alice = crypto.generateKeypair();
    expect(() => crypto.deriveSharedKey(new Uint8Array(16), alice.secretKey)).toThrow();
    expect(() => crypto.deriveSharedKey(alice.publicKey, new Uint8Array(16))).toThrow();
  });

  it('wrapSessionKey + unwrapSessionKey round-trip with the correct keypair pair', () => {
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    const sessionKey = crypto.generateSessionKey();
    const wrapped = crypto.wrapSessionKey(sessionKey, bob.publicKey, alice.secretKey);
    const unwrapped = crypto.unwrapSessionKey(wrapped, alice.publicKey, bob.secretKey);
    expect(Array.from(unwrapped)).toEqual(Array.from(sessionKey));
  });

  it('wrapSessionKey rejects non-32-byte session keys', () => {
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    expect(() => crypto.wrapSessionKey(new Uint8Array(16), bob.publicKey, alice.secretKey)).toThrow(/32 bytes/);
  });

  it('unwrapSessionKey rejects payloads that decrypt to non-32-byte plaintext', () => {
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    // Wrap a short blob using raw box() — bypassing the wrapSessionKey length guard.
    const shortPayload = crypto.box(new Uint8Array([1, 2, 3]), bob.publicKey, alice.secretKey);
    expect(() => crypto.unwrapSessionKey(shortPayload, alice.publicKey, bob.secretKey)).toThrow(/not 32 bytes/);
  });

  it('unwrapSessionKey rejects mismatched recipient keys', () => {
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    const mallory = crypto.generateKeypair();
    const sessionKey = crypto.generateSessionKey();
    const wrapped = crypto.wrapSessionKey(sessionKey, bob.publicKey, alice.secretKey);
    expect(() => crypto.unwrapSessionKey(wrapped, alice.publicKey, mallory.secretKey)).toThrow(/decryption failed/);
  });
});
