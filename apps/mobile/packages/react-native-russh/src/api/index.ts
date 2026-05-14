/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// Public facade for @termlnk/react-native-russh.
//
// Stable contract surface across P6.9 sub-items:
//   • types.ts  — TS types (ABI is the same shape post-impl)
//   • ssh.ts    — SshConnection / SshShell + top-level connect/generateKeyPair/validatePrivateKey
//   • sftp.ts   — SftpSession via SshConnection.startSftp()
//
// During P6.9-2 → P6.9-4 the callables throw `unimplemented`. P6.9-5 swaps
// the implementation onto the ubrn-generated bindings while the type surface
// stays put — consumers compile against this barrel from the start.

export type {
  IServerPublicKeyInfo,
  ITerminalChunk,
  IDropNotice,
  ITerminalMode,
  ITerminalPixelSize,
  ITerminalSize,
  IBufferReadResult,
  IBufferStats,
  ISftpEntry,
  ISftpStat,
  ISftpTransferHandle,
  ISftpTransferProgress,
  ISftpTransferOptions,
  IRusshError,
  IShellListenerOptions,
  ShellListenerEvent,
  ShellCursor,
  StreamKind,
  SshConnectionProgress,
  SshSecurity,
  TerminalType,
  RusshErrorKind,
  IConnectOptions,
  IStartShellOptions,
} from './types';
export type { ISshConnection, ISshShell } from './ssh';
export type { ISftpSession } from './sftp';

import {
  connect,
  generateKeyPair,
  uniffiInitAsync,
  validatePrivateKey,
} from './ssh';

export const RnRussh = {
  uniffiInitAsync,
  connect,
  generateKeyPair,
  validatePrivateKey,
};
