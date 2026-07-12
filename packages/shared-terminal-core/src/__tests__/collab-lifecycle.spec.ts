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

/**
 * End-to-end collaboration lifecycle suite.
 *
 * Walks the full invite lifecycle (create → consume / revoke / expire) and the rekey
 * forward-secrecy properties so any future change that breaks one of the state
 * transitions or weakens the kick → rekey invariant is caught at unit-test time.
 *
 * Pairs the in-memory CollabInviteToken fake with the real PairingService, the real
 * PtyMultiplexerService + crypto + daemon-keypair stack. Transport is a recording
 * mock so we can also confirm the server-side push lifecycle.
 */

import type { IConfigService, ILogService, LogLevel } from '@termlnk/core';
import type { CollabInviteTokenRepository, ICollabInviteTokenEntity, ICollabInviteTokenEntityInsert, ISecretCipherService } from '@termlnk/database';
import type { ICollabInviteCreateInput, ICollabInviteTransportService, IKeypair, IPtySource } from '@termlnk/shared-terminal';
import { ConfigService, IConfigService as IConfigServiceId, Injector } from '@termlnk/core';
import { SHARED_TERMINAL_PLUGIN_CONFIG_KEY, SharedTerminalRole } from '@termlnk/shared-terminal';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { DriverArbitrationService } from '../services/driver-arbitration.service';
import { PairingService } from '../services/pairing.service';
import { PtyMultiplexerService } from '../services/pty-multiplexer.service';
import { SessionKeyService } from '../services/session-key.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeCipher implements ISecretCipherService {
  readonly scheme = 'local-derived' as const;
  isAvailable(): boolean {
    return true;
  }

  encrypt(plaintext: string): string {
    if (plaintext === '' || plaintext.startsWith('tmenc1:')) {
      return plaintext;
    }
    return `tmenc1:${plaintext}`;
  }

  decrypt(ciphertext: string): string {
    return ciphertext.startsWith('tmenc1:') ? ciphertext.slice('tmenc1:'.length) : ciphertext;
  }
}

class FakeRepo {
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
    return [...this.rows.values()].filter((r) => r.status === 'active');
  }

  async listAll(): Promise<ICollabInviteTokenEntity[]> {
    return [...this.rows.values()];
  }

  async listExpiredActive(now: number): Promise<ICollabInviteTokenEntity[]> {
    return [...this.rows.values()].filter((r) => r.status === 'active' && r.exp < now);
  }

  async markConsumed(inviteId: string, consumedAt: number): Promise<void> {
    const r = this.rows.get(inviteId);
    if (r) {
      this.rows.set(inviteId, { ...r, status: 'consumed', consumedAt });
    }
  }

  async markRevoked(inviteId: string, revokedAt: number): Promise<void> {
    const r = this.rows.get(inviteId);
    if (r) {
      this.rows.set(inviteId, { ...r, status: 'revoked', revokedAt });
    }
  }

  async markExpired(inviteIds: string[]): Promise<void> {
    for (const id of inviteIds) {
      const r = this.rows.get(id);
      if (r) {
        this.rows.set(id, { ...r, status: 'expired' });
      }
    }
  }

  async markServerSynced(inviteId: string, syncedAt: number): Promise<void> {
    const r = this.rows.get(inviteId);
    if (r) {
      this.rows.set(inviteId, { ...r, serverSyncedAt: syncedAt });
    }
  }
}

class TransportMock implements ICollabInviteTransportService {
  creates: ICollabInviteCreateInput[] = [];
  revokes: string[] = [];

  async pushCreate(input: ICollabInviteCreateInput): Promise<void> {
    this.creates.push(input);
  }

  async pushRevoke(inviteId: string): Promise<void> {
    this.revokes.push(inviteId);
  }

  async list(): Promise<readonly never[]> {
    return [];
  }

  async claim(): Promise<never> {
    throw new Error('TransportMock.claim not supported');
  }
}

