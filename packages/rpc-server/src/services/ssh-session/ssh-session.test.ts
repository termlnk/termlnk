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

import type { ILogService } from '@termlnk/core';
import type { IHost } from '@termlnk/terminal';
import type { ISSHChannel } from '../ssh/ssh-channel';
import type { ISSHSocket } from '../ssh/ssh-socket';
import type { ISSHSocketService } from '../ssh/ssh-socket.service';
import { SSHSessionStatus, SSHSocketStatus } from '@termlnk/rpc';
import { BehaviorSubject, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SSHSession } from './ssh-session';

function createFakeLogService(): ILogService {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as ILogService;
}

function createFakeSocketService() {
  return {
    createSocket: vi.fn(),
    releaseSocket: vi.fn(),
    createConnectConfig: vi.fn(),
    getMultiplexerKey: vi.fn(),
  } as unknown as ISSHSocketService & { releaseSocket: ReturnType<typeof vi.fn> };
}

function createFakeSocket(id: string, initialStatus: SSHSocketStatus) {
  const status$ = new BehaviorSubject<SSHSocketStatus>(initialStatus);
  const ready$ = new Subject<void>();
  const shell = vi.fn();
  const socket = {
    id,
    get status() {
      return status$.getValue();
    },
    status$: status$.asObservable(),
    connect$: new Subject<void>(),
    greeting$: new Subject<string>(),
    handshake$: new Subject<{ negotiated?: { serverHostKey?: string } }>(),
    ready$: ready$.asObservable(),
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
    shell,
    exec: vi.fn(),
  };
  return { socket: socket as unknown as ISSHSocket, status$, ready$, shell };
}

function createFakeChannel() {
  const close$ = new Subject<void>();
  const close = vi.fn(() => close$.next());
  const channel = {
    write: vi.fn(),
    setWindow: vi.fn(),
    close,
    data$: new Subject<Uint8Array>(),
    error$: new Subject<Uint8Array>(),
    close$: close$.asObservable(),
  };
  return { channel: channel as unknown as ISSHChannel, close, close$ };
}

const FAKE_HOST = {
  id: 'host-1',
  type: 'host',
  label: 'test-host',
  addr: '127.0.0.1',
  port: 22,
  credential: { type: 'password', username: 'u', password: 'p' },
  settings: {},
} as unknown as IHost;

