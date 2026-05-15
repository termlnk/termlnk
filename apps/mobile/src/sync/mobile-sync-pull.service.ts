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
import type { Observable } from 'rxjs';
import type { IMobileHost, IMobileHostFull } from '../storage/types';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/ciphers 2.x exports only `.js` subpaths
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { base64ToBytes, IMasterKeyService as IMasterKeyServiceId, ITokenStorageService as ITokenStorageServiceId } from '@termlnk/auth';
import { Disposable, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { IMobileHostRepository } from '../storage/mobile-host-repository';

// `tmsync1:` magic — must match SyncCryptoService in @termlnk/sync-core. ASCII 8 bytes
// followed by 24-byte XChaCha20 nonce and the Poly1305-tagged ciphertext.
const SYNC_PAYLOAD_PREFIX = 'tmsync1:';
const PREFIX_BYTES = new TextEncoder().encode(SYNC_PAYLOAD_PREFIX);
const NONCE_LEN = 24;
const POLY1305_TAG_LEN = 16;
const HOST_RESOURCE = 'host' as const;

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

// Shape of a decrypted host JSON from the sync payload. Mirrors the desktop's
// IHostEntity row JSON — see HostSynchroniser._buildUpsertMutation. Any field we don't
// recognise here flows through to MobileHostRepository as-is.
interface WireHostEntity {
  id?: string;
  pid?: string;
  tree?: string;
  label?: string;
  type?: 'host' | 'group' | 'unknown';
  addr?: string;
  port?: number;
  sort?: number;
  credential?: IMobileHostFull['credential'];
  proxy?: IMobileHostFull['proxy'];
  settings?: IMobileHostFull['settings'];
  hostChainIds?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
}

interface IMobileSyncPullConfig {
  readonly cloudBaseUrl: string | undefined;
  readonly clientId: string;
}

export class MobileSyncPullService extends Disposable {
  // Cursor in memory mirrors the persisted sync_meta cursor — kept in sync via _loadCursor
  // / _persistCursor. The previous in-memory hosts Map is gone; the repository owns state.
  private _cursor: string | null = null;
  private _cursorLoaded = false;

  // Re-export the repo's hosts$ so callers (terminal.tsx / sftp.tsx) don't have to import
  // the repo identifier directly. Snapshot semantics match the previous IMobileVaultSnapshot
  // but flat — UI only ever wanted the hosts list.
  readonly hosts$: Observable<readonly IMobileHost[]>;

  // Field declarations are separated from constructor parameters because
  // babel-plugin-parameter-decorator cannot pair a parameter decorator with a TypeScript
  // parameter property — see apps/mobile/babel.config.js. Non-decorated parameters share
  // the same convention here for consistency.
  private readonly _config: IMobileSyncPullConfig;
  private readonly _masterKeyService: IMasterKeyService;
  private readonly _tokenStorage: ITokenStorageService;
  private readonly _logService: ILogService;
  private readonly _hostRepo: IMobileHostRepository;

  constructor(
    config: IMobileSyncPullConfig,
    @Inject(IMasterKeyServiceId) masterKeyService: IMasterKeyService,
    @Inject(ITokenStorageServiceId) tokenStorage: ITokenStorageService,
    @Inject(ILogServiceId) logService: ILogService,
    @Inject(IMobileHostRepository) hostRepo: IMobileHostRepository
  ) {
    super();
    this._config = config;
    this._masterKeyService = masterKeyService;
    this._tokenStorage = tokenStorage;
    this._logService = logService;
    this._hostRepo = hostRepo;
    this.hosts$ = this._hostRepo.hosts$;
    // Fire off repository read so persisted hosts surface in hosts$ before the first pull
    // resolves. Errors are logged but non-fatal — the worst case is an empty list until pull.
    void this._hostRepo.ready().catch((err) => {
      this._logService.warn('[MobileSyncPullService] repo ready failed:', err);
    });
  }

  override dispose(): void {
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

    await this._ensureCursorLoaded();
    const total = await this._pullResource(HOST_RESOURCE, tokens);
    return total;
  }

  private async _ensureCursorLoaded(): Promise<void> {
    if (this._cursorLoaded) {
      return;
    }
    this._cursor = await this._hostRepo.getCursor(HOST_RESOURCE);
    this._cursorLoaded = true;
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
      if (item.op === 'clear') {
        await this._hostRepo.clearFromSync();
        continue;
      }
      if (!item.entityId) {
        continue;
      }
      if (item.op === 'del') {
        await this._hostRepo.deleteFromSync(item.entityId);
        continue;
      }
      if (item.op === 'put' && item.payload) {
        const host = this._decryptHost(item.entityId, item.payload);
        if (host) {
          await this._hostRepo.upsertFromSync(host);
        }
      }
    }

    await this._hostRepo.setCursor(HOST_RESOURCE, this._cursor);
    return body.patch.length;
  }

  private _decryptHost(entityId: string, payloadB64: string): IMobileHostFull | null {
    try {
      const ciphertext = base64ToBytes(payloadB64);
      const plaintext = this._decrypt(ciphertext);
      const decoded = new TextDecoder().decode(plaintext);
      const record = JSON.parse(decoded) as WireHostEntity;
      if (!record.label) {
        return null;
      }
      const id = record.id ?? entityId;
      return {
        id,
        pid: record.pid ?? 'root',
        tree: record.tree,
        label: record.label,
        type: record.type ?? 'host',
        addr: record.addr,
        port: record.port,
        sort: record.sort ?? 0,
        // hasCredential is derived in the repo's rowToHost; it's set here for downstream
        // upserts that don't go through the row mapper.
        hasCredential: record.credential != null,
        credential: record.credential ?? null,
        proxy: record.proxy ?? null,
        settings: record.settings ?? null,
        hostChainIds: record.hostChainIds ?? null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    } catch (err) {
      this._logService.warn(`[MobileSyncPullService] failed to decrypt host ${entityId}:`, err);
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

// Re-export the public host shape so screens don't have to import from ../storage/types.
export type { IMobileHost, IMobileHostFull } from '../storage/types';
