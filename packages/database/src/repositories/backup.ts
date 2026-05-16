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

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { IAICustomModelEntity, IAIProviderEntity, IAIProviderModelEntity, IConfigEntity, IHostEntity, IMcpServerEntity, ISkillEntity } from '../entities';
import { Disposable } from '@termlnk/core';
import { aiCustomModelEntity, aiProviderEntity, aiProviderModelEntity, configEntity, hostEntity, mcpServerEntity, skillEntity } from '../entities';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import { decryptCredential, decryptIfNeeded, decryptMcpConfig, decryptProxy, encryptCredential, encryptIfNeeded, encryptMcpConfig, encryptProxy } from '../services/secret-cipher/credential-masker';

/**
 * Cross-device backup snapshot — all syncable resources in one object.
 *
 * Field names are snake_case to mirror table names so a human reading the JSON
 * dump can locate the SQL directly.
 *
 * Sensitive fields (host.credential, host.proxy, ai_provider.apiKey,
 * mcp_server.config) are **decrypted to plaintext using the local
 * SecretCipher** inside the snapshot. That plaintext only lives in memory; the
 * caller (BackupService) immediately re-encrypts it with the sync E2EE master
 * key for transport.
 *
 * Excluded by design (cloud-sync-architecture.md §4.4):
 * - `chat_session` / `chat_message` — product decision: not synced
 * - `terminal_session_backup` — device-specific PTY state
 * - `mcp_oauth_token` — device-bound OAuth credentials
 */
export interface IBackupSnapshot {
  readonly version: 1;
  readonly exportedAt: number;
  readonly resources: {
    readonly host: readonly IHostEntity[];
    readonly config: readonly IConfigEntity[];
    readonly ai_provider: readonly IAIProviderEntity[];
    readonly ai_provider_model: readonly IAIProviderModelEntity[];
    readonly ai_custom_model: readonly IAICustomModelEntity[];
    readonly mcp_server: readonly IMcpServerEntity[];
    readonly skill: readonly ISkillEntity[];
  };
}

export type BackupImportMode = 'replace' | 'merge';

const BACKUP_VERSION = 1 as const;

/**
 * Backup export/import repository — direct SQL with two-way credential
 * cipher.
 *
 * Bypasses each business repository's `changed$` Subject so a wipe-then-bulk
 * import does not fire thousands of UI refresh events; the caller decides
 * whether to restart or full-reload afterwards.
 *
 * - Export: read encrypted row → SecretCipher.decrypt → plaintext into snapshot
 * - Import: plaintext from snapshot → SecretCipher.encrypt (this device's key)
 *   → encrypted row into table
 *
 * The caller (BackupService) serializes `IBackupSnapshot` to JSON and wraps it
 * with sync E2EE for transport.
 */
export class BackupRepository extends Disposable {
  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService,
    @ISecretCipherService private readonly _cipher: ISecretCipherService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  /** Export every syncable resource; sensitive fields are decrypted in-memory. */
  async exportSnapshot(): Promise<IBackupSnapshot> {
    const [host, config, aiProvider, aiProviderModel, aiCustomModel, mcpServer, skill] = await Promise.all([
      this._db.select().from(hostEntity),
      this._db.select().from(configEntity),
      this._db.select().from(aiProviderEntity),
      this._db.select().from(aiProviderModelEntity),
      this._db.select().from(aiCustomModelEntity),
      this._db.select().from(mcpServerEntity),
      this._db.select().from(skillEntity),
    ]);

    return {
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      resources: {
        host: host.map((row) => this._decryptHost(row)),
        config,
        ai_provider: aiProvider.map((row) => this._decryptProvider(row)),
        ai_provider_model: aiProviderModel,
        ai_custom_model: aiCustomModel,
        mcp_server: mcpServer.map((row) => this._decryptMcpServer(row)),
        skill,
      },
    };
  }

  /**
   * Restore a snapshot into the DB. Only `replace` is supported today: wipe
   * the seven tables and bulk-insert. The whole thing runs in one transaction
   * so a failure rolls back to a clean state.
   */
  async importSnapshot(snapshot: IBackupSnapshot, mode: BackupImportMode): Promise<void> {
    if (snapshot.version !== BACKUP_VERSION) {
      throw new Error(`[BackupRepository] unsupported snapshot version: ${snapshot.version}`);
    }
    if (mode !== 'replace') {
      // merge mode needs LWW reconciliation; deferred.
      throw new Error(`[BackupRepository] mode '${mode}' not yet supported; only 'replace'`);
    }

    const encryptedHost = snapshot.resources.host.map((row) => this._encryptHost(row));
    const encryptedProvider = snapshot.resources.ai_provider.map((row) => this._encryptProvider(row));
    const encryptedMcpServer = snapshot.resources.mcp_server.map((row) => this._encryptMcpServer(row));

    this._db.transaction((tx) => {
      tx.delete(hostEntity).run();
      tx.delete(configEntity).run();
      tx.delete(aiProviderModelEntity).run();
      tx.delete(aiCustomModelEntity).run();
      tx.delete(aiProviderEntity).run();
      tx.delete(mcpServerEntity).run();
      tx.delete(skillEntity).run();

      if (encryptedHost.length > 0) {
        tx.insert(hostEntity).values(encryptedHost).run();
      }
      if (snapshot.resources.config.length > 0) {
        tx.insert(configEntity).values([...snapshot.resources.config]).run();
      }
      if (encryptedProvider.length > 0) {
        tx.insert(aiProviderEntity).values(encryptedProvider).run();
      }
      if (snapshot.resources.ai_provider_model.length > 0) {
        tx.insert(aiProviderModelEntity).values([...snapshot.resources.ai_provider_model]).run();
      }
      if (snapshot.resources.ai_custom_model.length > 0) {
        tx.insert(aiCustomModelEntity).values([...snapshot.resources.ai_custom_model]).run();
      }
      if (encryptedMcpServer.length > 0) {
        tx.insert(mcpServerEntity).values(encryptedMcpServer).run();
      }
      if (snapshot.resources.skill.length > 0) {
        tx.insert(skillEntity).values([...snapshot.resources.skill]).run();
      }
    });
  }

  private _decryptHost(row: IHostEntity): IHostEntity {
    return {
      ...row,
      credential: decryptCredential(row.credential, this._cipher),
      proxy: decryptProxy(row.proxy, this._cipher),
    };
  }

  private _encryptHost(row: IHostEntity): IHostEntity {
    return {
      ...row,
      credential: encryptCredential(row.credential, this._cipher),
      proxy: encryptProxy(row.proxy, this._cipher),
    };
  }

  private _decryptProvider(row: IAIProviderEntity): IAIProviderEntity {
    return {
      ...row,
      apiKey: decryptIfNeeded(row.apiKey, this._cipher),
    };
  }

  private _encryptProvider(row: IAIProviderEntity): IAIProviderEntity {
    return {
      ...row,
      apiKey: encryptIfNeeded(row.apiKey, this._cipher),
    };
  }

  private _decryptMcpServer(row: IMcpServerEntity): IMcpServerEntity {
    return {
      ...row,
      config: decryptMcpConfig(row.config, this._cipher) ?? row.config,
    };
  }

  private _encryptMcpServer(row: IMcpServerEntity): IMcpServerEntity {
    return {
      ...row,
      config: encryptMcpConfig(row.config, this._cipher) ?? row.config,
    };
  }
}
