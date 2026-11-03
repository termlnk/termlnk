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
import { createIdentifier, Disposable } from '@termlnk/core';
import { Subject } from 'rxjs';

/**
 * One-shot UI intent bus for the explorer panel: commands publish, the view
 * consumes. Keeps ⌘F wiring inside IShortcutService instead of having commands
 * reach into the DOM for an input element.
 */
export interface IProjectExplorerService {
  readonly focusFilterRequest$: Observable<void>;
  requestFocusFilter(): void;
}

export const IProjectExplorerService = createIdentifier<IProjectExplorerService>(
  'project-ui.project-explorer-service'
);

export class ProjectExplorerService extends Disposable implements IProjectExplorerService {
  private readonly _focusFilterRequest$ = new Subject<void>();
  readonly focusFilterRequest$: Observable<void> = this._focusFilterRequest$.asObservable();

  requestFocusFilter(): void {
    this._focusFilterRequest$.next();
  }

  override dispose(): void {
    super.dispose();
    this._focusFilterRequest$.complete();
  }
}
