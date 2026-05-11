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

import type { IConfigService } from '@termlnk/core';
import { ConfigService, IConfigService as IConfigServiceId, Injector } from '@termlnk/core';
import { SHARED_TERMINAL_PLUGIN_CONFIG_KEY, SharedTerminalRole } from '@termlnk/shared-terminal';
import { beforeEach, describe, expect, it } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { PairingService } from '../services/pairing.service';

describe('PairingService', () => {
  let injector: Injector;
  let config: IConfigService;
  let service: PairingService;

  beforeEach(() => {
    injector = new Injector();
    config = new ConfigService();
    injector.add([IConfigServiceId, { useValue: config }]);
    config.setConfig(SHARED_TERMINAL_PLUGIN_CONFIG_KEY, {
      relayBaseUrl: 'wss://relay.example.test/v1/',
    });
    service = new PairingService(config, new SharedTerminalCryptoService());
  });

  it('creates and revokes collaboration invite locally', async () => {
    const seen: number[] = [];
    const sub = service.outstandingInvites$.subscribe((items) => seen.push(items.length));

    const created = await service.createInvite({
      sessionId: 'pty-session-1',
      role: SharedTerminalRole.Observer,
      ttlMs: 15_000,
      singleUse: true,
    });

    expect(created.invite.capability.sid).toBe('pty-session-1');
    expect(created.invite.capability.role).toBe(SharedTerminalRole.Observer);
    expect(created.invite.singleUse).toBe(true);
    expect(created.url).toContain(`/s/${created.invite.inviteId}#`);

    await service.revokeInvite(created.invite.inviteId);
    expect(seen).toEqual([0, 1, 0]);
    sub.unsubscribe();
  });

  it('throws when relayBaseUrl is missing', async () => {
    config.setConfig(SHARED_TERMINAL_PLUGIN_CONFIG_KEY, {});
    await expect(service.createInvite({
      role: SharedTerminalRole.CoPilot,
      ttlMs: 1000,
      singleUse: true,
    })).rejects.toThrow(/relayBaseUrl/);
  });
});
