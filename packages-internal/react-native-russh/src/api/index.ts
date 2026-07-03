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

// Public facade for @termlnk/react-native-russh. Consumers import from here.

import { connect, generateKeyPair, uniffiInitAsync, validatePrivateKey } from './ssh';

export { RusshError } from './errors';

export type { ForwardTunnelStatus, IDynamicForwardConfig, IForwardHandle, IForwardTunnelCallback, IForwardTunnelStats, ILocalForwardConfig, IRemoteForwardConfig } from './port-forward';
export type { ISftpSession } from './sftp';
export type { ISshConnection, ISshShell } from './ssh';
export type { IGeneratedKeyMaterial } from './ssh';

export type { IBufferReadResult, IBufferStats, IConnectOptions, IDropNotice, IRusshError, IServerPublicKeyInfo, ISftpEntry, ISftpStat, ISftpTransferHandle, ISftpTransferOptions, ISftpTransferProgress, IShellListenerOptions, IStartShellOptions, ITerminalChunk, ITerminalMode, ITerminalPixelSize, ITerminalSize, RusshErrorKind, ShellCursor, ShellListenerEvent, SshConnectionProgress, SshSecurity, StreamKind, TerminalType } from './types';

export const RnRussh = {
  uniffiInitAsync,
  connect,
  generateKeyPair,
  validatePrivateKey,
};
