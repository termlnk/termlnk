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

import type { IConfigService, ILogService, LogLevel } from '@termlnk/core';
import type { CollabInviteTokenRepository, ICollabInviteTokenEntity, ICollabInviteTokenEntityInsert } from '@termlnk/database';
import type { ICollabInviteCreateInput, ICollabInviteTransportService } from '@termlnk/shared-terminal';
import { ConfigService, IConfigService as IConfigServiceId, Injector } from '@termlnk/core';
import { SHARED_TERMINAL_PLUGIN_CONFIG_KEY, SharedTerminalRole } from '@termlnk/shared-terminal';
import { firstValueFrom, skipWhile } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { PairingService } from '../services/pairing.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

/**
 * In-memory fake — exercises business behaviour (status transitions, refresh) without
 * spinning up better-sqlite3. The real repo's SQL semantics are Drizzle's responsibility.
 */
class FakeCollabInviteTokenRepository {
  rows = new Map<string, ICollabInviteTokenEntity>();

  async insert(record: ICollabInviteTokenEntityInsert): Promise<ICollabInviteTokenEntity> {
    const row: ICollabInviteTokenEntity = {
      inviteId: record.inviteId,
      sessionId: record.sessionId,
      role: record.role,
      capabilityHash: record.capabilityHash,
      capabilityVersion: record.capabilityVersion,
      capabilityNonce: record.capabilityNonce,
      ephPubB64: record.ephPubB64,
      ephPrivCipher: record.ephPrivCipher,
      exp: record.exp,
      singleUse: record.singleUse,
      status: record.status,
      note: record.note ?? null,
      createdAt: record.createdAt,
      consumedAt: record.consumedAt ?? null,
      revokedAt: record.revokedAt ?? null,
      serverSyncedAt: record.serverSyncedAt ?? null,
    };
    this.rows.set(record.inviteId, row);
    return row;
  }

  async getById(inviteId: string): Promise<ICollabInviteTokenEntity | null> {
    return this.rows.get(inviteId) ?? null;
  }

  async listOutstanding(): Promise<ICollabInviteTokenEntity[]> {
    return [...this.rows.values()].filter((r) => r.status === 'active').sort((a, b) => a.createdAt - b.createdAt);
  }

