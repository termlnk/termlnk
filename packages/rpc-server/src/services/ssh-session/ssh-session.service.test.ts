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

import type { ILogService, Injector } from '@termlnk/core';
import type { ConfigRepository, HostRepository, SnippetRepository } from '@termlnk/database';
import type { ITerminalSessionNotifyService } from '@termlnk/rpc';
import type { ICommandBlockService } from '../shell-integration/command-block.service';
import type { IHostChainHandle, ISSHHostChainService } from '../ssh/ssh-host-chain.service';
import type { ISSHSocket } from '../ssh/ssh-socket';
import type { ISSHSocketService } from '../ssh/ssh-socket.service';
import { SSHSocketStatus } from '@termlnk/rpc';
import { BehaviorSubject, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SSHSessionService } from './ssh-session.service';

const FAKE_HOST = {
  id: 'host-1',
  type: 'host',
  label: 'test-host',
  addr: '127.0.0.1',
  port: 22,
  credential: { type: 'password', username: 'u', password: 'p' },
  settings: {},
};

function createFakeLogService(): ILogService {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as ILogService;
}

function createFakeSocket(id: string) {
  const status$ = new BehaviorSubject<SSHSocketStatus>(SSHSocketStatus.IDLE);
  return {
    id,
    get status() {
      return status$.getValue();
    },
    status$: status$.asObservable(),
    connect$: new Subject<void>(),
    greeting$: new Subject<string>(),
    handshake$: new Subject<{ negotiated?: { serverHostKey?: string } }>(),
    ready$: new Subject<void>(),
    error$: new Subject<{ err?: Error }>(),
    timeout$: new Subject<void>(),
    end$: new Subject<void>(),
    close$: new Subject<void>(),
    keyboardInteractive$: new Subject<unknown>(),
    changePassword$: new Subject<unknown>(),
    banner$: new Subject<string>(),
    x11$: new Subject<unknown>(),
    connect: vi.fn(),
    destroy: vi.fn(),
    shell: vi.fn(),
    exec: vi.fn(),
  } as unknown as ISSHSocket;
}

function createFailingChainHandle(error: Error): IHostChainHandle {
  return {
    hops: [],
    hopEvent$: new Subject(),
    progress$: new Subject(),
    ready: Promise.reject(error),
    respondKeyboardInteractive: vi.fn(),
    respondChangePassword: vi.fn(),
    dispose: vi.fn(),
  } as unknown as IHostChainHandle;
}

interface ITestBedOptions {
  chainHandle?: IHostChainHandle | null;
  connectConfigError?: Error;
}

function createTestBed(options: ITestBedOptions = {}) {
  const logService = createFakeLogService();
  const releaseSocket = vi.fn();
  const sockets: ISSHSocket[] = [];

  const sshSocketService = {
    createSocket: vi.fn((key: string) => {
      const socket = createFakeSocket(key);
      sockets.push(socket);
      return socket;
    }),
    releaseSocket,
    createConnectConfig: vi.fn(async () => {
      if (options.connectConfigError) {
        throw options.connectConfigError;
      }
      return { readyTimeout: 1000 };
    }),
    getMultiplexerKey: vi.fn(() => 'mux-key'),
  } as unknown as ISSHSocketService;

  const injector = {
    createInstance: (Ctor: any, ...args: unknown[]) => new Ctor(...args, sshSocketService, logService),
    get: () => null,
  } as unknown as Injector;

  const hostRepository = {
    getInfoById: vi.fn(async () => ({ ...FAKE_HOST })),
  } as unknown as HostRepository;

  const configRepository = {
    get: vi.fn(async () => null),
    getField: vi.fn(async () => undefined),
  } as unknown as ConfigRepository;

  const chainHandle = options.chainHandle ?? null;
  const sshHostChainService = {
    startTunnel: vi.fn(async () => chainHandle),
  } as unknown as ISSHHostChainService;

  const notifyService = {
    notifySessionCreated: vi.fn(),
    notifySessionClosed: vi.fn(),
    notifySessionStatusChanged: vi.fn(),
  } as unknown as ITerminalSessionNotifyService;

  const commandBlockService = {
    attachSession: vi.fn(),
    detachSession: vi.fn(),
  } as unknown as ICommandBlockService;

  const service = new SSHSessionService(
    injector,
    hostRepository,
    configRepository,
    sshSocketService,
    sshHostChainService,
    notifyService,
    commandBlockService,
    logService,
    undefined as unknown as SnippetRepository
  );

  return { service, releaseSocket, sockets, sshHostChainService, sshSocketService };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('SSHSessionService session lifecycle', () => {
  it('rejects a duplicate client-provided sessionId instead of overwriting the live session', async () => {
    const { service } = createTestBed();

    const sessionId = await service.createSession('host-1', { sessionId: 's-dup' });
    expect(sessionId).toBe('s-dup');
    expect(service.getSession('s-dup')).toBeDefined();

    await expect(service.createSession('host-1', { sessionId: 's-dup' }))
      .rejects
      .toThrow('Session s-dup already exists');
    expect(service.getSession('s-dup')).toBeDefined();

    service.dispose();
  });

  it('rolls back map entry and socket refcount when createConnectConfig throws', async () => {
    const { service, releaseSocket } = createTestBed({
      connectConfigError: new Error('credential resolve failed'),
    });

    await expect(service.createSession('host-1', { sessionId: 's-1' }))
      .rejects
      .toThrow('credential resolve failed');

    expect(service.getSession('s-1')).toBeUndefined();
    expect(releaseSocket).toHaveBeenCalledTimes(1);
    expect(releaseSocket).toHaveBeenCalledWith('mux-key');

    service.dispose();
  });

  it('does not double-release the socket when a chain failure is followed by a retry', async () => {
    const chainError = new Error('chain hop unreachable');
    const testBed = createTestBed({ chainHandle: createFailingChainHandle(chainError) });
    const { service, releaseSocket, sshHostChainService, sockets } = testBed;

    const sessionId = await service.createSession('host-1', { sessionId: 's-1' });
    await flushMicrotasks();

    // Chain build failed: exactly one release for the acquired socket
    expect(releaseSocket).toHaveBeenCalledTimes(1);

    // Retry without a chain: the old binding was already released, so the
    // retry path must not release it a second time.
    (sshHostChainService.startTunnel as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await service.retrySession(sessionId, 'new-password');
    await flushMicrotasks();

    expect(releaseSocket).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(2);
    expect((sockets[1] as unknown as { connect: ReturnType<typeof vi.fn> }).connect).toHaveBeenCalledTimes(1);

    service.dispose();
  });

  it('closing a connecting session removes it from the map and releases its socket', async () => {
    const { service, releaseSocket } = createTestBed();

    const sessionId = await service.createSession('host-1', { sessionId: 's-1' });
    expect(service.getSession(sessionId)).toBeDefined();

    await service.closeSession(sessionId);

    expect(service.getSession(sessionId)).toBeUndefined();
    expect(releaseSocket).toHaveBeenCalledTimes(1);

    service.dispose();
  });
});
