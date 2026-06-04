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
import type { Duplex } from 'node:stream';
import type { AcceptConnection, ChangePasswordCallback, ClientCallback, ClientChannel, ClientErrorExtensions, ConnectConfig, ExecOptions, KeyboardInteractiveCallback, NegotiatedAlgorithms, ParsedKey, Prompt, PseudoTtyOptions, RejectConnection, SFTPWrapper, ShellOptions, TcpConnectionDetails, UNIXConnectionDetails, X11Details } from 'ssh2';
import type { ISSHChannel } from './ssh-channel';
import { DisposableCollection, toDisposable } from '@termlnk/core';
import { SSHSocketStatus } from '@termlnk/rpc';
import { BehaviorSubject, Observable, share } from 'rxjs';
import { Client } from 'ssh2';
import { createSSHChannel } from './ssh-channel';

export interface ISSHSocket extends IDisposable {
  id: string;

  readonly status$: Observable<SSHSocketStatus>;
  status: SSHSocketStatus;

  connect(opts: ConnectConfig): void;
  end(): void;
  destroy(): void;

  exec(command: string, options: ExecOptions): Promise<ISSHChannel>;
  exec(command: string): Promise<ISSHChannel>;

  shell(window: PseudoTtyOptions | false, options: ShellOptions): Promise<ISSHChannel>;
  shell(window: PseudoTtyOptions | false): Promise<ISSHChannel>;
  shell(options: ShellOptions): Promise<ISSHChannel>;
  shell(): Promise<ISSHChannel>;

  forwardIn(remoteAddr: string, remotePort: number): Promise<number>;
  unforwardIn(remoteAddr: string, remotePort: number): Promise<void>;
  forwardOut(srcIP: string, srcPort: number, dstIP: string, dstPort: number): Promise<Duplex>;
  sftp(): Promise<SFTPWrapper>;
  subsys(subsystem: string): Promise<ISSHChannel>;
  setNoDelay(noDelay?: boolean): Promise<void>;

  // TCP Connection
  connect$: Observable<void>;

  // Protocol handshake
  greeting$: Observable<string>;
  handshake$: Observable<IHandshakeEvent>;

  // Certification
  banner$: Observable<string>;
  keyboardInteractive$: Observable<IKeyboardInteractiveEvent>;
  changePassword$: Observable<IChangePasswordEvent>;
  ready$: Observable<void>;

  // During the session
  x11$: Observable<IX11Event>;
  tcpConnection$: Observable<ITcpConnectionEvent>;
  hostkeys$: Observable<IHostkeysEvent>;
  unixConnection$: Observable<IUnixConnectionEvent>;

  // Close connection
  timeout$: Observable<void>;
  error$: Observable<IErrorEvent>;
  end$: Observable<void>;
  close$: Observable<void>;
}

