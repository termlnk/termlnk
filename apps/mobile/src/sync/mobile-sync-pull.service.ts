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

import type { IMasterKeyService, ITokenPair, ITokenStorageService } from '@termlnk/auth';
import type { ILogService } from '@termlnk/core';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/ciphers 2.x exports only `.js` subpaths
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { base64ToBytes, bytesToBase64, IMasterKeyService as IMasterKeyServiceId, ITokenStorageService as ITokenStorageServiceId } from '@termlnk/auth';
import { Disposable, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

// `tmsync1:` magic — must match SyncCryptoService in @termlnk/sync-core. ASCII 8 bytes
// followed by 24-byte XChaCha20 nonce and the Poly1305-tagged ciphertext.
const SYNC_PAYLOAD_PREFIX = 'tmsync1:';
const PREFIX_BYTES = new TextEncoder().encode(SYNC_PAYLOAD_PREFIX);
const NONCE_LEN = 24;
const POLY1305_TAG_LEN = 16;

// Resource IDs that the mobile pull recognises. P6.1 only renders `host`; the
// pull endpoint returns whatever the server has — we keep the others around so the
// cursor still advances and a future P6.x can render them without re-pulling.
type MobileResourceId = 'host' | 'config' | 'ai_provider' | 'mcp_server' | 'skill';

// Wire format mirrors @termlnk/sync IPullResponse + base64 payload encoding documented
// inside packages/sync-core/src/services/http-transport.service.ts. Keep this typed
// locally instead of importing @termlnk/sync — that package would drag in `nanoid` and
// other contract-layer dependencies the mobile app does not need yet.
interface WirePatchItem {
  op: 'put' | 'del' | 'clear';
  resource: MobileResourceId;
  entityId: string | null;
  payload: string | null;
  version: number;
}

interface WirePullResponse {
  cursor: string;
  patch: readonly WirePatchItem[];
  lastMutationId: number;
}

// Decrypted host record. The server stores the whole HostRepository row JSON as one
// encrypted payload; we only surface the read-mostly fields the mobile UI shows.
export interface IMobileHost {
  readonly id: string;
  readonly pid: string;
  readonly label: string;
  readonly type: 'host' | 'group' | 'unknown';
  readonly addr?: string;
  readonly port?: number;
  readonly sort?: number;
  readonly tree?: string;
}

export interface IMobileVaultSnapshot {
  readonly hosts: readonly IMobileHost[];
  readonly cursor: string | null;
}

const EMPTY_SNAPSHOT: IMobileVaultSnapshot = { hosts: [], cursor: null };

interface IMobileSyncPullConfig {
  readonly cloudBaseUrl: string | undefined;
  readonly clientId: string;
}

export class MobileSyncPullService extends Disposable {
  private readonly _snapshot$ = new BehaviorSubject<IMobileVaultSnapshot>(EMPTY_SNAPSHOT);
  readonly snapshot$ = this._snapshot$.asObservable();

  private readonly _hosts = new Map<string, IMobileHost>();
  private _cursor: string | null = null;

  constructor(
    private readonly _config: IMobileSyncPullConfig,
    @Inject(IMasterKeyServiceId) private readonly _masterKeyService: IMasterKeyService,
    @Inject(ITokenStorageServiceId) private readonly _tokenStorage: ITokenStorageService,
    @Inject(ILogServiceId) private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    this._snapshot$.complete();
    this._hosts.clear();
    super.dispose();
  }

  // One-shot pull. Returns the number of patch items consumed. Subsequent calls advance
  // the cursor — server replies only with what changed since cursor — so an idle pull
  // is cheap. UI driver calls this on mount + on `refresh` action.
  async pull(): Promise<number> {
    if (!this._config.cloudBaseUrl) {
      throw new Error('cloudBaseUrl is not configured');
    }
    if (!this._masterKeyService.getCurrent()) {
      throw new Error('Master key is locked — log in first');
    }

    const tokens = await this._tokenStorage.load();
    if (!tokens) {
      throw new Error('No access token — log in first');
    }

    const total = await this._pullResource('host', tokens);
    return total;
  }

  private async _pullResource(resource: MobileResourceId, tokens: ITokenPair): Promise<number> {
    const url = new URL('sync/pull', this._normalizeBase(this._config.cloudBaseUrl!));
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({
        clientId: this._config.clientId,
        resource,
        cursor: this._cursor,
      }),
    });

    if (!response.ok) {
      throw new Error(`pull ${resource} failed: HTTP ${response.status}`);
    }

    const body = (await response.json()) as WirePullResponse;
    this._cursor = body.cursor;

    for (const item of body.patch) {
      if (item.resource !== 'host') {
        // Other resources land in the cursor stream but P6.1 only renders hosts.
        continue;
      }
      if (item.op === 'del' && item.entityId) {
        this._hosts.delete(item.entityId);
        continue;
      }
      if (item.op === 'clear') {
        this._hosts.clear();
        continue;
      }
      if (item.op === 'put' && item.entityId && item.payload) {
        const host = this._decryptHost(item.payload);
        if (host) {
          this._hosts.set(item.entityId, host);
        }
      }
    }

    this._publish();
    return body.patch.length;
  }

  private _publish(): void {
    this._snapshot$.next({
      hosts: Array.from(this._hosts.values()).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
      cursor: this._cursor,
    });
  }

  private _decryptHost(payloadB64: string): IMobileHost | null {
    try {
      const ciphertext = base64ToBytes(payloadB64);
      const plaintext = this._decrypt(ciphertext);
      const decoded = new TextDecoder().decode(plaintext);
      const record = JSON.parse(decoded) as Partial<IMobileHost> & { id?: string };
      if (!record.id || !record.label) {
        return null;
      }
      return {
        id: record.id,
        pid: record.pid ?? 'root',
        label: record.label,
        type: record.type ?? 'host',
        addr: record.addr,
        port: record.port,
        sort: record.sort,
        tree: record.tree,
      };
    } catch (err) {
      this._logService.warn('[MobileSyncPullService] failed to decrypt host:', err);
      return null;
    }
  }

  private _decrypt(frame: Uint8Array): Uint8Array {
    if (frame.length < PREFIX_BYTES.length + NONCE_LEN + POLY1305_TAG_LEN) {
      throw new Error('cipher frame too short');
    }
    for (let i = 0; i < PREFIX_BYTES.length; i++) {
      if (frame[i] !== PREFIX_BYTES[i]) {
        throw new Error('cipher frame missing tmsync1 prefix');
      }
    }
    const nonce = frame.slice(PREFIX_BYTES.length, PREFIX_BYTES.length + NONCE_LEN);
    const sealed = frame.slice(PREFIX_BYTES.length + NONCE_LEN);

    const masterKey = this._masterKeyService.getCurrent();
    if (!masterKey) {
      throw new Error('master key locked between pull and decrypt');
    }
    return xchacha20poly1305(masterKey.encKey, nonce).decrypt(sealed);
  }

  private _normalizeBase(base: string): string {
    return base.endsWith('/') ? base : `${base}/`;
  }
}

// Silence unused-import warnings when only the type side is referenced.
export type { ITokenPair };
export { bytesToBase64 };
