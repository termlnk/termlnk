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

import type { ITokenManager } from '@termlnk/auth';
import type { ILogService } from '@termlnk/core';
import type { ICollabInviteTransportService } from '@termlnk/shared-terminal';
import { HttpRequestError } from '@termlnk/auth';
import { ConfigService } from '@termlnk/core';
import { SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE, SharedTerminalRole } from '@termlnk/shared-terminal';
import { firstValueFrom, toArray } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { FrameCodecService } from '../services/frame-codec.service';
import { RemoteSessionService } from '../services/remote-session.service';

class FakeLogService implements ILogService {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
  log = vi.fn();
  deprecate = vi.fn();
  setLogLevel = vi.fn();
}

function makeService(inviteTransport?: ICollabInviteTransportService): RemoteSessionService {
  const crypto = new SharedTerminalCryptoService();
  const codec = new FrameCodecService(crypto);
  const log = new FakeLogService();
  const config = new ConfigService();
  config.setConfig('shared-terminal.config', { relayBaseUrl: 'wss://relay.example.test' });
  const tokenManager: ITokenManager = {
    getAccessToken: async () => 'token',
    setTokens: vi.fn(),
    clear: vi.fn(),
    peekCached: vi.fn(() => null),
  };
  return new RemoteSessionService(log, config, crypto, codec, tokenManager, inviteTransport);
}

function makeInviteUrl(): string {
  const crypto = new SharedTerminalCryptoService();
  const daemon = crypto.generateKeypair();
  const eph = crypto.generateKeypair();
  const capability = {
    v: 1,
    sid: 'shared-session-1',
    role: SharedTerminalRole.CoPilot,
    exp: Date.now() + 60_000,
    nonce: 'nonce',
    daemonPub: bytesToBase64Url(daemon.publicKey),
  };
  const fragment = encodeURIComponent(JSON.stringify({
    ephPriv: bytesToBase64Url(eph.secretKey),
    capability,
  }));
  return `termlnk://invite/invite-1#${fragment}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('RemoteSessionService (multi-session contract)', () => {
  it('starts with empty sessions list', () => {
    const svc = makeService();
    expect(svc.getSessions()).toEqual([]);
    svc.dispose();
  });

  it('sessions$ emits the empty array as its current value', async () => {
    const svc = makeService();
    const value = await firstValueFrom(svc.sessions$);
    expect(value).toEqual([]);
    svc.dispose();
  });

  it('data$/status$/event$/error$/connectionId$/driverId$ return EMPTY for unknown sessionIds', async () => {
    const svc = makeService();
    // toArray over an Observable that never emits would hang; EMPTY completes
    // immediately so toArray resolves to []. We rely on that to detect that
    // the lookup returned EMPTY rather than a still-open subject.
    expect(await firstValueFrom(svc.data$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.status$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.event$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.error$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.connectionId$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.driverId$('unknown').pipe(toArray()))).toEqual([]);
    svc.dispose();
  });

  it('write/sendControl on unknown sessionIds is a silent no-op', async () => {
    const svc = makeService();
    await expect(svc.write('unknown', new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
    await expect(svc.sendControl('unknown', { type: 'heartbeat' })).resolves.toBeUndefined();
    svc.dispose();
  });

  it('closeSession on unknown sessionIds is a silent no-op', async () => {
    const svc = makeService();
    await expect(svc.closeSession('unknown')).resolves.toBeUndefined();
    svc.dispose();
  });

  it('rejects inactive invite claims before opening a relay session', async () => {
    const inviteTransport: ICollabInviteTransportService = {
      pushCreate: vi.fn(),
      pushRevoke: vi.fn(),
      list: vi.fn(async () => []),
      claim: vi.fn(async () => {
        throw new HttpRequestError(
          'POST /collab/invite/invite-1/claim',
          410,
          'Gone',
          '{"error":{"code":"invite_not_active","message":"invite is consumed"}}'
        );
      }),
    };
    const svc = makeService(inviteTransport);

    await expect(svc.createSession({ inviteUrl: makeInviteUrl() }))
      .rejects
      .toThrow(SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE);
    expect(svc.getSessions()).toEqual([]);

    svc.dispose();
  });
});
