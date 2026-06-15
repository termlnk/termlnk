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

export interface IMobileHostKeyFirstUseEvent {
  readonly type: 'host_key_first_use';
  readonly hostId: string;
  readonly host: string;
  readonly port: number;
  readonly algorithm: string;
  readonly fingerprintSha256: string;
  readonly respond: (accept: boolean) => void;
}

export interface IMobileHostKeyMismatchEvent {
  readonly type: 'host_key_mismatch';
  readonly hostId: string;
  readonly host: string;
  readonly port: number;
  readonly algorithm: string;
  readonly fingerprintSha256: string;
  readonly storedAlgorithm: string;
  readonly storedFingerprint: string;
  readonly respond: (replaceAndContinue: boolean) => void;
}

export interface IMobileAuthFailedEvent {
  readonly type: 'auth_failed';
  readonly hostId: string;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly message: string;
  readonly respond: (newPassword: string | null) => void;
}

export type MobileSshSessionEvent =
  | IMobileHostKeyFirstUseEvent
  | IMobileHostKeyMismatchEvent
  | IMobileAuthFailedEvent;
