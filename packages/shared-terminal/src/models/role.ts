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
 * Shared-terminal role — three-level permission model.
 *
 * The legacy four-role model included an `Auditor` role whose semantics were
 * "Observer + forced recording". Recording has since been decoupled from the
 * role enum and is now an owner-controlled per-session policy driven by the
 * session-log subsystem (see docs/agent/shared-terminal-multiplayer.md §4.5),
 * so the role enum collapses back to three values.
 *
 * | Role     | Permissions                                                                            | Notes                                                                  |
 * |----------|----------------------------------------------------------------------------------------|------------------------------------------------------------------------|
 * | Owner    | Holds the PTY; only one who can invite, revoke, kick, demote; always writable.         | Default for same-account device sign-ins.                              |
 * | CoPilot  | Invited writer; rotates input with owner / other co-pilots via a soft lock; can yield. | Typical cross-account role; also used by other devices of same account |
 * | Observer | Read-only; subscribes to PTY output but cannot send stdin.                             | Audience, support, teaching, audit.                                    |
 */
export enum SharedTerminalRole {
  Owner = 'owner',
  CoPilot = 'co-pilot',
  Observer = 'observer',
}

/**
 * Whether the role may send stdin. Owner / CoPilot are writers; Observer is
 * read-only. Final dispatch goes through the UI's soft lock — the `driver`
 * flag decides what actually leaves the wire (see `IDriverState`).
 */
export function isWriterRole(role: SharedTerminalRole): boolean {
  return role === SharedTerminalRole.Owner || role === SharedTerminalRole.CoPilot;
}
