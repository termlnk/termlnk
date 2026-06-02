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

import type { Observable } from 'rxjs';
import type { IWebServerConfig } from '../controllers/config.schema';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/hashes 2.x exports only `.js` subpaths
import { hkdf } from '@noble/hashes/hkdf.js';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/hashes 2.x exports only `.js` subpaths
import { sha256 } from '@noble/hashes/sha2.js';
import { HKDF_INFO, MASTER_KEY_DERIVATION } from '@termlnk/auth';
import { createIdentifier, Disposable, IConfigService, ILogService } from '@termlnk/core';
import { argon2id } from 'hash-wasm';
import { BehaviorSubject } from 'rxjs';
import { WEB_SERVER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';

/**
 * Lifecycle status of the in-process master key.
 *
 * - `pending`: not yet initialised (server still starting).
 * - `unlocked`: master key + access verifier are in memory; tRPC procedures
 *   that need the master key can run.
 * - `error`: master password could not be sourced or KDF failed; the server
 *   refuses to expose business RPC. Caller (UI / log) reads `errorMessage`.
 */
export type MasterKeyStatus = 'pending' | 'unlocked' | 'error';

export interface IMasterKeyStateSnapshot {
  readonly status: MasterKeyStatus;
  readonly errorMessage: string | null;
}

const INITIAL_STATE: IMasterKeyStateSnapshot = { status: 'pending', errorMessage: null };

/**
 * Verifier shape returned by `getAccessVerifier`. Stored in process memory only;
 * never persisted in the v1 design — restart re-derives from env / file.
 *
 * `salt` and `verifier` are 32 bytes each; the salt is fresh per process boot
 * so an attacker that ever got hold of an old verifier byte-stream cannot
 * mount an offline check against future logins.
 */
export interface IAccessVerifier {
  readonly salt: Uint8Array;
  readonly verifier: Uint8Array;
}

export interface IMasterKeyHolderService {
  readonly state$: Observable<IMasterKeyStateSnapshot>;

  /** Synchronous snapshot for non-reactive callers. */
  getState(): IMasterKeyStateSnapshot;

  /**
   * Run the boot-time master-password handshake:
   *   1. Resolve plaintext password from masterPassword > env.
   *   2. Derive master key (Argon2id with shared MASTER_KEY_DERIVATION params).
   *   3. Derive sub-keys (auth / enc / index) with HKDF-SHA256.
   *   4. Compute access verifier (independent Argon2id with a fresh per-boot salt).
   *   5. Wipe the plaintext password buffer.
   *   6. Flip state to `unlocked`.
   * On failure flips state to `error` with a clear message.
   */
  initialize(): Promise<void>;

  /** Returns true once `unlocked`. Useful for guarding RPC procedures. */
  isUnlocked(): boolean;

  /** Master key (32 bytes). Throws when not unlocked. */
  getMasterKey(): Uint8Array;

  /** Sub-keys derived via HKDF (auth / enc / index). Throws when not unlocked. */
  getSubKeys(): { authKey: Uint8Array; encKey: Uint8Array; indexKey: Uint8Array };

  /** Access verifier (salt + Argon2id hash). Throws when not unlocked. */
  getAccessVerifier(): IAccessVerifier;

  /**
   * Verify a candidate password supplied via the browser login endpoint.
   * Constant-time on the digest comparison; the Argon2id call dwarfs any
   * timing leak in a `=== `-style check anyway, but we still go through
   * `timingSafeEqual` for hygiene.
   */
  verifyAccess(candidate: string): Promise<boolean>;
}

export const IMasterKeyHolderService = createIdentifier<IMasterKeyHolderService>(
  'web-server.master-key-holder.service'
);

/**
 * Salt used to lift the deployer's password into a 32-byte master key. Single
 * tenant per termlnk-web instance, so no per-account separation is needed —
 * a fixed salt is fine for v1. The string is intentionally domain-tagged so
 * leaking it cannot speed up dictionary attacks against a different KDF use.
 */
const MASTER_KEY_FIXED_SALT = new TextEncoder().encode('termlnk-web/v1/master-key');

/**
 * Domain tag for the access verifier KDF. Re-uses MASTER_KEY_DERIVATION
 * parameters (Argon2id m=64MiB t=3 p=4) so deriving + verifying are equally
 * GPU-resistant; the salt rolls per process boot.
 */
const ACCESS_VERIFIER_DOMAIN = new TextEncoder().encode('termlnk-web/v1/access-verifier');

const SALT_LEN = 32;
const VERIFIER_LEN = 32;
const TEXT_ENCODER = new TextEncoder();

export class MasterKeyHolderService extends Disposable implements IMasterKeyHolderService {
  private readonly _state$ = new BehaviorSubject<IMasterKeyStateSnapshot>(INITIAL_STATE);
  readonly state$: Observable<IMasterKeyStateSnapshot> = this._state$.asObservable();

  private _masterKey: Uint8Array | null = null;
  private _authKey: Uint8Array | null = null;
  private _encKey: Uint8Array | null = null;
  private _indexKey: Uint8Array | null = null;
  private _accessVerifier: IAccessVerifier | null = null;

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._zeroizeAll();
    this._state$.complete();
  }

  getState(): IMasterKeyStateSnapshot {
    return this._state$.getValue();
  }

  isUnlocked(): boolean {
    return this._state$.getValue().status === 'unlocked';
  }

  getMasterKey(): Uint8Array {
    this._assertUnlocked();
    return this._masterKey!;
  }

  getSubKeys(): { authKey: Uint8Array; encKey: Uint8Array; indexKey: Uint8Array } {
    this._assertUnlocked();
    return { authKey: this._authKey!, encKey: this._encKey!, indexKey: this._indexKey! };
  }

  getAccessVerifier(): IAccessVerifier {
    this._assertUnlocked();
    return this._accessVerifier!;
  }

  async initialize(): Promise<void> {
    if (this._state$.getValue().status === 'unlocked') {
      return;
    }
    let password: string | null = null;
    try {
      password = await this._resolveMasterPassword();
      const masterKey = await argon2id({
        password,
        salt: MASTER_KEY_FIXED_SALT,
        parallelism: MASTER_KEY_DERIVATION.parallelism,
        iterations: MASTER_KEY_DERIVATION.iterations,
        memorySize: MASTER_KEY_DERIVATION.memoryKiB,
        hashLength: MASTER_KEY_DERIVATION.outputBytes,
        outputType: 'binary',
      });

      const subKeys = this._deriveSubKeys(masterKey);
      const accessVerifier = await this._deriveAccessVerifier(password);

      this._masterKey = masterKey;
      this._authKey = subKeys.authKey;
      this._encKey = subKeys.encKey;
      this._indexKey = subKeys.indexKey;
      this._accessVerifier = accessVerifier;

      this._state$.next({ status: 'unlocked', errorMessage: null });
      this._logService.log('[MasterKeyHolderService] master key unlocked from environment source');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._zeroizeAll();
      this._state$.next({ status: 'error', errorMessage: message });
      this._logService.error(`[MasterKeyHolderService] initialize failed: ${message}`);
      throw err;
    } finally {
      // Best-effort wipe of the JS string. V8 may have copied it elsewhere
      // already, but we drop our own reference immediately.
      password = null;
    }
  }

  async verifyAccess(candidate: string): Promise<boolean> {
    if (!this.isUnlocked()) {
      return false;
    }
    const verifier = this._accessVerifier!;
    const candidateHash = await this._argon2idVerifier(candidate, verifier.salt);
    try {
      return timingSafeEqualBytes(candidateHash, verifier.verifier);
    } finally {
      candidateHash.fill(0);
    }
  }

  private _assertUnlocked(): void {
    if (!this.isUnlocked()) {
      throw new Error('[MasterKeyHolderService] master key is not unlocked');
    }
  }

  private async _resolveMasterPassword(): Promise<string> {
    const cfg = this._configService.getConfig<IWebServerConfig>(WEB_SERVER_PLUGIN_CONFIG_KEY) ?? {};
    if (cfg.masterPassword && cfg.masterPassword.length > 0) {
      return cfg.masterPassword;
    }
    const envName = cfg.masterPasswordEnv ?? 'TERMLNK_MASTER_PASSWORD';

    // Docker/k8s secrets convention: `<ENV>_FILE` points at a mounted file
    // (e.g. /run/secrets/master_password) so the password never lands in the
    // container's environment or `docker inspect` output. Takes precedence over
    // the inline env var when both are set.
    const fromFile = await this._readPasswordFile(`${envName}_FILE`);
    if (fromFile) {
      return fromFile;
    }

    const fromEnv = process.env[envName];
    if (fromEnv && fromEnv.length > 0) {
      return fromEnv;
    }
    throw new Error(
      '[MasterKeyHolderService] no master password source available — '
      + `set masterPassword, env "${envName}", or secrets file env "${envName}_FILE"`
    );
  }

  private async _readPasswordFile(fileEnvName: string): Promise<string | null> {
    const filePath = process.env[fileEnvName]?.trim();
    if (!filePath) {
      return null;
    }
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[MasterKeyHolderService] cannot read master password file "${filePath}" (from ${fileEnvName}): ${reason}`
      );
    }
    // Strip UTF-8 BOM (silent corruption on Windows-edited secrets) and a single
    // trailing newline (`echo > secret` adds one). Other whitespace could be a
    // deliberate part of the passphrase, so preserve it.
    const password = raw.replace(/^\uFEFF/, '').replace(/\r?\n$/, '');
    if (password.length === 0) {
      throw new Error(
        `[MasterKeyHolderService] master password file "${filePath}" (from ${fileEnvName}) is empty`
      );
    }
    return password;
  }

  private _deriveSubKeys(masterKey: Uint8Array): { authKey: Uint8Array; encKey: Uint8Array; indexKey: Uint8Array } {
    const empty = new Uint8Array(0);
    return {
      authKey: hkdf(sha256, masterKey, empty, TEXT_ENCODER.encode(HKDF_INFO.AUTH), MASTER_KEY_DERIVATION.outputBytes),
      encKey: hkdf(sha256, masterKey, empty, TEXT_ENCODER.encode(HKDF_INFO.ENC), MASTER_KEY_DERIVATION.outputBytes),
      indexKey: hkdf(sha256, masterKey, empty, TEXT_ENCODER.encode(HKDF_INFO.INDEX), MASTER_KEY_DERIVATION.outputBytes),
    };
  }

  private async _deriveAccessVerifier(password: string): Promise<IAccessVerifier> {
    const saltSeed = new Uint8Array(randomBytes(SALT_LEN));
    // Mix in a domain tag so a leaked verifier cannot be cross-replayed against
    // any other Argon2id usage in the system that might share salt material.
    const salt = new Uint8Array(saltSeed.length + ACCESS_VERIFIER_DOMAIN.length);
    salt.set(saltSeed, 0);
    salt.set(ACCESS_VERIFIER_DOMAIN, saltSeed.length);
    const verifier = await this._argon2idVerifier(password, salt);
    return { salt, verifier };
  }

  private async _argon2idVerifier(password: string, salt: Uint8Array): Promise<Uint8Array> {
    return await argon2id({
      password,
      salt,
      parallelism: MASTER_KEY_DERIVATION.parallelism,
      iterations: MASTER_KEY_DERIVATION.iterations,
      memorySize: MASTER_KEY_DERIVATION.memoryKiB,
      hashLength: VERIFIER_LEN,
      outputType: 'binary',
    });
  }

  private _zeroizeAll(): void {
    zeroize(this._masterKey);
    zeroize(this._authKey);
    zeroize(this._encKey);
    zeroize(this._indexKey);
    if (this._accessVerifier) {
      zeroize(this._accessVerifier.verifier);
      zeroize(this._accessVerifier.salt);
    }
    this._masterKey = null;
    this._authKey = null;
    this._encKey = null;
    this._indexKey = null;
    this._accessVerifier = null;
  }
}

function zeroize(buf: Uint8Array | null): void {
  if (buf) {
    buf.fill(0);
  }
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}
