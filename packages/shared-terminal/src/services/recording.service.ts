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

import type { Observable } from 'rxjs';
import { createIdentifier } from '@termlnk/core';

/** Handle returned by start(); pass to stop() to persist and list. */
export interface IRecordingHandle {
  readonly id: string;
  readonly sessionId: string;
  readonly startedAt: number;
  readonly path: string;
  /** Auditor-triggered mandatory recording — UI must not allow stopping. */
  readonly mandatory: boolean;
}

/** Recording metadata returned by list(). */
export interface IRecordingMetadata {
  readonly id: string;
  readonly sessionId: string;
  readonly title: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly path: string;
  readonly bytes: number;
  readonly auditLogPath: string | null;
}

/**
 * asciicast v2 + audit JSONL recording for collaboration sessions.
 * Stored owner-side only (~/.termlnk/recordings/); the relay never holds recordings.
 * Defaults to off. Any auditor joining forces recording on.
 */
export interface ISharedSessionRecordingService {
  start(options: { sessionId: string; title: string; mandatory: boolean }): Promise<IRecordingHandle>;
  stop(handle: IRecordingHandle, force?: boolean): Promise<void>;
  appendOutput(handle: IRecordingHandle, chunk: Uint8Array): Promise<void>;
  appendAuditEvent(handle: IRecordingHandle, event: Record<string, unknown>): Promise<void>;
  list(): Promise<readonly IRecordingMetadata[]>;
  delete(id: string): Promise<boolean>;
  readonly activeRecordings$: Observable<readonly IRecordingHandle[]>;
}

export const ISharedSessionRecordingService = createIdentifier<ISharedSessionRecordingService>(
  'shared-terminal.session-recording-service'
);
