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

export type FileTransferProtocol = 'zmodem' | 'trzsz';
export type FileTransferDirection = 'upload' | 'download';

export enum FileTransferEventType {
  STARTED = 'started',
  PROGRESS = 'progress',
  COMPLETE = 'complete',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

export interface IFileTransferStartedEvent {
  type: FileTransferEventType.STARTED;
  protocol: FileTransferProtocol;
  direction: FileTransferDirection;
  sessionId: string;
}

export interface IFileTransferProgressEvent {
  type: FileTransferEventType.PROGRESS;
  protocol: FileTransferProtocol;
  direction: FileTransferDirection;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  fileIndex?: number;
  fileCount?: number;
}

export interface IFileTransferCompleteEvent {
  type: FileTransferEventType.COMPLETE;
  protocol: FileTransferProtocol;
  direction: FileTransferDirection;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
}

export interface IFileTransferErrorEvent {
  type: FileTransferEventType.ERROR;
  protocol: FileTransferProtocol;
  message: string;
}

export interface IFileTransferCancelledEvent {
  type: FileTransferEventType.CANCELLED;
  protocol: FileTransferProtocol;
}

export type FileTransferEvent =
  | IFileTransferStartedEvent
  | IFileTransferProgressEvent
  | IFileTransferCompleteEvent
  | IFileTransferErrorEvent
  | IFileTransferCancelledEvent;
