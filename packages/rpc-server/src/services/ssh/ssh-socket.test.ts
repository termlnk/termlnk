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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSHSocket } from './ssh-socket';

const { state } = vi.hoisted(() => ({
  state: {
    lastClient: null as null | { listenerCount(eventName: string): number },
  },
}));

vi.mock('ssh2', async () => {
  const { EventEmitter } = await import('node:events');

  class MockClient extends EventEmitter {
    connect(): void {}
    end(): void {}
    destroy(): void {
      this.emit('close');
    }

    exec(): void {}
    shell(): void {}
    forwardIn(): void {}
    unforwardIn(): void {}
    forwardOut(): void {}
    sftp(): void {}
    subsys(): void {}
    setNoDelay(): void {}

    constructor() {
      super();
      state.lastClient = this;
    }
  }

  return {
    Client: MockClient,
  };
});

describe('createSSHSocket', () => {
  beforeEach(() => {
    state.lastClient = null;
  });

  it('should remove client listeners when ready$ unsubscribes', () => {
    const socket = createSSHSocket('socket-1');
    const subscription = socket.ready$.subscribe(() => {});

    expect(state.lastClient?.listenerCount('ready')).toBe(1);

    subscription.unsubscribe();

    expect(state.lastClient?.listenerCount('ready')).toBe(0);
  });

  it('should remove client listeners when error$ unsubscribes', () => {
    const socket = createSSHSocket('socket-2');
    const subscription = socket.error$.subscribe(() => {});

    expect(state.lastClient?.listenerCount('error')).toBe(1);

    subscription.unsubscribe();

    expect(state.lastClient?.listenerCount('error')).toBe(0);
  });
});