function createSession(socket: ISSHSocket, socketService: ISSHSocketService) {
  return new SSHSession(
    'session-1',
    socket,
    FAKE_HOST,
    80,
    24,
    null,
    null,
    undefined,
    socketService,
    createFakeLogService()
  );
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('SSHSession close lifecycle', () => {
  it('close() before channel exists reaches CLOSED and releases the socket ref', async () => {
    const { socket } = createFakeSocket('key-1', SSHSocketStatus.CONNECTING);
    const socketService = createFakeSocketService();
    const session = createSession(socket, socketService);

    await session.close();

    expect(session.status).toBe(SSHSessionStatus.CLOSED);
    expect(socketService.releaseSocket).toHaveBeenCalledTimes(1);
    expect(socketService.releaseSocket).toHaveBeenCalledWith('key-1');

    session.dispose();
  });

  it('close() is idempotent and never double-releases the socket ref', async () => {
    const { socket } = createFakeSocket('key-1', SSHSocketStatus.CONNECTING);
    const socketService = createFakeSocketService();
    const session = createSession(socket, socketService);

    await session.close();
    await session.close();
    session.releaseSocketRef();

    expect(socketService.releaseSocket).toHaveBeenCalledTimes(1);

    session.dispose();
  });

  it('does not open a shell when the socket becomes ready after close()', async () => {
    const { socket, ready$, shell } = createFakeSocket('key-1', SSHSocketStatus.CONNECTING);
    const socketService = createFakeSocketService();
    const session = createSession(socket, socketService);

    await session.close();
    ready$.next();
    await flushMicrotasks();

    expect(shell).not.toHaveBeenCalled();

    session.dispose();
  });

  it('closes a channel resolved after close() instead of adopting it', async () => {
    const { socket, ready$, shell } = createFakeSocket('key-1', SSHSocketStatus.CONNECTING);
    const socketService = createFakeSocketService();
    const session = createSession(socket, socketService);

    let resolveShell: (channel: ISSHChannel) => void = () => {};
    shell.mockReturnValue(new Promise<ISSHChannel>((resolve) => {
      resolveShell = resolve;
    }));

    // shell() is in flight when close() arrives
    ready$.next();
    await flushMicrotasks();
    expect(shell).toHaveBeenCalledTimes(1);

    await session.close();
    const { channel, close } = createFakeChannel();
    resolveShell(channel);
    await flushMicrotasks();

    expect(close).toHaveBeenCalledTimes(1);
    expect(session.status).toBe(SSHSessionStatus.CLOSED);

    session.dispose();
  });

  it('channel close$ transitions to CLOSED and releases the socket ref once', async () => {
    const { socket, shell } = createFakeSocket('key-1', SSHSocketStatus.READY);
    const socketService = createFakeSocketService();
    const { channel, close$ } = createFakeChannel();
    shell.mockResolvedValue(channel);

    const session = createSession(socket, socketService);
    await flushMicrotasks();
    expect(session.status).toBe(SSHSessionStatus.READY);

    close$.next();

    expect(session.status).toBe(SSHSessionStatus.CLOSED);
    expect(socketService.releaseSocket).toHaveBeenCalledTimes(1);

    await session.close();
    expect(socketService.releaseSocket).toHaveBeenCalledTimes(1);

    session.dispose();
  });
});

describe('SSHSession channel open failure', () => {
  it('shell() rejection surfaces ERROR instead of hanging in OPENING_SHELL', async () => {
    const { socket, shell } = createFakeSocket('key-1', SSHSocketStatus.READY);
    const socketService = createFakeSocketService();
    shell.mockRejectedValue(new Error('open failed: MaxSessions'));

    const errors: string[] = [];
    const session = createSession(socket, socketService);
    session.error$.subscribe((message) => errors.push(message));
    await flushMicrotasks();

    expect(session.status).toBe(SSHSessionStatus.ERROR);
    expect(errors.some((message) => message.includes('MaxSessions'))).toBe(true);

    session.dispose();
  });
});

describe('SSHSession rebindSocket', () => {
  it('re-arms releaseSocketRef for the new socket binding', async () => {
    const { socket: socketA } = createFakeSocket('key-a', SSHSocketStatus.CONNECTING);
    const { socket: socketB } = createFakeSocket('key-b', SSHSocketStatus.CONNECTING);
    const socketService = createFakeSocketService();
    const session = createSession(socketA, socketService);

    session.releaseSocketRef();
    session.releaseSocketRef();
    expect(socketService.releaseSocket).toHaveBeenCalledTimes(1);
    expect(socketService.releaseSocket).toHaveBeenLastCalledWith('key-a');

    session.rebindSocket(socketB);
    session.releaseSocketRef();
    expect(socketService.releaseSocket).toHaveBeenCalledTimes(2);
    expect(socketService.releaseSocket).toHaveBeenLastCalledWith('key-b');

    session.dispose();
  });

  it('closes and detaches the old channel so its close$ cannot touch the new binding', async () => {
    const { socket: socketA, shell } = createFakeSocket('key-a', SSHSocketStatus.READY);
    const { socket: socketB } = createFakeSocket('key-b', SSHSocketStatus.CONNECTING);
    const socketService = createFakeSocketService();
    const { channel, close, close$ } = createFakeChannel();
    shell.mockResolvedValue(channel);

    const session = createSession(socketA, socketService);
    await flushMicrotasks();
    expect(session.status).toBe(SSHSessionStatus.READY);

    session.rebindSocket(socketB);
    expect(close).toHaveBeenCalledTimes(1);

    // A late close event from the detached channel must not close the session
    // or release the new socket's reference.
    close$.next();
    expect(session.status).not.toBe(SSHSessionStatus.CLOSED);
    expect(socketService.releaseSocket).not.toHaveBeenCalled();

    session.dispose();
  });
});
