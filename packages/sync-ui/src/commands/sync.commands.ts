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

import type { IAccessor, ICommand } from '@termlnk/core';
import { Quantity } from '@termlnk/core';
import { ISyncService } from '@termlnk/sync';
import { firstValueFrom } from 'rxjs';

// Sync command set, invokable by extensions / shortcuts / scripts via
// ICommandService.executeCommand. Each command silently returns false when ISyncService is
// unbound (cloud not configured), so callers can detect "unavailable in this build"
// without an RPC exception.

// Equivalent to SyncStatusPanel's "Sync now" button.
export const SyncNowCommand: ICommand = {
  id: 'sync.command.sync-now',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    await sync.syncNow();
    return true;
  },
};

// Enables the sync engine (registers synchronisers on first enable).
export const EnableSyncCommand: ICommand = {
  id: 'sync.command.enable',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    await sync.enable();
    return true;
  },
};

// Stops the sync engine; local data is preserved.
export const DisableSyncCommand: ICommand = {
  id: 'sync.command.disable',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    await sync.disable();
    return true;
  },
};

// One-shot toggle based on enabled$. Friendlier for keyboard shortcuts than separate
// enable/disable commands.
export const ToggleSyncEnabledCommand: ICommand = {
  id: 'sync.command.toggle-enabled',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    const enabled = await firstValueFrom(sync.enabled$);
    if (enabled) {
      await sync.disable();
    } else {
      await sync.enable();
    }
    return true;
  },
};

// Equivalent to the "Resync from scratch" button: clears every cursor before the next pull.
export const ForceFullResyncCommand: ICommand = {
  id: 'sync.command.force-full-resync',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    await sync.forceFullResync();
    return true;
  },
};

export const SYNC_COMMANDS: readonly ICommand[] = [
  SyncNowCommand,
  EnableSyncCommand,
  DisableSyncCommand,
  ToggleSyncEnabledCommand,
  ForceFullResyncCommand,
] as const;
