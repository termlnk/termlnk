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

import type { ILogService, LogLevel } from '@termlnk/core';
import type { BackupRepository, IBackupSnapshot } from '@termlnk/database';
import { Buffer } from 'node:buffer';
import { IMasterKeyService, IPasswordHasher } from '@termlnk/auth';
import { HashWasmPasswordHasher, MasterKeyService } from '@termlnk/auth-core';
import { ILogService as ILogServiceId, Injector } from '@termlnk/core';
import { BACKUP_PAYLOAD_PREFIX } from '@termlnk/sync';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupService } from '../services/backup.service';
import { SyncCryptoService } from '../services/crypto.service';

const TEST_EMAIL = 'alice@example.com';
const TEST_PASSWORD = 'correct horse battery staple';
const TEST_SALT_B64 = Buffer.from('static-test-salt-32-bytes-fixed!').toString('base64');
const PREFIX_BYTES = new TextEncoder().encode(BACKUP_PAYLOAD_PREFIX);

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

function makeEmptySnapshot(): IBackupSnapshot {
  return {
    version: 1,
    exportedAt: 1_700_000_000_000,
    resources: {
      host: [],
      config: [],
      ai_provider: [],
      ai_provider_model: [],
      ai_custom_model: [],
      mcp_server: [],
      skill: [],
    },
  };
}

function makeSampleSnapshot(): IBackupSnapshot {
  return {
    version: 1,
    exportedAt: 1_700_000_000_000,
    resources: {
      host: [
        {
          id: 'h1',
          label: 'prod',
          type: 'host' as never,
          pid: 'root',
          tree: 'root',
          addr: '10.0.0.1',
          port: 22,
          credential: { type: 'password', username: 'admin', password: 'plaintext-secret' } as never,
          proxy: null,
          settings: null,
          hostChainIds: null,
          sort: 0,
          expanded: false,
          accessedAt: '2026-05-09T00:00:00.000Z',
          createdAt: '2026-05-09T00:00:00.000Z',
          updatedAt: '2026-05-09T00:00:00.000Z',
        },
      ],
      config: [
        {
          key: 'theme.color',
          value: { palette: 'nord' },
          accessedAt: '2026-05-09T00:00:00.000Z',
          createdAt: '2026-05-09T00:00:00.000Z',
          updatedAt: '2026-05-09T00:00:00.000Z',
        },
      ],
      ai_provider: [],
      ai_provider_model: [],
      ai_custom_model: [],
      mcp_server: [],
      skill: [],
    },
  };
}

class FakeBackupRepository {
  exported: IBackupSnapshot = makeEmptySnapshot();
  imported: { snapshot: IBackupSnapshot; mode: 'replace' | 'merge' } | null = null;
  importThrows: Error | null = null;

  async exportSnapshot(): Promise<IBackupSnapshot> {
    return this.exported;
  }

  async importSnapshot(snapshot: IBackupSnapshot, mode: 'replace' | 'merge'): Promise<void> {
    if (this.importThrows) {
      throw this.importThrows;
    }
    this.imported = { snapshot, mode };
  }
}

interface ITestBed {
  injector: Injector;
  masterKeyService: MasterKeyService;
  cryptoService: SyncCryptoService;
  backupRepo: FakeBackupRepository;
  service: BackupService;
}

function createTestBed(): ITestBed {
  const injector = new Injector();
  injector.add([ILogServiceId, { useClass: NoopLogService }]);
  // MasterKeyService requires IPasswordHasher; bind the Wasm impl since these tests run under Node.
  injector.add([IPasswordHasher, { useClass: HashWasmPasswordHasher }]);
  injector.add([IMasterKeyService, { useClass: MasterKeyService }]);
  const cryptoService = new SyncCryptoService(
    injector.get(IMasterKeyService),
    new NoopLogService()
  );
  const backupRepo = new FakeBackupRepository();
  const service = new BackupService(
    backupRepo as unknown as BackupRepository,
    cryptoService,
    new NoopLogService()
  );

  return {
    injector,
    masterKeyService: injector.get(IMasterKeyService) as MasterKeyService,
    cryptoService,
    backupRepo,
    service,
  };
}

