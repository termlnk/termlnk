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
 * Runtime status of an extension.
 *
 * Transitions:
 *   Discovered → Installed → Activating → Activated → Deactivating → Deactivated
 *                                ↑                                        │
 *                                └────────── (re-enable) ─────────────────┘
 *
 * - `Disabled`: user explicitly disabled, do not auto-activate on startup.
 * - `Error`: activation threw; scope has been rolled back and the extension
 *   is quarantined until the user manually reloads/disables it.
 */
export enum ExtensionStatus {
  Discovered = 'discovered',
  Installed = 'installed',
  Activating = 'activating',
  Activated = 'activated',
  Deactivating = 'deactivating',
  Deactivated = 'deactivated',
  Disabled = 'disabled',
  Error = 'error',
}
