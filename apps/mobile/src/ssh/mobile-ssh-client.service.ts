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

import SSHClient, { PtyType } from '@termlnk/react-native-ssh-sftp';
import { Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

// React Native side fat-client SSH abstraction. Wraps @termlnk/react-native-ssh-sftp
// (NMSSH on iOS / JSch on Android), our fork of @dylankenneally/react-native-ssh-sftp
// patched for Gradle 9 / AGP 8 and iOS Simulator support on Apple Silicon.
//
// Why this lib in v1:
//   - @fressh/react-native-uniffi-russh (Rust russh + uniffi-bindgen-rn) — preferred per
//     §7.3.1 — currently fails to install: its transitive `uniffi-bindgen-react-native#build-ts`
//     dependency points at a non-existent branch (last release 2025-10-08, abandoned).
//   - The dylankenneally NMSSH/JSch fork is the only RN library with active SFTP support.
//     We vendor it under the termlnk/react-native-ssh-sftp fork to fix Gradle 9 and pick
//     up DimaRU/Libssh2Prebuild's XCFramework so the Simulator links cleanly.
//   - Tradeoff: NMSSH/JSch families are pre-New-Arch — runtime relies on RN 0.85's legacy
//     bridge interop layer. v2+ replaces this with the Expo Module from §P6.9 once it ships.
//
// Contract surface intentionally narrow: connect/exec/disconnect plus a shell with an
// output Observable. SFTP is wired up by P6.5; pty resize is a P6.6 concern.

export type SshConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface IMobileSshConnectOptions {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly privateKey?: string;
  readonly passphrase?: string;
}

export interface IMobileSshSession {
  readonly host: string;
  readonly state: SshConnectionState;
  readonly state$: BehaviorSubject<SshConnectionState>;
  readonly shellOutput$: Subject<string>;

  exec: (command: string) => Promise<string>;
  startShell: (pty?: PtyType) => Promise<void>;
  writeToShell: (data: string) => Promise<void>;
  closeShell: () => void;
  disconnect: () => void;
}

class MobileSshSession extends Disposable implements IMobileSshSession {
  readonly state$ = new BehaviorSubject<SshConnectionState>('connected');
  readonly shellOutput$ = new Subject<string>();

  constructor(
    readonly host: string,
    private readonly _client: SSHClient
  ) {
    super();
    // The underlying lib emits a single string per chunk; we relay it verbatim.
    this._client.on('Shell', (event) => {
      if (typeof event === 'string') {
        this.shellOutput$.next(event);
      } else if (event && typeof event === 'object' && typeof (event as { value?: unknown }).value === 'string') {
        this.shellOutput$.next((event as { value: string }).value);
      }
    });
  }

  override dispose(): void {
    this.state$.next('disconnected');
    this.state$.complete();
    this.shellOutput$.complete();
    super.dispose();
  }

  get state(): SshConnectionState {
    return this.state$.getValue();
  }

  async exec(command: string): Promise<string> {
    return this._client.execute(command);
  }

  async startShell(pty: PtyType = PtyType.XTERM): Promise<void> {
    await this._client.startShell(pty);
  }

  async writeToShell(data: string): Promise<void> {
    await this._client.writeToShell(data);
  }

  closeShell(): void {
    this._client.closeShell();
  }

  disconnect(): void {
    this._client.disconnect();
    this.state$.next('disconnected');
  }
}

export class MobileSshClientService extends Disposable {
  async connect(options: IMobileSshConnectOptions): Promise<IMobileSshSession> {
    let client: SSHClient;
    if (options.privateKey) {
      client = await SSHClient.connectWithKey(
        options.host,
        options.port,
        options.username,
        options.privateKey,
        options.passphrase
      );
    } else if (options.password) {
      client = await SSHClient.connectWithPassword(
        options.host,
        options.port,
        options.username,
        options.password
      );
    } else {
      throw new Error('Either password or privateKey is required');
    }
    return new MobileSshSession(options.host, client);
  }
}

export { PtyType };
