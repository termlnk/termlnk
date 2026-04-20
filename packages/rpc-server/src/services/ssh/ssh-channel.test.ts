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

import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { createSSHChannel } from './ssh-channel';

function createMockChannel() {
  const channel = new EventEmitter() as EventEmitter & {
    server: boolean;
    type: string;
    subtype: string | undefined;
    stderr: EventEmitter;
    write: () => void;
    setWindow: () => void;
    signal: () => void;
    eof: () => void;
    exit: () => void;
    close: () => void;
    destroy: () => void;
  };

  channel.server = false;
  channel.type = 'session';
  channel.subtype = undefined;
  channel.stderr = new EventEmitter();
  channel.write = () => {};
  channel.setWindow = () => {};
  channel.signal = () => {};
  channel.eof = () => {};
  channel.exit = () => {};
  channel.close = () => {};
  channel.destroy = () => {};

  return channel;
}

describe('createSSHChannel', () => {
  it('should remove channel listeners when data$ unsubscribes', () => {
    const channel = createMockChannel();
    const sshChannel = createSSHChannel({} as any, channel as any);

    const subscription = sshChannel.data$.subscribe(() => {});

    expect(channel.listenerCount('data')).toBe(1);

    subscription.unsubscribe();

    expect(channel.listenerCount('data')).toBe(0);
  });

  it('should remove stderr listeners when error$ unsubscribes', () => {
    const channel = createMockChannel();
    const sshChannel = createSSHChannel({} as any, channel as any);

    const subscription = sshChannel.error$.subscribe(() => {});

    expect(channel.stderr.listenerCount('data')).toBe(1);

    subscription.unsubscribe();

    expect(channel.stderr.listenerCount('data')).toBe(0);
  });
});
