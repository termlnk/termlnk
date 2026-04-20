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

import type { ContextService, IDisposable, Nullable } from '@termlnk/core';
import { createIdentifier, Disposable, IContextService, IInstanceService, removeAt, SftpModel, TerminalModel, toDisposable, UnitType } from '@termlnk/core';
import { fromEvent } from 'rxjs';

type FocusHandlerFn = (unitId: string) => void;

export const FOCUSING_TERMLNK = 'FOCUSING_TERMLNK';
const givingBackFocusElements = [
  'app-layout',
  'button',
  'workbench-layout',
];

export interface ILayoutService {
  readonly isFocused: boolean;

  get rootContainerElement(): Nullable<HTMLElement>;
  /** Re-focus the currently focused instance. */
  focus(): void;
  /** Register a focus handler to focus on certain type of unit. */
  registerFocusHandler(type: UnitType, handler: FocusHandlerFn): IDisposable;
  /** Register the root container element. */
  registerRootContainerElement(container: HTMLElement): IDisposable;
  /** Register a content element. */
  registerContentElement(container: HTMLElement): IDisposable;
  /** Register an element as a container, especially floating components like Dialogs and Notifications. */
  registerContainerElement(container: HTMLElement): IDisposable;

  getContentElement(): HTMLElement;

  checkElementInCurrentContainers(element: HTMLElement): boolean;
  checkContentIsFocused(): boolean;
}
export const ILayoutService = createIdentifier<ILayoutService>('ui.layout-service');

export class DesktopLayoutService extends Disposable implements ILayoutService {
  private _rootContainerElement: Nullable<HTMLElement> = null;
  private _isFocused = false;

  get isFocused(): boolean {
    return this._isFocused;
  }

  private readonly _focusHandlers = new Map<UnitType, FocusHandlerFn>();

  private _contentElements: HTMLElement[] = [];
  private _allContainers: HTMLElement[] = [];

  constructor(
    @IInstanceService private readonly _instanceService: IInstanceService,
    @IContextService private readonly _contextService: ContextService
  ) {
    super();

    this._initFocusListener();
  }

  get rootContainerElement() {
    return this._rootContainerElement;
  }

  focus(): void {
    const currentFocused = this._instanceService.getFocusedUnit();
    if (!currentFocused) {
      return;
    }

    let handler: Nullable<FocusHandlerFn>;
    if (currentFocused instanceof TerminalModel) {
      handler = this._focusHandlers.get(UnitType.TERMINAL);
    } else if (currentFocused instanceof SftpModel) {
      handler = this._focusHandlers.get(UnitType.SFTP);
    }

    if (handler) {
      handler(currentFocused.getId());
    }
  }

  registerFocusHandler(type: UnitType, handler: FocusHandlerFn): IDisposable {
    if (this._focusHandlers.has(type)) {
      throw new Error(`[DesktopLayoutService]: handler of type ${type} bas been registered!`);
    }

    this._focusHandlers.set(type, handler);
    return toDisposable(() => this._focusHandlers.delete(type));
  }

  registerContentElement(container: HTMLElement): IDisposable {
    if (!this._contentElements.includes(container)) {
      this._contentElements.push(container);
      return toDisposable(() => removeAt(this._contentElements, container));
    }

    throw new Error('[DesktopLayoutService]: content container already registered!');
  }

  getContentElement(): HTMLElement {
    return this._contentElements[0];
  }

  registerRootContainerElement(container: HTMLElement): IDisposable {
    if (this._rootContainerElement) {
      throw new Error('[DesktopLayoutService]: root container already registered!');
    }

    this._rootContainerElement = container;
    const dis = this.registerContainerElement(container);

    return toDisposable(() => {
      this._rootContainerElement = null;
      dis.dispose();
    });
  }

  registerContainerElement(container: HTMLElement): IDisposable {
    if (!this._allContainers.includes(container)) {
      this._allContainers.push(container);
      return toDisposable(() => removeAt(this._allContainers, container));
    }

    throw new Error('[LayoutService]: container already registered!');
  }

  checkElementInCurrentContainers(element: HTMLElement): boolean {
    return this._allContainers.some((container) => container.contains(element));
  }

  checkContentIsFocused(): boolean {
    return this._contentElements.some((contentEl) => contentEl === document.activeElement || contentEl.contains(document.activeElement));
  }

  private _initFocusListener(): void {
    this.disposeWithMe(
      fromEvent(window, 'focusin').subscribe((event) => {
        const target = event.target as HTMLElement;

        if (this._rootContainerElement?.contains(target) && givingBackFocusElements.some((item) => target.dataset.uComp === item)) {
          queueMicrotask(() => this.focus());
          return;
        }

        if (target && this.checkElementInCurrentContainers(target as HTMLElement)) {
          this._isFocused = true;
        } else {
          this._isFocused = false;
        }

        this._contextService.setContextValue(FOCUSING_TERMLNK, this._isFocused);
      })
    );
  }
}
