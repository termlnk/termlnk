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

import type { ACPSessionStatus, IACPSessionInfo } from '@termlnk/acp';
import { Disposable, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';

const STORE_KEY = 'acp.sessions';
const SESSIONS_FIELD = 'sessions';

interface IStoredACPSession {
  id: string;
  providerId: string;
  providerTitle: string;
  cwd: string;
  nativeSessionId?: string;
  title?: string;
  lastStatus: ACPSessionStatus;
  hostId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Metadata-only persistence (D4). Conversation history is owned by the agent
 * and restored via session/load; we only keep enough to rebuild tabs.
 */
export class ACPSessionStore extends Disposable {
  constructor(
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository
  ) {
    super();
  }

  async list(): Promise<IStoredACPSession[]> {
    const stored = await this._configRepository.getField<IStoredACPSession[]>(
      STORE_KEY,
      SESSIONS_FIELD
    );
    return Array.isArray(stored) ? stored : [];
  }

  async upsert(info: IACPSessionInfo): Promise<void> {
    const all = await this.list();
    const row = toStored(info);
    const idx = all.findIndex((s) => s.id === row.id);
    if (idx === -1) {
      all.push(row);
    } else {
      all[idx] = row;
    }
    await this._configRepository.setField(STORE_KEY, SESSIONS_FIELD, all);
  }

  async remove(sessionId: string): Promise<void> {
    const all = await this.list();
    const next = all.filter((s) => s.id !== sessionId);
    if (next.length === all.length) {
      return;
    }
    await this._configRepository.setField(STORE_KEY, SESSIONS_FIELD, next);
  }

  async get(sessionId: string): Promise<IStoredACPSession | undefined> {
    const all = await this.list();
    return all.find((s) => s.id === sessionId);
  }
}

function toStored(info: IACPSessionInfo): IStoredACPSession {
  return {
    id: info.id,
    providerId: info.providerId,
    providerTitle: info.providerTitle,
    cwd: info.cwd,
    nativeSessionId: info.nativeSessionId,
    title: info.title,
    lastStatus: info.status === 'streaming' || info.status === 'connecting' ? 'ready' : info.status,
    hostId: info.hostId,
    createdAt: info.createdAt,
    updatedAt: info.updatedAt,
  };
}