export function createSSHSocket(id: string): ISSHSocket {
  const client = new Client();
  const disposables = new DisposableCollection();
  const _status$ = new BehaviorSubject<SSHSocketStatus>(SSHSocketStatus.IDLE);

  const sshSocket: ISSHSocket = {
    id,
    status$: _status$.asObservable(),
    get status() {
      return _status$.getValue();
    },

    // config.hostVerifier is set by SSHSocketService.createConnectConfig, which owns
    // host-key classification and known-hosts persistence.
    connect: (config: ConnectConfig) => {
      _status$.next(SSHSocketStatus.CONNECTING);
      client.connect(config);
    },
    end: client.end.bind(client),
    destroy: client.destroy.bind(client),

    exec: (...args: any[]): Promise<ISSHChannel> => {
      return new Promise((resolve, reject) => {
        const cb: ClientCallback = (err, channel) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(createSSHChannel(sshSocket, channel));
        };
        (client.exec as Function)(...args, cb);
      });
    },

    shell: (...args: any[]): Promise<ISSHChannel> => {
      return new Promise((resolve, reject) => {
        const cb: ClientCallback = (err, channel) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(createSSHChannel(sshSocket, channel));
        };
        (client.shell as Function)(...args, cb);
      });
    },

    forwardIn: (remoteAddr: string, remotePort: number): Promise<number> => {
      return new Promise((resolve, reject) => {
        client.forwardIn(remoteAddr, remotePort, (err, port) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(port);
        });
      });
    },

    unforwardIn: (remoteAddr: string, remotePort: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        client.unforwardIn(remoteAddr, remotePort, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    },

    /**
     * Open a transparent TCP tunnel to (dstIP:dstPort) over this SSH connection.
     * Returns a Duplex stream, not an ISSHChannel: forwarded channels are raw
     * byte pipes with no PTY/signal/exit semantics, fed directly into the next
     * hop's ssh2 ConnectConfig.sock.
     */
    forwardOut: (srcIP: string, srcPort: number, dstIP: string, dstPort: number): Promise<Duplex> => {
      return new Promise((resolve, reject) => {
        client.forwardOut(srcIP, srcPort, dstIP, dstPort, (err, channel) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(channel);
        });
      });
    },

    sftp: (): Promise<SFTPWrapper> => {
      return new Promise((resolve, reject) => {
        client.sftp((err, sftp) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(sftp);
        });
      });
    },

    subsys: (subsystem: string): Promise<ISSHChannel> => {
      return new Promise((resolve, reject) => {
        client.subsys(subsystem, (err, channel) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(createSSHChannel(sshSocket, channel));
        });
      });
    },

    setNoDelay: async (noDelay?: boolean): Promise<void> => {
      client.setNoDelay(noDelay);
    },

    // 1. TCP Connection
    connect$: new Observable<void>((subscriber) => {
      const callback = () => {
        _status$.next(SSHSocketStatus.CONNECTED);
        subscriber.next();
      };
      client.on('connect', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('connect', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),

    // 2. Protocol handshake
    greeting$: new Observable<string>((subscriber) => {
      const callback = (greeting: string) => subscriber.next(greeting);
      client.on('greeting', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('greeting', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    handshake$: new Observable<IHandshakeEvent>((subscriber) => {
      const callback = (negotiated: NegotiatedAlgorithms) => subscriber.next({ negotiated });
      client.on('handshake', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('handshake', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),

    // 3. Certification
    banner$: new Observable<string>((subscriber) => {
      const callback = (message: string) => subscriber.next(message);
      client.on('banner', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('banner', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    keyboardInteractive$: new Observable<IKeyboardInteractiveEvent>((subscriber) => {
      const callback = (name: string, instructions: string, lang: string, prompts: Prompt[], finish: KeyboardInteractiveCallback) =>
        subscriber.next({ name, instructions, lang, prompts, finish });
      client.on('keyboard-interactive', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('keyboard-interactive', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    changePassword$: new Observable<IChangePasswordEvent>((subscriber) => {
      const callback = (message: string, done: ChangePasswordCallback) => subscriber.next({ message, done });
      client.on('change password', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('change password', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    ready$: new Observable<void>((subscriber) => {
      const callback = () => {
        _status$.next(SSHSocketStatus.READY);
        subscriber.next();
      };
      client.on('ready', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('ready', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),

    // 4. During the session
    x11$: new Observable<IX11Event>((subscriber) => {
      const callback = (details: X11Details, accept: AcceptConnection<ClientChannel>, reject: RejectConnection) =>
        subscriber.next({ details, accept, reject });
      client.on('x11', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('x11', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    tcpConnection$: new Observable<ITcpConnectionEvent>((subscriber) => {
      const callback = (details: TcpConnectionDetails, accept: AcceptConnection<ClientChannel>, reject: RejectConnection) =>
        subscriber.next({ details, accept, reject });
      client.on('tcp connection', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('tcp connection', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    unixConnection$: new Observable<IUnixConnectionEvent>((subscriber) => {
      const callback = (info: UNIXConnectionDetails, accept: AcceptConnection, reject: RejectConnection) =>
        subscriber.next({ info, accept, reject });
      client.on('unix connection', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('unix connection', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    hostkeys$: new Observable<IHostkeysEvent>((subscriber) => {
      const callback = (keys: ParsedKey[]) => subscriber.next({ keys });
      client.on('hostkeys', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('hostkeys', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),

    // 5. Close connection
    timeout$: new Observable<void>((subscriber) => {
      const callback = () => subscriber.next();
      client.on('timeout', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('timeout', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    error$: new Observable<IErrorEvent>((subscriber) => {
      const callback = (err: Error & ClientErrorExtensions) => subscriber.next({ err });
      client.on('error', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('error', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    end$: new Observable<void>((subscriber) => {
      const callback = () => subscriber.next();
      client.on('end', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('end', callback);
        subscriber.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),
    close$: new Observable<void>((subscriber) => {
      const callback = () => {
        _status$.next(SSHSocketStatus.CLOSED);
        subscriber.next();
        disposables.dispose();
      };
      client.on('close', callback);
      const cleanup = disposables.add(toDisposable(() => {
        client.off('close', callback);
        subscriber.complete();
        _status$.complete();
      }));
      return () => cleanup.dispose();
    }).pipe(share()),

    dispose: () => {
      disposables.dispose();
    },
  };

  return sshSocket;
}

export interface IX11Event {
  details: X11Details;
  accept: AcceptConnection<ClientChannel>;
  reject: RejectConnection;
}

export interface IChangePasswordEvent {
  message: string;
  done: ChangePasswordCallback;
}

export interface IErrorEvent {
  err: Error & ClientErrorExtensions;
}

export interface IHandshakeEvent {
  negotiated: NegotiatedAlgorithms;
}

export interface ITcpConnectionEvent {
  details: TcpConnectionDetails;
  accept: AcceptConnection<ClientChannel>;
  reject: RejectConnection;
}

export interface IKeyboardInteractiveEvent {
  name: string;
  instructions: string;
  lang: string;
  prompts: Prompt[];
  finish: KeyboardInteractiveCallback;
}

export interface IHostkeysEvent {
  keys: ParsedKey[];
}

export interface IUnixConnectionEvent {
  info: UNIXConnectionDetails;
  accept: AcceptConnection;
  reject: RejectConnection;
}
