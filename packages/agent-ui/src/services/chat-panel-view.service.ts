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
import { BehaviorSubject } from 'rxjs';

/**
 * View state the chat panel body and its tab-bar buttons both need. The buttons
 * live in the shared side-panel tab bar rather than inside the panel, so this
 * cannot be component state anymore.
 */
export interface IChatPanelViewService {
  readonly showHistory$: Observable<boolean>;
  get showHistory(): boolean;

  setShowHistory(show: boolean): void;
  toggleHistory(): void;
}

export const IChatPanelViewService = createIdentifier<IChatPanelViewService>(
  'agent-ui.chat-panel-view-service'
);

export class ChatPanelViewService extends Disposable implements IChatPanelViewService {
  private readonly _showHistory$ = new BehaviorSubject<boolean>(false);
  readonly showHistory$: Observable<boolean> = this._showHistory$.asObservable();

  get showHistory(): boolean {
    return this._showHistory$.getValue();
  }

  setShowHistory(show: boolean): void {
    this._showHistory$.next(show);
  }

  toggleHistory(): void {
    this._showHistory$.next(!this._showHistory$.getValue());
  }

  override dispose(): void {
    super.dispose();
    this._showHistory$.complete();
  }
}
