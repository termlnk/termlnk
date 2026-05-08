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
 * 跨设备备份的资源快照——所有可同步资源在一个对象里。
 *
 * 字段命名采用 snake_case 与表名对齐，便于人工阅读 JSON dump 时直接定位 SQL。
 *
 * 敏感字段（host.credential, host.proxy, ai_provider.apiKey, mcp_server.config）
 * 在快照里**已用本地 SecretCipher 解密为明文**——这一层明文仅在内存中存在，
 * 调用方（BackupService）会立刻用 sync E2EE master key 重新加密成跨设备可移植的密文。
 *
 * 不包含的表（cloud-sync-architecture.md §4.4 决策）：
 * - `chat_session` / `chat_message`：用户决策不同步
 * - `terminal_session_backup`：设备特定 PTY 状态
 * - `mcp_oauth_token`：设备绑定的 OAuth 凭据
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
 * 备份导出/导入仓库——SQL 直读直写 + 凭据双向加解密。
 *
 * 设计要点：
 * - 不复用各业务 Repository 的 changed$ Subject（避免在 wipe-then-bulk-insert 期间触发千次 UI 刷新）；
 *   导入完成后由调用方自行决定是否重启 / 全量刷新。
 * - 导出路径：从表读密文 → SecretCipher.decrypt → 入快照（明文）
 * - 导入路径：从快照取明文 → SecretCipher.encrypt（本设备 key） → 写表（密文）
 *
 * 调用方（BackupService）负责把 IBackupSnapshot 序列化为 JSON 后用 sync E2EE 加密成传输 payload。
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

  /** 全量导出可同步资源（已解密敏感字段，明文仅在内存中存在）。 */
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
   * 把快照写回 DB。当前仅支持 `replace`：先清空 7 张表，再逐张批量插入。
   * 整个操作在事务里，失败回滚——避免半成品状态。
   */
  async importSnapshot(snapshot: IBackupSnapshot, mode: BackupImportMode): Promise<void> {
    if (snapshot.version !== BACKUP_VERSION) {
      throw new Error(`[BackupRepository] unsupported snapshot version: ${snapshot.version}`);
    }
    if (mode !== 'replace') {
      // merge 留给后续 ticket（需要 LWW 比对，目前先不做）
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
