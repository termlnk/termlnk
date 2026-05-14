/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// Public facade for @termlnk/react-native-russh. Consumers import from here.

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
