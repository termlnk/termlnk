/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// Idiomatic TS wrappers over ubrn-generated bindings. Pattern mirrors
// fressh src/api.ts: uniffi's classes cannot be passed as plain objects
// with methods + props, so the wrapper layer flattens each handle into a
// fresh object that's safe to ferry across the JS bridge.

import * as GeneratedRussh from '../index';
import { wrapSftpSession } from './sftp';
import type {
  IBufferReadResult,
  IBufferStats,
  IConnectOptions,
  IServerPublicKeyInfo,
  IShellListenerOptions,
  IStartShellOptions,
  ITerminalChunk,
  ShellCursor,
  ShellListenerEvent,
  StreamKind,
  SshConnectionProgress,
  TerminalType,
} from './types';
import type { ISftpSession } from './sftp';

const terminalLiteralToEnum: Record<TerminalType, GeneratedRussh.TerminalType> = {
  Vanilla: GeneratedRussh.TerminalType.Vanilla,
  Vt100: GeneratedRussh.TerminalType.Vt100,
  Vt102: GeneratedRussh.TerminalType.Vt102,
  Vt220: GeneratedRussh.TerminalType.Vt220,
  Ansi: GeneratedRussh.TerminalType.Ansi,
  Xterm: GeneratedRussh.TerminalType.Xterm,
  Xterm256: GeneratedRussh.TerminalType.Xterm256,
};

const progressEnumToLiteral: Record<
  GeneratedRussh.SshConnectionProgressEvent,
  SshConnectionProgress
> = {
  [GeneratedRussh.SshConnectionProgressEvent.TcpConnected]: 'tcpConnected',
  [GeneratedRussh.SshConnectionProgressEvent.SshHandshake]: 'sshHandshake',
};

const streamEnumToLiteral: Record<GeneratedRussh.StreamKind, StreamKind> = {
  [GeneratedRussh.StreamKind.Stdout]: 'stdout',
  [GeneratedRussh.StreamKind.Stderr]: 'stderr',
};

function cursorToGenerated(cursor: ShellCursor): GeneratedRussh.Cursor {
  switch (cursor.mode) {
    case 'head':
      return GeneratedRussh.Cursor.Head.new();
    case 'tailBytes':
      return GeneratedRussh.Cursor.TailBytes.new({ bytes: cursor.bytes });
    case 'seq':
      return GeneratedRussh.Cursor.Seq.new({ seq: cursor.seq });
    case 'time':
      return GeneratedRussh.Cursor.TimeMs.new({ tMs: cursor.tMs });
    case 'live':
      return GeneratedRussh.Cursor.Live.new();
  }
}

function toTerminalChunk(ch: GeneratedRussh.TerminalChunk): ITerminalChunk {
  return {
    seq: ch.seq,
    tMs: ch.tMs,
    stream: streamEnumToLiteral[ch.stream],
    bytes: ch.bytes,
  };
}

function toServerKeyInfo(
  info: GeneratedRussh.ServerPublicKeyInfo,
): IServerPublicKeyInfo {
  return {
    host: info.host,
    port: info.port,
    remoteIp: info.remoteIp ?? undefined,
    algorithm: info.algorithm,
    fingerprintSha256: info.fingerprintSha256,
    keyBase64: info.keyBase64,
  };
}

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

function wrapShellSession(shell: GeneratedRussh.ShellSessionLike): ISshShell {
  const info = shell.getInfo();
  return {
    channelId: info.channelId,
    createdAtMs: info.createdAtMs,
    connectionId: info.connectionId,
    sendData: (data, o) =>
      shell.sendData(data, o?.signal ? { signal: o.signal } : undefined),
    close: (o) => shell.close(o?.signal ? { signal: o.signal } : undefined),
    bufferStats: () => {
      const stats = shell.bufferStats();
      return {
        ringBytesCount: stats.ringBytesCount,
        usedBytes: stats.usedBytes,
        headSeq: stats.headSeq,
        tailSeq: stats.tailSeq,
        droppedBytesTotal: stats.droppedBytesTotal,
        chunksCount: stats.chunksCount,
      };
    },
    currentSeq: () => Number(shell.currentSeq()),
    readBuffer: (cursor, maxBytes) => {
      const res = shell.readBuffer(cursorToGenerated(cursor), maxBytes);
      return {
        chunks: res.chunks.map(toTerminalChunk),
        nextSeq: res.nextSeq,
        dropped: res.dropped,
      };
    },
    addListener: (cb, opts) => {
      const listener: GeneratedRussh.ShellListener = {
        onEvent: (ev: GeneratedRussh.ShellEvent) => {
          if (GeneratedRussh.ShellEvent.Chunk.instanceOf(ev)) {
            cb(toTerminalChunk(ev.inner[0]));
          } else if (GeneratedRussh.ShellEvent.Dropped.instanceOf(ev)) {
            cb({
              kind: 'dropped',
              fromSeq: ev.inner.fromSeq,
              toSeq: ev.inner.toSeq,
            });
          }
        },
      };
      const id = shell.addListener(listener, {
        cursor: cursorToGenerated(opts.cursor),
        coalesceMs: opts.coalesceMs,
      });
      if (id === 0n) {
        throw new Error('Failed to attach shell listener (id=0)');
      }
      return id;
    },
    removeListener: (id) => shell.removeListener(id),
  };
}

