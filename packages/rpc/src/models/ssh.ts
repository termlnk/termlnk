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

export enum SSHSocketStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  READY = 'ready',
  CLOSED = 'closed',
}

export enum SSHSessionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  OPENING_SHELL = 'opening_shell',
  READY = 'ready',
  CLOSED = 'closed',
  AUTH_FAILED = 'auth_failed',
  ERROR = 'error',
}

export interface ISSHHopContext {
  /** Hop host id. Absent when the event originates from the target host. */
  viaHopId?: string;
  /** Hop host display name, used as a prompt prefix. */
  viaHopLabel?: string;
}

export type SSHHopProgressStatus = 'connecting' | 'authenticating' | 'ready' | 'failed';

export type SSHSessionEvent =
  | ({ type: 'auth_failed'; message: string } & ISSHHopContext)
  | ({ type: 'keyboard_interactive'; name: string; instructions: string; prompts: Array<{ prompt: string; echo: boolean }> } & ISSHHopContext)
  | ({ type: 'change_password'; message: string } & ISSHHopContext)
  | { type: 'host_key_verify'; algorithm: string; fingerprint: string; changed?: boolean; knownFingerprint?: string }
  | ({ type: 'banner'; message: string } & ISSHHopContext)
  | { type: 'log'; message: string }
  | { type: 'hop_progress'; hopId: string; hopLabel: string; hopIndex: number; hopCount: number; status: SSHHopProgressStatus; message?: string };
