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

// Public type surface for @termlnk/react-native-russh.

export type TerminalType =
  | 'Vanilla'
  | 'Vt100'
  | 'Vt102'
  | 'Vt220'
  | 'Ansi'
  | 'Xterm'
  | 'Xterm256';

export type SshSecurity =
  | { type: 'password'; password: string }
  | { type: 'key'; privateKey: string };

export interface IServerPublicKeyInfo {
  readonly host: string;
  readonly port: number;
  readonly remoteIp?: string;
  readonly algorithm: string;
  readonly fingerprintSha256: string;
  readonly keyBase64: string;
}

export type SshConnectionProgress = 'tcpConnected' | 'sshHandshake';

export interface IConnectOptions {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly security: SshSecurity;
  readonly onConnectionProgress?: (status: SshConnectionProgress) => void;
  readonly onDisconnected?: (connectionId: string) => void;
  readonly onServerKey: (info: IServerPublicKeyInfo, signal?: AbortSignal) => Promise<boolean>;
  readonly abortSignal?: AbortSignal;
}

export interface ITerminalMode {
  readonly opcode: number;
  readonly value: number;
}

export interface ITerminalSize {
  readonly rowHeight?: number;
  readonly colWidth?: number;
}

export interface ITerminalPixelSize {
  readonly pixelWidth?: number;
  readonly pixelHeight?: number;
}

export interface IStartShellOptions {
  readonly term: TerminalType;
  readonly terminalMode?: readonly ITerminalMode[];
  readonly terminalSize?: ITerminalSize;
  readonly terminalPixelSize?: ITerminalPixelSize;
  readonly onClosed?: (channelId: number) => void;
  readonly abortSignal?: AbortSignal;
}

export type StreamKind = 'stdout' | 'stderr';

export interface ITerminalChunk {
  readonly seq: bigint;
  readonly tMs: number;
  readonly stream: StreamKind;
  readonly bytes: ArrayBuffer;
}

export interface IDropNotice {
  readonly kind: 'dropped';
  readonly fromSeq: bigint;
  readonly toSeq: bigint;
}

export type ShellListenerEvent = ITerminalChunk | IDropNotice;

export type ShellCursor =
  | { mode: 'head' }
  | { mode: 'tailBytes'; bytes: bigint }
  | { mode: 'seq'; seq: bigint }
  | { mode: 'time'; tMs: number }
  | { mode: 'live' };

export interface IShellListenerOptions {
  readonly cursor: ShellCursor;
  readonly coalesceMs?: number;
}

export interface IBufferReadResult {
  readonly chunks: readonly ITerminalChunk[];
  readonly nextSeq: bigint;
  readonly dropped?: { readonly fromSeq: bigint; readonly toSeq: bigint };
}

export interface IBufferStats {
  readonly ringBytesCount: bigint;
  readonly usedBytes: bigint;
  readonly headSeq: bigint;
  readonly tailSeq: bigint;
  readonly droppedBytesTotal: bigint;
  readonly chunksCount: bigint;
}

// SFTP types — additive over the fressh API surface.

export interface ISftpEntry {
  readonly filename: string;
  readonly isDirectory: boolean;
  readonly isSymlink: boolean;
  readonly size: bigint;
  readonly mode: number;
  readonly modifiedAtMs: number;
  readonly accessedAtMs: number;
}

export interface ISftpStat {
  readonly isDirectory: boolean;
  readonly isSymlink: boolean;
  readonly size: bigint;
  readonly mode: number;
  readonly modifiedAtMs: number;
  readonly accessedAtMs: number;
}

export interface ISftpTransferProgress {
  readonly transferId: string;
  readonly bytesDone: bigint;
  readonly total?: bigint;
}

export interface ISftpTransferHandle {
  readonly transferId: string;
  readonly remotePath: string;
  readonly localPath: string;
  readonly total?: bigint;
  readonly cancel: () => boolean;
  readonly done: Promise<void>;
}

export interface ISftpTransferOptions {
  readonly chunkSize?: number;
  readonly onProgress?: (progress: ISftpTransferProgress) => void;
}

export type RusshErrorKind =
  | 'authFailed'
  | 'cancelled'
  | 'connectionReset'
  | 'hostUnreachable'
  | 'invalidKey'
  | 'permissionDenied'
  | 'notFound'
  | 'protocol'
  | 'localIo'
  | 'serverKeyRejected'
  | 'timeout'
  | 'unknown';

export interface IRusshError {
  readonly kind: RusshErrorKind;
  readonly message: string;
}
