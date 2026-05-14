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

/**
 * Driver arbitration state — at most one client holds the keyboard at any
 * given moment.
 *
 * See cloud-sync-architecture.md §5.7.3 (free-competition protocol + soft-lock UI).
 *
 * Protocol layer: every writer may send stdin and the PTY consumes bytes in
 * arrival order (nothing is dropped).
 * UI layer: only the client marked as `driverId` sends by default; the rest
 * are intercepted with a "press X to take the keyboard" prompt.
 */
export interface IDriverState {
  readonly sessionId: string;
  readonly driverId: string | null;
  /** Last driver heartbeat; auto-clears after `SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS`. */
  readonly lastHeartbeatAt: number;
  /** When true, the owner has locked the driver — only the owner can hand it off. */
  readonly locked: boolean;
}

/** Driver request / handover / release — control-channel JSON payload. */
export type IDriverHandover =
  | {
    readonly type: 'driver_request';
    readonly sessionId: string;
    readonly fromClientId: string;
  }
  | {
    readonly type: 'driver_handover';
    readonly sessionId: string;
    readonly fromClientId: string | null;
    readonly toClientId: string;
  }
  | {
    readonly type: 'driver_release';
    readonly sessionId: string;
    readonly fromClientId: string;
  };