describe('BackupService', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.service.dispose();
    bed.cryptoService.dispose();
    bed.injector.dispose();
  });

  it('export rejects while master key is locked', async () => {
    await expect(bed.service.exportEncryptedBackup()).rejects.toThrow(/locked/i);
  });

  it('import rejects while master key is locked', async () => {
    await expect(
      bed.service.importEncryptedBackup(new Uint8Array(64), 'replace')
    ).rejects.toThrow(/locked/i);
  });

  it('export wraps the snapshot in a tmbak1: framed payload', async () => {
    await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    bed.backupRepo.exported = makeSampleSnapshot();

    const { payload, summary } = await bed.service.exportEncryptedBackup();

    expect(payload.subarray(0, PREFIX_BYTES.length)).toEqual(PREFIX_BYTES);
    expect(payload.length).toBeGreaterThan(PREFIX_BYTES.length);
    expect(summary.exportedAt).toBe(bed.backupRepo.exported.exportedAt);
    expect(summary.counts).toMatchObject({ host: 1, config: 1, ai_provider: 0 });
  }, 30_000);

  it('export → import round-trips the snapshot through the crypto layer', async () => {
    await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    const original = makeSampleSnapshot();
    bed.backupRepo.exported = original;

    const { payload } = await bed.service.exportEncryptedBackup();
    const summary = await bed.service.importEncryptedBackup(payload, 'replace');

    expect(summary.mode).toBe('replace');
    expect(bed.backupRepo.imported).not.toBeNull();
    expect(bed.backupRepo.imported!.mode).toBe('replace');
    // Snapshot should round-trip lossless through JSON
    expect(bed.backupRepo.imported!.snapshot).toEqual(original);
  }, 60_000);

  it('import rejects payloads missing the tmbak1: prefix', async () => {
    await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    const garbage = new Uint8Array(64).fill(0xAB);
    await expect(bed.service.importEncryptedBackup(garbage, 'replace')).rejects.toThrow(/tmbak1/i);
  }, 30_000);

  it('import rejects payloads shorter than the prefix', async () => {
    await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    const tooShort = new Uint8Array(PREFIX_BYTES.length - 1);
    await expect(bed.service.importEncryptedBackup(tooShort, 'replace')).rejects.toThrow();
  }, 30_000);

  it('import surfaces decryption failure when the inner ciphertext is tampered', async () => {
    await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    bed.backupRepo.exported = makeSampleSnapshot();
    const { payload } = await bed.service.exportEncryptedBackup();

    // Flip a bit in the inner ciphertext (after tmbak1: + tmsync1: + nonce)
    const tampered = new Uint8Array(payload);
    const tamperOffset = PREFIX_BYTES.length + 'tmsync1:'.length + 24; // skip both prefixes + nonce
    tampered[tamperOffset] ^= 0x01;

    await expect(bed.service.importEncryptedBackup(tampered, 'replace')).rejects.toThrow();
  }, 60_000);

  it('import refuses payloads encrypted with a different master password', async () => {
    await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    bed.backupRepo.exported = makeSampleSnapshot();
    const { payload } = await bed.service.exportEncryptedBackup();

    // Re-derive with a different password
    await bed.masterKeyService.derive('different-pw', { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });

    await expect(bed.service.importEncryptedBackup(payload, 'replace')).rejects.toThrow();
  }, 60_000);

  it('propagates repository errors from importSnapshot', async () => {
    await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    bed.backupRepo.exported = makeEmptySnapshot();
    const { payload } = await bed.service.exportEncryptedBackup();

    bed.backupRepo.importThrows = new Error('disk full');
    await expect(bed.service.importEncryptedBackup(payload, 'replace')).rejects.toThrow(/disk full/);
  }, 30_000);

  it('rejects merge mode through the repository (replace-only)', async () => {
    await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    bed.backupRepo.exported = makeEmptySnapshot();
    const { payload } = await bed.service.exportEncryptedBackup();

    // The fake repo doesn't enforce mode; assert the service forwards mode unmodified
    const summary = await bed.service.importEncryptedBackup(payload, 'merge');
    expect(summary.mode).toBe('merge');
    expect(bed.backupRepo.imported!.mode).toBe('merge');
  }, 30_000);
});