function wrapConnection(conn: GeneratedRussh.SshConnectionLike): ISshConnection {
  const info = conn.getInfo();
  return {
    connectionId: info.connectionId,
    createdAtMs: info.createdAtMs,
    connectedAtMs: info.connectedAtMs,
    startShell: async (opts) => {
      const shell = await conn.startShell(
        {
          term: terminalLiteralToEnum[opts.term],
          terminalMode: opts.terminalMode
            ? opts.terminalMode.map((m) => ({ opcode: m.opcode, value: m.value }))
            : undefined,
          terminalSize: opts.terminalSize
            ? {
                rowHeight: opts.terminalSize.rowHeight,
                colWidth: opts.terminalSize.colWidth,
              }
            : undefined,
          terminalPixelSize: opts.terminalPixelSize
            ? {
                pixelWidth: opts.terminalPixelSize.pixelWidth,
                pixelHeight: opts.terminalPixelSize.pixelHeight,
              }
            : undefined,
          onClosedCallback: opts.onClosed
            ? { onChange: (channelId: number) => opts.onClosed!(channelId) }
            : undefined,
        },
        opts.abortSignal ? { signal: opts.abortSignal } : undefined,
      );
      return wrapShellSession(shell);
    },
    startSftp: async () => {
      const sftp = await conn.startSftp();
      return wrapSftpSession(sftp);
    },
    disconnect: (o) => conn.disconnect(o?.signal ? { signal: o.signal } : undefined),
  };
}

export async function connect(opts: IConnectOptions): Promise<ISshConnection> {
  const security =
    opts.security.type === 'password'
      ? GeneratedRussh.Security.Password.new({ password: opts.security.password })
      : GeneratedRussh.Security.Key.new({ privateKeyContent: opts.security.privateKey });

  const conn = await GeneratedRussh.connect(
    {
      connectionDetails: {
        host: opts.host,
        port: opts.port,
        username: opts.username,
        security,
      },
      onConnectionProgressCallback: opts.onConnectionProgress
        ? {
            onChange: (status: GeneratedRussh.SshConnectionProgressEvent) =>
              opts.onConnectionProgress!(progressEnumToLiteral[status]),
          }
        : undefined,
      onDisconnectedCallback: opts.onDisconnected
        ? { onChange: (connectionId: string) => opts.onDisconnected!(connectionId) }
        : undefined,
      onServerKeyCallback: {
        onChange: (serverKeyInfo: GeneratedRussh.ServerPublicKeyInfo) =>
          opts.onServerKey(toServerKeyInfo(serverKeyInfo), opts.abortSignal),
      },
    },
    opts.abortSignal ? { signal: opts.abortSignal } : undefined,
  );
  return wrapConnection(conn);
}

export async function generateKeyPair(
  type: 'rsa' | 'ecdsa' | 'ed25519',
): Promise<string> {
  const map: Record<typeof type, GeneratedRussh.KeyType> = {
    rsa: GeneratedRussh.KeyType.Rsa,
    ecdsa: GeneratedRussh.KeyType.Ecdsa,
    ed25519: GeneratedRussh.KeyType.Ed25519,
  };
  return GeneratedRussh.generateKeyPair(map[type]);
}

export function validatePrivateKey(
  key: string,
): { valid: true; error?: never } | { valid: false; error: GeneratedRussh.SshError } {
  try {
    GeneratedRussh.validatePrivateKey(key);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e as GeneratedRussh.SshError };
  }
}

export async function uniffiInitAsync(): Promise<void> {
  await GeneratedRussh.uniffiInitAsync();
}
