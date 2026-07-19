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

import type { IDisposable } from '@termlnk/core';
import type { Buffer } from 'node:buffer';
import type { ChannelSubType, ChannelType, ClientChannel } from 'ssh2';
import type { ISSHSocket } from './ssh-socket';
import { DisposableCollection, toDisposable } from '@termlnk/core';
import { Observable, share } from 'rxjs';

export interface ISSHChannel extends IDisposable {
  readonly socket: ISSHSocket;
  readonly server: boolean;
  readonly type: ChannelType;
  readonly subtype: ChannelSubType | undefined;

  write(data: string | Uint8Array): void;
  setWindow(rows: number, cols: number, height: number, width: number): void;
  signal(signalName: string): void;
  eof(): void;
  exit(status: number): void;
  exit(signalName: string, coreDumped?: boolean, msg?: string): void;
  close(...args: any[]): void;
  destroy(): void;
  pause(): void;
  resume(): void;

  data$: Observable<Uint8Array>;
  error$: Observable<Uint8Array>;

  eof$: Observable<void>;
  end$: Observable<void>;
  exit$: Observable<ISSHChannelExitEvent>;
  close$: Observable<void>;
}

export function createSSHChannel(socket: ISSHSocket, channel: ClientChannel): ISSHChannel {
  const disposables = new DisposableCollection();

  const sshChannel: ISSHChannel = {
    socket,
    server: channel.server,
    type: channel.type,
    subtype: channel.subtype,

    write: channel.write.bind(channel),
    setWindow: channel.setWindow.bind(channel),
    signal: channel.signal.bind(channel),
    exit: channel.exit.bind(channel),
    eof: channel.eof.bind(channel),
    close: channel.close.bind(channel),
    destroy: channel.destroy.bind(channel),
    pause: channel.pause.bind(channel),
    resume: channel.resume.bind(channel),

    data$: new Observable<Uint8Array>((subscriber) => {
      const callback = (data: Buffer) => subscriber.next(new Uint8Array(data));
      channel.on('data', callback);
      const cleanup = disposables.add(toDisposable(() => {
        channel.off('data', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    error$: new Observable<Uint8Array>((subscriber) => {
      const callback = (data: Buffer) => subscriber.next(new Uint8Array(data));
      channel.stderr.on('data', callback);
      const cleanup = disposables.add(toDisposable(() => {
        channel.stderr.off('data', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),

    eof$: new Observable<void>((subscriber) => {
      const callback = () => subscriber.next();
      channel.on('eof', callback);
      const cleanup = disposables.add(toDisposable(() => {
        channel.off('eof', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    end$: new Observable<void>((subscriber) => {
      const callback = () => subscriber.next();
      channel.on('end', callback);
      const cleanup = disposables.add(toDisposable(() => {
        channel.off('end', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    exit$: new Observable<ISSHChannelExitEvent>((subscriber) => {
      const callback = (code: number, signal: string, dump: string, desc: string) => subscriber.next({ code, signal, dump, desc });
      channel.on('exit', callback);
      const cleanup = disposables.add(toDisposable(() => {
        channel.off('exit', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    close$: new Observable<void>((subscriber) => {
      const callback = () => {
        subscriber.next();
        disposables.dispose();
      };
      channel.on('close', callback);
      const cleanup = disposables.add(toDisposable(() => {
        channel.off('close', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),

    dispose: () => {
      disposables.dispose();
    },
  };

  return sshChannel;
}

export interface ISSHChannelExitEvent {
  code: number;
  signal: string;
  dump: string;
  desc: string;
}
