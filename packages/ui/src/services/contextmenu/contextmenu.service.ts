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

import type { IDisposable } from '@termlnk/core';
import { createIdentifier, Disposable, toDisposable } from '@termlnk/core';

export interface IContextMenuHandler {
  readonly visible: boolean;
  handleContextMenu(event: MouseEvent, menuType: string): void;
  hideContextMenu(): void;
}

export interface IContextMenuService {
  /**
   * Globally enable/disable contextmenu triggering. When disabled, any call to
   * `triggerContextMenu` is a no-op. Useful for immersive/full-screen modes or
   * read-only application states that suppress every context menu at once.
   */
  disabled: boolean;
  get visible(): boolean;

  enable(): void;
  disable(): void;

  /**
   * Trigger contextmenu at the cursor for a given position key. Callers are
   * expected to update any relevant domain service (e.g. "focused host") with
   * the current target *before* invoking this method — menu items and their
   * target commands read that state through DI, not through parameters.
   */
  triggerContextMenu(event: MouseEvent, menuType: string): void;
  hideContextMenu(): void;

  /**
   * Register the single active consumer. Registering a new handler replaces
   * the previous one so at most one context menu can be alive, mirroring the
   * `univer` design (contextmenu-host pattern) and preventing menu overlap.
   */
  registerContextMenuHandler(handler: IContextMenuHandler): IDisposable;
}
export const IContextMenuService = createIdentifier<IContextMenuService>('ui.context-menu-service');

export class ContextMenuService extends Disposable implements IContextMenuService {
  private _disabled = false;
  private _handler: IContextMenuHandler | null = null;

  get disabled(): boolean {
    return this._disabled;
  }

  set disabled(value: boolean) {
    this._disabled = value;
    if (value) {
      this._handler?.hideContextMenu();
    }
  }

  get visible(): boolean {
    return this._handler?.visible ?? false;
  }

  enable(): void {
    this.disabled = false;
  }

  disable(): void {
    this.disabled = true;
  }

  triggerContextMenu(event: MouseEvent, menuType: string): void {
    if (this._disabled) {
      return;
    }
    this._handler?.handleContextMenu(event, menuType);
  }

  hideContextMenu(): void {
    this._handler?.hideContextMenu();
  }

  registerContextMenuHandler(handler: IContextMenuHandler): IDisposable {
    this._handler = handler;
    return toDisposable(() => {
      if (this._handler === handler) {
        this._handler = null;
      }
    });
  }

  override dispose(): void {
    super.dispose();
    this._handler = null;
  }
}
