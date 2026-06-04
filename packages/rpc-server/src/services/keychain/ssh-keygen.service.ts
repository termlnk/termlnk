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

import type { SshKeyAlgorithm } from '@termlnk/terminal';
import type { Buffer } from 'node:buffer';
import type { utils } from 'ssh2';
import { createIdentifier, Disposable } from '@termlnk/core';
import ssh2 from 'ssh2';
import { sha256Fingerprint } from '../ssh/host-key-fingerprint';

export interface IGenerateKeyOptions {
  algorithm: SshKeyAlgorithm;
  /** ecdsa: 256/384/521; rsa: 1024/2048/4096; ignored for ed25519. */
  bits?: number;
  comment?: string;
  passphrase?: string;
  /** Cipher protecting the private key (only used when passphrase is set). */
  cipher?: string;
  /** bcrypt KDF rounds (only used when passphrase is set). */
  rounds?: number;
}

export interface IGeneratedKeyMaterial {
  algorithm: SshKeyAlgorithm;
  bits?: number;
  privateKey: string;
  publicKey: string;
  fingerprint: string;
}

export interface ISshKeygenService {
  generate(options: IGenerateKeyOptions): IGeneratedKeyMaterial;
  /** Validate an imported private key and derive its public key + fingerprint. Throws on failure. */
  parseImported(privateKey: string, passphrase?: string): IGeneratedKeyMaterial;
}

export const ISshKeygenService = createIdentifier<ISshKeygenService>('rpc-server.ssh-keygen-service');

const ECDSA_DEFAULT_BITS = 256;
const RSA_DEFAULT_BITS = 4096;
const sshUtils = ssh2.utils;

export class SshKeygenService extends Disposable implements ISshKeygenService {
  generate(options: IGenerateKeyOptions): IGeneratedKeyMaterial {
    const common = options.passphrase
      ? { comment: options.comment ?? '', passphrase: options.passphrase, cipher: options.cipher ?? 'aes256-ctr', rounds: options.rounds ?? 16 }
      : { comment: options.comment ?? '' };

    let pair: utils.KeyPairReturn;
    let bits: number | undefined;
    switch (options.algorithm) {
      case 'rsa':
        bits = options.bits ?? RSA_DEFAULT_BITS;
        pair = sshUtils.generateKeyPairSync('rsa', { bits, ...common });
        break;
      case 'ecdsa':
        bits = (options.bits ?? ECDSA_DEFAULT_BITS) as 256 | 384 | 521;
        pair = sshUtils.generateKeyPairSync('ecdsa', { bits: bits as 256 | 384 | 521, ...common });
        break;
      case 'ed25519':
        bits = undefined;
        pair = sshUtils.generateKeyPairSync('ed25519', common);
        break;
    }

    return {
      algorithm: options.algorithm,
      bits,
      privateKey: pair.private,
      publicKey: pair.public,
      fingerprint: this._fingerprintOf(pair.public),
    };
  }

  parseImported(privateKey: string, passphrase?: string): IGeneratedKeyMaterial {
    const parsed = sshUtils.parseKey(privateKey, passphrase);
    if (parsed instanceof Error) {
      throw new Error(`[SshKeygenService] Invalid private key or wrong passphrase: ${parsed.message}`);
    }
    const wire = parsed.getPublicSSH();
    return {
      algorithm: this._normalizeAlgorithm(parsed.type),
      bits: undefined,
      privateKey,
      publicKey: this._toOpenSshLine(wire, parsed.comment),
      fingerprint: sha256Fingerprint(wire),
    };
  }

  private _fingerprintOf(publicKeyLine: string): string {
    const parsed = sshUtils.parseKey(publicKeyLine);
    if (parsed instanceof Error) {
      throw new Error(`[SshKeygenService] Failed to parse generated public key: ${parsed.message}`);
    }
    return sha256Fingerprint(parsed.getPublicSSH());
  }

  // The SSH wire key is prefixed with its algorithm name — exactly an authorized_keys line.
  private _toOpenSshLine(wire: Buffer, comment: string): string {
    const algoLen = wire.readUInt32BE(0);
    const algo = wire.subarray(4, 4 + algoLen).toString('ascii');
    const blob = wire.toString('base64');
    return comment ? `${algo} ${blob} ${comment}` : `${algo} ${blob}`;
  }

  private _normalizeAlgorithm(type: string): SshKeyAlgorithm {
    if (type === 'rsa' || type === 'ecdsa' || type === 'ed25519') {
      return type;
    }
    // ssh2 reports e.g. 'ssh-rsa' / 'ssh-ed25519' / 'ecdsa-sha2-nistp256' in some paths.
    if (type.includes('ed25519')) {
      return 'ed25519';
    }
    if (type.includes('ecdsa')) {
      return 'ecdsa';
    }
    return 'rsa';
  }
}