  async listAll(): Promise<ICollabInviteTokenEntity[]> {
    return [...this.rows.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  async listExpiredActive(now: number): Promise<ICollabInviteTokenEntity[]> {
    return [...this.rows.values()].filter((r) => r.status === 'active' && r.exp < now);
  }

  async markConsumed(inviteId: string, consumedAt: number): Promise<void> {
    const row = this.rows.get(inviteId);
    if (row) {
      this.rows.set(inviteId, { ...row, status: 'consumed', consumedAt });
    }
  }

  async markRevoked(inviteId: string, revokedAt: number): Promise<void> {
    const row = this.rows.get(inviteId);
    if (row) {
      this.rows.set(inviteId, { ...row, status: 'revoked', revokedAt });
    }
  }

  async markExpired(inviteIds: string[]): Promise<void> {
    for (const id of inviteIds) {
      const row = this.rows.get(id);
      if (row) {
        this.rows.set(id, { ...row, status: 'expired' });
      }
    }
  }

  async markServerSynced(inviteId: string, syncedAt: number): Promise<void> {
    const row = this.rows.get(inviteId);
    if (row) {
      this.rows.set(inviteId, { ...row, serverSyncedAt: syncedAt });
    }
  }
}

class CapturingTransport implements ICollabInviteTransportService {
  creates: ICollabInviteCreateInput[] = [];
  revokes: string[] = [];
  pushCreateImpl: (input: ICollabInviteCreateInput) => Promise<void> = async () => {};
  pushRevokeImpl: (inviteId: string) => Promise<void> = async () => {};

  async pushCreate(input: ICollabInviteCreateInput): Promise<void> {
    this.creates.push(input);
    await this.pushCreateImpl(input);
  }

  async pushRevoke(inviteId: string): Promise<void> {
    this.revokes.push(inviteId);
    await this.pushRevokeImpl(inviteId);
  }

  async list(): Promise<readonly never[]> {
    return [];
  }
}

function buildService(transport: ICollabInviteTransportService | undefined = undefined): {
  service: PairingService;
  repo: FakeCollabInviteTokenRepository;
  config: IConfigService;
} {
  const injector = new Injector();
  const config = new ConfigService();
  injector.add([IConfigServiceId, { useValue: config }]);
  config.setConfig(SHARED_TERMINAL_PLUGIN_CONFIG_KEY, {
    relayBaseUrl: 'wss://relay.example.test/v1/',
  });
  const repo = new FakeCollabInviteTokenRepository();
  const service = new PairingService(
    config,
    new SharedTerminalCryptoService(),
    repo as unknown as CollabInviteTokenRepository,
    new NoopLogService(),
    transport
  );
  return { service, repo, config };
}

/** Wait for the next non-empty outstandingInvites emission after `op` runs. */
async function awaitOutstanding(service: PairingService, expectedCount: number): Promise<void> {
  await firstValueFrom(
    service.outstandingInvites$.pipe(skipWhile((items) => items.length !== expectedCount))
  );
}

describe('PairingService', () => {
  let bootstrapWait: Promise<void>;
  beforeEach(() => {
    // The constructor schedules an async bootstrap; tests must yield once to let it land.
    bootstrapWait = Promise.resolve();
  });

  it('creates and persists a collaboration invite (status=active)', async () => {
    const { service, repo } = buildService();
    await bootstrapWait;

    const { invite, url } = await service.createInvite({
      sessionId: 'pty-session-1',
      role: SharedTerminalRole.Observer,
      ttlMs: 15_000,
      singleUse: true,
    });

    expect(invite.capability.sid).toBe('pty-session-1');
    expect(invite.capability.role).toBe(SharedTerminalRole.Observer);
    expect(invite.singleUse).toBe(true);
    expect(url).toContain(`/s/${invite.inviteId}#`);
    expect(url).toMatch(/^https:\/\//);

    const row = await repo.getById(invite.inviteId);
    expect(row?.status).toBe('active');
    expect(row?.role).toBe(SharedTerminalRole.Observer);
    expect(row?.capabilityHash).toBe(invite.capabilityHash);
  });

  it('revokes an active invite and surfaces history', async () => {
    const { service } = buildService();
    await bootstrapWait;

    const { invite } = await service.createInvite({
      sessionId: 'sid',
      role: SharedTerminalRole.CoPilot,
      ttlMs: 60_000,
      singleUse: true,
    });
    await awaitOutstanding(service, 1);

    await service.revokeInvite(invite.inviteId);
    await awaitOutstanding(service, 0);

    const history = await service.listInvites();
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe('revoked');
    expect(history[0]?.revokedAt).toBeTypeOf('number');
  });

  it('revokeInvite is idempotent on non-active rows', async () => {
    const { service, repo } = buildService();
    await bootstrapWait;

    const { invite } = await service.createInvite({
      sessionId: 'sid',
      role: SharedTerminalRole.CoPilot,
      ttlMs: 60_000,
      singleUse: true,
    });
    await awaitOutstanding(service, 1);

    await service.revokeInvite(invite.inviteId);
    const revokedAt = (await repo.getById(invite.inviteId))?.revokedAt;
    await service.revokeInvite(invite.inviteId);
    // Second revoke must not stamp a new revokedAt.
    expect((await repo.getById(invite.inviteId))?.revokedAt).toBe(revokedAt);
  });

  it('consumeInvite transitions active → consumed', async () => {
    const { service, repo } = buildService();
    await bootstrapWait;

    const { invite } = await service.createInvite({
      sessionId: 'sid',
      role: SharedTerminalRole.Observer,
      ttlMs: 60_000,
      singleUse: true,
    });
    await awaitOutstanding(service, 1);

    await service.consumeInvite(invite.inviteId);
    await awaitOutstanding(service, 0);

    const row = await repo.getById(invite.inviteId);
    expect(row?.status).toBe('consumed');
    expect(row?.consumedAt).toBeTypeOf('number');
  });

  it('reconcileExpiry sweeps active rows past exp', async () => {
    const { service, repo } = buildService();
    await bootstrapWait;

    const { invite } = await service.createInvite({
      sessionId: 'sid',
      role: SharedTerminalRole.Observer,
      ttlMs: 60_000,
      singleUse: true,
    });
    await awaitOutstanding(service, 1);

    const original = repo.rows.get(invite.inviteId)!;
    repo.rows.set(invite.inviteId, { ...original, exp: Date.now() - 1000 });

    await service.reconcileExpiry();
    await awaitOutstanding(service, 0);

    const row = await repo.getById(invite.inviteId);
    expect(row?.status).toBe('expired');
  });

  it('pushes create/revoke to transport when cloud is configured', async () => {
    const transport = new CapturingTransport();
    const { service } = buildService(transport);
    await bootstrapWait;

    const { invite } = await service.createInvite({
      sessionId: 'sid',
      role: SharedTerminalRole.CoPilot,
      ttlMs: 60_000,
      singleUse: true,
    });
    expect(transport.creates).toHaveLength(1);
    expect(transport.creates[0]?.inviteId).toBe(invite.inviteId);
    expect(transport.creates[0]).not.toHaveProperty('ephPriv');

    await service.revokeInvite(invite.inviteId);
    expect(transport.revokes).toEqual([invite.inviteId]);
  });

  it('treats transport push failure as soft (invite still persists locally)', async () => {
    const transport = new CapturingTransport();
    transport.pushCreateImpl = async () => {
      throw new Error('network down');
    };
    const logSpy = vi.spyOn(NoopLogService.prototype, 'warn');
    const { service, repo } = buildService(transport);
    await bootstrapWait;

    const { invite } = await service.createInvite({
      sessionId: 'sid',
      role: SharedTerminalRole.CoPilot,
      ttlMs: 60_000,
      singleUse: true,
    });

    const row = await repo.getById(invite.inviteId);
    expect(row?.status).toBe('active');
    expect(row?.serverSyncedAt).toBeNull();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('throws when relayBaseUrl is missing', async () => {
    const { service, config } = buildService();
    config.setConfig(SHARED_TERMINAL_PLUGIN_CONFIG_KEY, {});
    await expect(service.createInvite({
      role: SharedTerminalRole.CoPilot,
      ttlMs: 1000,
      singleUse: true,
    })).rejects.toThrow(/relayBaseUrl/);
  });
});
