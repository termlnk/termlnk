/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// P6.9-2 placeholder. The contract surface lands here so dependent code can
// import stable types; the implementation arrives in P6.9-5 once the ubrn
// bindings are generated. Every callable throws `unimplemented` so accidental
// runtime use during the package's intermediate state surfaces immediately.

import type {
  IBufferReadResult,
  IBufferStats,
  IConnectOptions,
  IStartShellOptions,
  IShellListenerOptions,
  ShellCursor,
  ShellListenerEvent,
} from './types';
import type { ISftpSession } from './sftp';

export interface ISshShell {
  readonly channelId: number;
  readonly createdAtMs: number;
  readonly connectionId: string;
  sendData: (data: ArrayBuffer, opts?: { signal?: AbortSignal }) => Promise<void>;
  close: (opts?: { signal?: AbortSignal }) => Promise<void>;
  bufferStats: () => IBufferStats;
  currentSeq: () => number;
  readBuffer: (cursor: ShellCursor, maxBytes?: bigint) => IBufferReadResult;
  addListener: (cb: (ev: ShellListenerEvent) => void, opts: IShellListenerOptions) => bigint;
  removeListener: (id: bigint) => void;
}

export interface ISshConnection {
  readonly connectionId: string;
  readonly createdAtMs: number;
  readonly connectedAtMs: number;
  startShell: (opts: IStartShellOptions) => Promise<ISshShell>;
  startSftp: () => Promise<ISftpSession>;
  disconnect: (opts?: { signal?: AbortSignal }) => Promise<void>;
}

const UNIMPLEMENTED = 'react-native-russh: SSH API not yet implemented — see plan P6.9-5.';

export async function connect(_opts: IConnectOptions): Promise<ISshConnection> {
  throw new Error(UNIMPLEMENTED);
}

export async function generateKeyPair(_type: 'rsa' | 'ecdsa' | 'ed25519'): Promise<string> {
  throw new Error(UNIMPLEMENTED);
}

export function validatePrivateKey(_key: string): { valid: boolean; error?: string } {
  throw new Error(UNIMPLEMENTED);
}

export async function uniffiInitAsync(): Promise<void> {
  throw new Error(UNIMPLEMENTED);
}
