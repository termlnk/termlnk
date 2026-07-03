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

import { createIdentifier } from '@termlnk/core';

// Outcome of prepareForRekey(). `reason` is a machine-readable hint for logs
// (e.g. 'master_key_locked', 'outbox_not_drained', 'cipher_mismatch',
// VAULT_REKEY_REASON_CLIENT_OUTDATED, 'network').
export interface IVaultRekeyPreparation {
  ok: boolean;
  reason?: string;
}

// Refusal emitted when this client's registered synchroniser set does not cover every
// resource key the server already stores data for: the running app is too old to
// re-encrypt everything, so the user must upgrade before changing the password.
// Exported (unlike the log-only reasons above) because auth-core branches on it to
// surface a dedicated 'client_upgrade_required' AuthError instead of 'sync_not_ready'.
export const VAULT_REKEY_REASON_CLIENT_OUTDATED = 'client_outdated';

// Bridges the password-change saga in auth-core to the sync engine without a package
// dependency in that direction. The sync layer registers its SyncService under this
// identifier (main process / mobile); auth-core injects it with @Optional and simply
// skips prepare/rekey when no sync stack is present (credential-only accounts).
export interface IVaultRekeyHandler {
  // Pre-flight gate run BEFORE the server credential swap: drain the outbox and prove
  // every synced row decrypts under the current key. Must never throw — failures are
  // reported through `ok: false` so the saga can abort with zero side effects.
  prepareForRekey(): Promise<IVaultRekeyPreparation>;

  // Re-encrypt all synced data under the (already activated) new master key. Must be
  // idempotent so a crashed run can be resumed from the persisted password-change journal.
  rekey(): Promise<void>;
}

export const IVaultRekeyHandler = createIdentifier<IVaultRekeyHandler>('auth.vault-rekey-handler');
