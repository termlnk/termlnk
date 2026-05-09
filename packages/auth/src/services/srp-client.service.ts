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

// SRP6a registration tuple uploaded to the server.
// `srpSalt` is independent from the Argon2id salt: the former protects against verifier
// replay, the latter stretches the password.
export interface ISrpEnrollment {
  readonly srpSalt: string;
  readonly srpVerifier: string;
}

// `secret` stays in-process; only `public` is sent to the server.
export interface ISrpEphemeral {
  readonly secret: string;
  readonly public: string;
}

// Output of deriveSession. Field names mirror the secure-remote-password library so the
// session value can flow into verifySession without remapping.
//
// `key`   — shared session key (suitable IKM for further channel derivation).
// `proof` — client M1 proof; the server replies with M2.
export interface ISrpClientSession {
  readonly key: string;
  readonly proof: string;
}

// SRP6a client (main-process only). Group/hash follow the secure-remote-password defaults
// (RFC 5054 / SHA-1); a server-side change to either must be mirrored here.
//
// SRP `password` input is the hex-encoded `IMasterKey.authKey`. The plaintext password
// never leaves this process; the server only ever sees a one-shot zero-knowledge proof.
//
// Login is a 5-step exchange:
//   1. Client.generateEphemeral -> send `public` to server.
//   2. Server returns `(srpSalt, serverPublic)`.
//   3. Client.deriveSession -> send `proof`.
//   4. Server returns `serverProof`.
//   5. Client.verifySession asserts the server actually holds the verifier.
export interface ISrpClientService {
  // Used during register; the server stores `(salt, verifier)` and replays salt at next login.
  enroll(username: string, authKeyHex: string): ISrpEnrollment;

  generateEphemeral(): ISrpEphemeral;

  // Throws when the server's ephemeral is malformed (e.g. `B mod N === 0`).
  deriveSession(
    clientSecretEphemeral: string,
    serverPublicEphemeral: string,
    srpSalt: string,
    username: string,
    authKeyHex: string,
  ): ISrpClientSession;

  // Throws on mismatch — callers must treat the entire login as failed and discard the
  // session key, even if deriveSession succeeded.
  verifySession(
    clientPublicEphemeral: string,
    clientSession: ISrpClientSession,
    serverProof: string,
  ): void;
}

export const ISrpClientService = createIdentifier<ISrpClientService>('auth.srp-client-service');
