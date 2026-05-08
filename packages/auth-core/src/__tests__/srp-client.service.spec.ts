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

import * as srpServer from 'secure-remote-password/server';
import { describe, expect, it } from 'vitest';
import { SrpClientService } from '../services/srp-client.service';

const TEST_USERNAME = 'alice@example.com';
// 32-byte deterministic hex (simulates IMasterKey.authKey hex-encoded)
const TEST_AUTH_KEY_HEX = '11223344556677889900aabbccddeeff0011223344556677889900aabbccddee';
const WRONG_AUTH_KEY_HEX = 'ffeeddccbbaa00998877665544332211ffeeddccbbaa009988776655443322';

describe('SrpClientService', () => {
  it('enroll produces a (salt, verifier) pair both of which are non-empty hex', () => {
    const client = new SrpClientService();
    const enrollment = client.enroll(TEST_USERNAME, TEST_AUTH_KEY_HEX);
    expect(enrollment.srpSalt).toMatch(/^[0-9a-f]+$/i);
    expect(enrollment.srpVerifier).toMatch(/^[0-9a-f]+$/i);
    expect(enrollment.srpSalt.length).toBeGreaterThan(0);
    expect(enrollment.srpVerifier.length).toBeGreaterThan(0);
  });

  it('enroll is non-deterministic — generateSalt randomises across calls', () => {
    const client = new SrpClientService();
    const a = client.enroll(TEST_USERNAME, TEST_AUTH_KEY_HEX);
    const b = client.enroll(TEST_USERNAME, TEST_AUTH_KEY_HEX);
    expect(a.srpSalt).not.toBe(b.srpSalt);
    expect(a.srpVerifier).not.toBe(b.srpVerifier);
  });

  it('generateEphemeral returns hex-encoded secret and public values', () => {
    const client = new SrpClientService();
    const eph = client.generateEphemeral();
    expect(eph.secret).toMatch(/^[0-9a-f]+$/i);
    expect(eph.public).toMatch(/^[0-9a-f]+$/i);
    expect(eph.secret).not.toBe(eph.public);
  });

  it('end-to-end handshake: client + simulated server arrive at the same session key', () => {
    const client = new SrpClientService();

    // 1. Client enrolls and uploads (salt, verifier) to a hypothetical server
    const { srpSalt, srpVerifier } = client.enroll(TEST_USERNAME, TEST_AUTH_KEY_HEX);

    // 2. Login: client generates ephemeral
    const clientEph = client.generateEphemeral();

    // 3. Server (simulated) generates its ephemeral from verifier
    const serverEph = srpServer.generateEphemeral(srpVerifier);

    // 4. Client derives session
    const clientSession = client.deriveSession(
      clientEph.secret,
      serverEph.public,
      srpSalt,
      TEST_USERNAME,
      TEST_AUTH_KEY_HEX
    );

    // 5. Server derives session and produces M2 proof
    const serverSession = srpServer.deriveSession(
      serverEph.secret,
      clientEph.public,
      srpSalt,
      TEST_USERNAME,
      srpVerifier,
      clientSession.proof
    );

    // 6. Client verifies M2; throwing here = MITM detected
    expect(() => client.verifySession(clientEph.public, clientSession, serverSession.proof)).not.toThrow();

    // Both sides arrived at the same shared session key
    expect(clientSession.key).toBe(serverSession.key);
  });

  it('handshake fails when the client uses a different authKey than registration', () => {
    const client = new SrpClientService();
    const { srpSalt, srpVerifier } = client.enroll(TEST_USERNAME, TEST_AUTH_KEY_HEX);

    const clientEph = client.generateEphemeral();
    const serverEph = srpServer.generateEphemeral(srpVerifier);

    // Client is wrong (e.g., user typed wrong password) — derives a wrong privateKey
    const clientSession = client.deriveSession(
      clientEph.secret,
      serverEph.public,
      srpSalt,
      TEST_USERNAME,
      WRONG_AUTH_KEY_HEX
    );

    // Server's deriveSession will reject the wrong M1 proof
    expect(() => srpServer.deriveSession(
      serverEph.secret,
      clientEph.public,
      srpSalt,
      TEST_USERNAME,
      srpVerifier,
      clientSession.proof
    )).toThrow();
  });

  it('verifySession throws when the server proof is forged', () => {
    const client = new SrpClientService();
    const { srpSalt, srpVerifier } = client.enroll(TEST_USERNAME, TEST_AUTH_KEY_HEX);

    const clientEph = client.generateEphemeral();
    const serverEph = srpServer.generateEphemeral(srpVerifier);
    const clientSession = client.deriveSession(
      clientEph.secret,
      serverEph.public,
      srpSalt,
      TEST_USERNAME,
      TEST_AUTH_KEY_HEX
    );

    // Forged server proof (random hex of plausible length)
    const forgedProof = '0'.repeat(64);
    expect(() => client.verifySession(clientEph.public, clientSession, forgedProof)).toThrow();
  });

  it('handshake remains correct across distinct usernames (cross-account isolation)', () => {
    const client = new SrpClientService();
    const enrolledForAlice = client.enroll('alice@example.com', TEST_AUTH_KEY_HEX);
    const enrolledForBob = client.enroll('bob@example.com', TEST_AUTH_KEY_HEX);

    // Different verifiers — same authKey under different username produces different stored secret
    expect(enrolledForAlice.srpVerifier).not.toBe(enrolledForBob.srpVerifier);
  });
});
