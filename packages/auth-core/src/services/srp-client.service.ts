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

import type { ISrpClientService, ISrpClientSession, ISrpEnrollment, ISrpEphemeral } from '@termlnk/auth';
import { Disposable } from '@termlnk/core';
import * as srp from 'secure-remote-password/client';

// Thin wrapper around `secure-remote-password/client`. This module deliberately does NOT
// derive the master key — callers must hex-encode `IMasterKey.authKey` and pass it as
// `authKeyHex`. Splitting derivation from the SRP protocol keeps tests fast (no Argon2id)
// and lets us swap SRP libraries without touching KDF code.
export class SrpClientService extends Disposable implements ISrpClientService {
  enroll(username: string, authKeyHex: string): ISrpEnrollment {
    const srpSalt = srp.generateSalt();
    const privateKey = srp.derivePrivateKey(srpSalt, username, authKeyHex);
    const srpVerifier = srp.deriveVerifier(privateKey);
    return { srpSalt, srpVerifier };
  }

  generateEphemeral(): ISrpEphemeral {
    const ephemeral = srp.generateEphemeral();
    return { secret: ephemeral.secret, public: ephemeral.public };
  }

  deriveSession(
    clientSecretEphemeral: string,
    serverPublicEphemeral: string,
    srpSalt: string,
    username: string,
    authKeyHex: string
  ): ISrpClientSession {
    const privateKey = srp.derivePrivateKey(srpSalt, username, authKeyHex);
    const session = srp.deriveSession(
      clientSecretEphemeral,
      serverPublicEphemeral,
      srpSalt,
      username,
      privateKey
    );
    return { key: session.key, proof: session.proof };
  }

  verifySession(
    clientPublicEphemeral: string,
    clientSession: ISrpClientSession,
    serverProof: string
  ): void {
    srp.verifySession(clientPublicEphemeral, clientSession, serverProof);
  }
}
