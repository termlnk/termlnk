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

export enum SFTPSessionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  OPENING_SFTP = 'opening_sftp',
  READY = 'ready',
  CLOSED = 'closed',
  AUTH_FAILED = 'auth_failed',
  ERROR = 'error',
}

export interface ISFTPFileEntry {
  filename: string;
  longname: string;
  attrs: ISFTPFileAttrs;
  isDirectory: boolean;
  isSymlink: boolean;
}

export interface ISFTPFileAttrs {
  mode: number;
  uid: number;
  gid: number;
  size: number;
  atime: number;
  mtime: number;
}

export enum TransferDirection {
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
}

export enum TransferStatus {
  PENDING = 'pending',
  TRANSFERRING = 'transferring',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ISFTPTransferTask {
  id: string;
  sessionId: string;
  direction: TransferDirection;
  localPath: string;
  remotePath: string;
  filename: string;
  totalBytes: number;
  transferredBytes: number;
  status: TransferStatus;
  error?: string;
}

export type SFTPSessionEvent =
  | { type: 'auth_failed'; message: string }
  | { type: 'keyboard_interactive'; name: string; instructions: string; prompts: Array<{ prompt: string; echo: boolean }> }
  | { type: 'change_password'; message: string }
  | { type: 'error'; message: string };