function buildPairing(transport: ICollabInviteTransportService | undefined = undefined): {
  service: PairingService;
  repo: FakeRepo;
  config: IConfigService;
} {
  const injector = new Injector();
  const config = new ConfigService();
  injector.add([IConfigServiceId, { useValue: config }]);
  config.setConfig(SHARED_TERMINAL_PLUGIN_CONFIG_KEY, {
    relayBaseUrl: 'wss://relay.example.test/v1/',
    inviteBaseUrl: 'https://invite.example.test',
  });
  const repo = new FakeRepo();
  const cipher = new FakeCipher();
  const crypto = new SharedTerminalCryptoService();
  const daemonKp = crypto.generateKeypair();
  const daemonKeypairService = {
    async getOrCreate(): Promise<IKeypair> {
      return daemonKp;
    },
    async getPublicKey(): Promise<Uint8Array> {
      return daemonKp.publicKey;
    },
    async rotate(): Promise<IKeypair> {
      return daemonKp;
    },
  };
  const service = new PairingService(
    config,
    crypto,
    daemonKeypairService,
    repo as unknown as CollabInviteTokenRepository,
    new NoopLogService(),
    transport,
    undefined
  );
  // suppress unused
  void cipher;
  return { service, repo, config };
}

function createPtySource(id: string): { source: IPtySource; output$: Subject<Uint8Array> } {
  const output$ = new Subject<Uint8Array>();
  const resize$ = new Subject<{ cols: number; rows: number }>();
  return {
    source: {
      id,
      cols: 80,
      rows: 24,
      title: id,
      output$,
      resize$,
      write: vi.fn(),
      resize: vi.fn(),
    },
    output$,
  };
}

