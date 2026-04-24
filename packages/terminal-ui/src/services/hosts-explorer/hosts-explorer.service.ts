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

import type { HostItem } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * HostExplorer shared state. Holds:
 *
 * 1. `focusedHost$` — the single global source of truth for "which host/group
 *    is currently the user's target". Commands (delete, rename, etc.), menu
 *    items (disabled$/hidden$), shortcuts and extensions all read from here
 *    instead of receiving the target via parameters. This mirrors univer's
 *    pattern where `SelectionManagerService` carries the active selection and
 *    every downstream consumer subscribes to it.
 *
 * 2. `renameRequest$` — a one-shot UI intent bus for entering inline renaming
 *    on a specific tree item. The headless-tree instance lives inside the
 *    React view, so commands push the intent here and the view drives it.
 */
export interface IHostExplorerService {
  readonly focusedHost$: Observable<HostItem | null>;
  readonly renameRequest$: Observable<string>;
  readonly createGroupRequest$: Observable<void>;

  getFocusedHost(): HostItem | null;
  setFocusedHost(host: HostItem | null): void;

  requestRename(itemId: string): void;
  requestCreateGroup(): void;
}
export const IHostExplorerService = createIdentifier<IHostExplorerService>('terminal-ui.hosts-explorer-service');

export class HostExplorerService extends Disposable implements IHostExplorerService {
  private readonly _focusedHost$ = new BehaviorSubject<HostItem | null>(null);
  readonly focusedHost$: Observable<HostItem | null> = this._focusedHost$.asObservable();

  private readonly _renameRequest$ = new Subject<string>();
  readonly renameRequest$: Observable<string> = this._renameRequest$.asObservable();

  private readonly _createGroupRequest$ = new Subject<void>();
  readonly createGroupRequest$: Observable<void> = this._createGroupRequest$.asObservable();

  getFocusedHost(): HostItem | null {
    return this._focusedHost$.getValue();
  }

  setFocusedHost(host: HostItem | null): void {
    if (this._focusedHost$.getValue() === host) {
      return;
    }
    this._focusedHost$.next(host);
  }

  requestRename(itemId: string): void {
    this._renameRequest$.next(itemId);
  }

  requestCreateGroup(): void {
    this._createGroupRequest$.next();
  }

  override dispose(): void {
    super.dispose();
    this._focusedHost$.complete();
    this._renameRequest$.complete();
    this._createGroupRequest$.complete();
  }
}
