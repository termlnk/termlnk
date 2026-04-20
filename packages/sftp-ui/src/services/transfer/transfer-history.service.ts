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

import type { ISFTPTransferTask } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'sftp-ui.transfer-history';
const MAX_HISTORY = 100;

export interface ITransferHistoryService {
  readonly transfers$: Observable<ISFTPTransferTask[]>;
  readonly overlayVisible$: Observable<boolean>;

  transfers: ISFTPTransferTask[];
  overlayVisible: boolean;

  updateTransfer(task: ISFTPTransferTask): void;
  clearCompleted(): void;
  toggleOverlay(): void;
  showOverlay(): void;
  hideOverlay(): void;
}

export const ITransferHistoryService = createIdentifier<ITransferHistoryService>('sftp-ui.transfer-history-service');

function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export class TransferHistoryService extends Disposable implements ITransferHistoryService {
  private readonly _transfers$ = new BehaviorSubject<ISFTPTransferTask[]>([]);
  readonly transfers$: Observable<ISFTPTransferTask[]> = this._transfers$.asObservable();
  get transfers(): ISFTPTransferTask[] { return this._transfers$.getValue(); }

  private readonly _overlayVisible$ = new BehaviorSubject<boolean>(false);
  readonly overlayVisible$: Observable<boolean> = this._overlayVisible$.asObservable();
  get overlayVisible(): boolean { return this._overlayVisible$.getValue(); }

  constructor(
    @IConfigManagerService private readonly _configManager: IConfigManagerService
  ) {
    super();
    this._loadHistory();
  }

  updateTransfer(task: ISFTPTransferTask): void {
    const current = this.transfers;
    const idx = current.findIndex((t) => t.id === task.id);
    let next: ISFTPTransferTask[];
    if (idx >= 0) {
      next = [...current];
      next[idx] = task;
    } else {
      next = [...current, task];
    }

    // Trim to max history
    if (next.length > MAX_HISTORY) {
      // Remove oldest terminal entries first
      const terminalIndices: number[] = [];
      for (let i = 0; i < next.length; i++) {
        if (isTerminal(next[i].status)) {
          terminalIndices.push(i);
        }
      }
      while (next.length > MAX_HISTORY && terminalIndices.length > 0) {
        const removeIdx = terminalIndices.shift()!;
        next.splice(removeIdx, 1);
        // Adjust remaining indices
        for (let j = 0; j < terminalIndices.length; j++) {
          if (terminalIndices[j] > removeIdx) {
            terminalIndices[j]--;
          }
        }
      }
    }

    this._transfers$.next(next);
    this._persistHistory(next);
  }

  clearCompleted(): void {
    const next = this.transfers.filter((t) => !isTerminal(t.status));
    this._transfers$.next(next);
    this._persistHistory(next);
  }

  toggleOverlay(): void {
    this._overlayVisible$.next(!this.overlayVisible);
  }

  showOverlay(): void {
    this._overlayVisible$.next(true);
  }

  hideOverlay(): void {
    this._overlayVisible$.next(false);
  }

  override dispose(): void {
    super.dispose();
    this._transfers$.complete();
    this._overlayVisible$.complete();
  }

  private async _loadHistory(): Promise<void> {
    const stored = await this._configManager.get<ISFTPTransferTask[]>(STORAGE_KEY);
    if (stored && Array.isArray(stored)) {
      // Only load terminal (completed/failed/cancelled) records
      const history = stored.filter((t) => isTerminal(t.status));
      this._transfers$.next(history);
    }
  }

  private _persistHistory(tasks: ISFTPTransferTask[]): void {
    const toStore = tasks.filter((t) => isTerminal(t.status)).slice(-MAX_HISTORY);
    this._configManager.set(STORAGE_KEY, toStore).catch(() => {});
  }
}