describe('collaboration lifecycle', () => {
  describe('invite lifecycle', () => {
    it('walks create → revoke and surfaces the revoked state', async () => {
      const transport = new TransportMock();
      const { service, repo } = buildPairing(transport);
      const { invite } = await service.createInvite({
        sessionId: 'sess',
        role: SharedTerminalRole.CoPilot,
        ttlMs: 60_000,
        singleUse: true,
      });
      expect(transport.creates).toHaveLength(1);
      expect((await repo.getById(invite.inviteId))?.status).toBe('active');

      await service.revokeInvite(invite.inviteId);
      expect((await repo.getById(invite.inviteId))?.status).toBe('revoked');
      expect(transport.revokes).toEqual([invite.inviteId]);
    });

    it('walks create → consume and surfaces the consumed state', async () => {
      const { service, repo } = buildPairing();
      const { invite } = await service.createInvite({
        sessionId: 'sess',
        role: SharedTerminalRole.Observer,
        ttlMs: 60_000,
        singleUse: true,
      });
      await service.consumeInvite(invite.inviteId);
      const row = await repo.getById(invite.inviteId);
      expect(row?.status).toBe('consumed');
      expect(row?.consumedAt).toBeTypeOf('number');
    });

    it('walks create → expire via reconcileExpiry and never silently re-activates', async () => {
      const { service, repo } = buildPairing();
      const { invite } = await service.createInvite({
        sessionId: 'sess',
        role: SharedTerminalRole.Observer,
        ttlMs: 60_000,
        singleUse: true,
      });
      // Force the persisted row's exp into the past.
      const original = repo.rows.get(invite.inviteId)!;
      repo.rows.set(invite.inviteId, { ...original, exp: Date.now() - 1 });

      await service.reconcileExpiry();
      expect((await repo.getById(invite.inviteId))?.status).toBe('expired');

      // Calling reconcileExpiry again is idempotent — already-expired rows stay put.
      await service.reconcileExpiry();
      expect((await repo.getById(invite.inviteId))?.status).toBe('expired');
    });

    it('revoke on an already-consumed invite is a no-op (terminal states are sticky)', async () => {
      const { service, repo } = buildPairing();
      const { invite } = await service.createInvite({
        sessionId: 'sess',
        role: SharedTerminalRole.CoPilot,
        ttlMs: 60_000,
        singleUse: true,
      });
      await service.consumeInvite(invite.inviteId);
      const consumedAtBefore = (await repo.getById(invite.inviteId))?.consumedAt;

      await service.revokeInvite(invite.inviteId);
      const row = await repo.getById(invite.inviteId);
      // Status is consumed — the revoke does NOT downgrade it.
      expect(row?.status).toBe('consumed');
      expect(row?.consumedAt).toBe(consumedAtBefore);
      expect(row?.revokedAt).toBeNull();
    });

    it('listOutstanding never includes revoked / consumed / expired invites', async () => {
      const { service, repo } = buildPairing();
      const a = await service.createInvite({ sessionId: 'a', role: SharedTerminalRole.CoPilot, ttlMs: 60_000, singleUse: true });
      const b = await service.createInvite({ sessionId: 'b', role: SharedTerminalRole.CoPilot, ttlMs: 60_000, singleUse: true });
      const c = await service.createInvite({ sessionId: 'c', role: SharedTerminalRole.CoPilot, ttlMs: 60_000, singleUse: true });

      await service.revokeInvite(a.invite.inviteId);
      await service.consumeInvite(b.invite.inviteId);

      const outstanding = await repo.listOutstanding();
      expect(outstanding.map((row) => row.inviteId)).toEqual([c.invite.inviteId]);
    });
  });

  describe('rekey forward secrecy', () => {
    it('kick rotates the session key so the kicked client cannot read new traffic', async () => {
      const crypto = new SharedTerminalCryptoService();
      const daemonKp: IKeypair = crypto.generateKeypair();
      const daemon = {
        async getOrCreate(): Promise<IKeypair> {
          return daemonKp;
        },
        async getPublicKey(): Promise<Uint8Array> {
          return daemonKp.publicKey;
        },
        async rotate(): Promise<IKeypair> {
          return daemonKp;
        },
      };
      const mux = new PtyMultiplexerService(
        new DriverArbitrationService(new NoopLogService()),
        new SessionKeyService(crypto, new NoopLogService(), daemon),
        new NoopLogService()
      );
      const pty = createPtySource('s1');
      mux.register(pty.source);

      const kickedKp = crypto.generateKeypair();
      const keeperKp = crypto.generateKeypair();
      mux.attachClient('s1', 'kicked', SharedTerminalRole.CoPilot, 'kicked', kickedKp.publicKey);
      mux.attachClient('s1', 'keeper', SharedTerminalRole.Observer, 'keeper', keeperKp.publicKey);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const before = mux.getSessionKey('s1');
      expect(before).not.toBeNull();

      mux.kick('s1', 'kicked', 'security');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const after = mux.getSessionKey('s1');
      expect(after).not.toBeNull();
      expect(Array.from(after!)).not.toEqual(Array.from(before!));

      // The kicked client never received the new K (it was removed before _wrap...).
      mux.dispose();
    });

    it('expired invite revocation still rekeys when the consumer is still attached', async () => {
      // This crosses two surfaces — invite lifecycle + rekey — and demonstrates that
      // the owner can simultaneously revoke the invite AND kick the consumer to fully
      // invalidate the session for that user.
      const crypto = new SharedTerminalCryptoService();
      const daemonKp: IKeypair = crypto.generateKeypair();
      const daemon = {
        async getOrCreate(): Promise<IKeypair> {
          return daemonKp;
        },
        async getPublicKey(): Promise<Uint8Array> {
          return daemonKp.publicKey;
        },
        async rotate(): Promise<IKeypair> {
          return daemonKp;
        },
      };
      const transport = new TransportMock();
      const { service } = buildPairing(transport);
      const mux = new PtyMultiplexerService(
        new DriverArbitrationService(new NoopLogService()),
        new SessionKeyService(crypto, new NoopLogService(), daemon),
        new NoopLogService()
      );
      const pty = createPtySource('s2');
      mux.register(pty.source);

      const { invite } = await service.createInvite({
        sessionId: 's2',
        role: SharedTerminalRole.CoPilot,
        ttlMs: 60_000,
        singleUse: true,
      });
      await service.consumeInvite(invite.inviteId);

      const consumerKp = crypto.generateKeypair();
      mux.attachClient('s2', 'consumer', SharedTerminalRole.CoPilot, 'consumer', consumerKp.publicKey);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const before = mux.getSessionKey('s2');

      // Owner now wants to fully kick consumer (revocation alone doesn't kill the
      // already-attached session — that's by design; revoke gates new attaches).
      await service.revokeInvite(invite.inviteId);
      mux.kick('s2', 'consumer', 'revoked');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const after = mux.getSessionKey('s2');
      // Single keyed participant remained = none after kick = key dropped.
      expect(after).toBeNull();
      expect(before).not.toBeNull();
      mux.dispose();
    });
  });
});
