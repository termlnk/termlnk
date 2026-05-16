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
 * Shared-terminal role — four-level permission model.
 *
 * See cloud-sync-architecture.md §5.7.2.
 *
 * | Role     | Permissions                                                                            | Notes                                                                  |
 * |----------|----------------------------------------------------------------------------------------|------------------------------------------------------------------------|
 * | Owner    | Holds the PTY; only one who can invite, revoke, kick, demote; always writable.         | Default for same-account device sign-ins.                              |
 * | CoPilot  | Invited writer; rotates input with owner / other co-pilots via a soft lock; can yield. | Typical cross-account role; also used by other devices of same account |
 * | Observer | Read-only; subscribes to PTY output but cannot send stdin; can mask sensitive echoes.  | Audience, support, teaching.                                           |
 * | Auditor  | Same permission as observer; **joining forces recording** and the UI marks them.       | Reserved for compliance.                                               |
 *
 * Phase 5 (same account): daemon = Owner, other signed-in devices = CoPilot.
 * Phase 5.5 (cross account): all four roles are used; invites carry the role in
 * the capability payload.
 */
export enum SharedTerminalRole {
  Owner = 'owner',
  CoPilot = 'co-pilot',
  Observer = 'observer',
  Auditor = 'auditor',
}

/**
 * Whether the role may send stdin. Owner / CoPilot are writers; Observer /
 * Auditor are read-only. Final dispatch goes through the UI's soft lock —
 * the `driver` flag decides what actually leaves the wire (see `IDriverState`).
 */
export function isWriterRole(role: SharedTerminalRole): boolean {
  return role === SharedTerminalRole.Owner || role === SharedTerminalRole.CoPilot;
}

/**
 * Whether the role forces session recording on. Auditors always do; other
 * roles let the owner pick in the UI.
 */
export function requiresMandatoryRecording(role: SharedTerminalRole): boolean {
  return role === SharedTerminalRole.Auditor;
}
