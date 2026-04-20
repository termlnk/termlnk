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
import type { Observable } from 'rxjs';
import { Disposable, EventSubject, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { fromEvent } from '../../common/event';

export interface IIMEState {
  isComposing: boolean;
  preeditText: string;
  lastCommitText: string;
}

const DEFAULT_IME_STATE: IIMEState = {
  isComposing: false,
  preeditText: '',
  lastCommitText: '',
};

/**
 * Generic DOM event observer base class.
 *
 * Provides EventSubject streams for keyboard, composition (IME) and focus
 * events, along with built-in IME state tracking. Bind to a concrete
 * HTMLElement via `bindElement()` — unbinding is automatic when the returned
 * disposable is disposed.
 *
 * This is a reusable base class (not a DI singleton), following the same
 * pattern as BaseObject for canvas events.
 */
export class DOMEventObserver extends Disposable {
  // Keyboard events
  readonly onKeyDown$ = new EventSubject<KeyboardEvent>();
  readonly onKeyUp$ = new EventSubject<KeyboardEvent>();

  // Composition (IME) events
  readonly onCompositionStart$ = new EventSubject<CompositionEvent>();
  readonly onCompositionUpdate$ = new EventSubject<CompositionEvent>();
  readonly onCompositionEnd$ = new EventSubject<CompositionEvent>();

  // Focus events
  readonly onFocus$ = new EventSubject<FocusEvent>();
  readonly onBlur$ = new EventSubject<FocusEvent>();

  // IME state (RxJS stream)
  private readonly _imeState$ = new BehaviorSubject<IIMEState>(DEFAULT_IME_STATE);
  readonly imeState$: Observable<IIMEState> = this._imeState$.asObservable();

  get isComposing(): boolean {
    return this._imeState$.value.isComposing;
  }

  get preeditText(): string {
    return this._imeState$.value.preeditText;
  }

  get lastCommitText(): string {
    return this._imeState$.value.lastCommitText;
  }

  /**
   * Bind all event listeners to the given DOM element. Returns an
   * `IDisposable` — call `.dispose()` to unbind.
   */
  bindElement(element: HTMLElement): IDisposable {
    const d1 = fromEvent(element, 'keydown', (e) => this.triggerKeyDown(e));
    const d2 = fromEvent(element, 'keyup', (e) => this.triggerKeyUp(e));
    const d3 = fromEvent(element, 'compositionstart', (e) => this.triggerCompositionStart(e));
    const d4 = fromEvent(element, 'compositionupdate', (e) => this.triggerCompositionUpdate(e));
    const d5 = fromEvent(element, 'compositionend', (e) => this.triggerCompositionEnd(e));
    const d6 = fromEvent(element, 'focus', (e) => this.triggerFocus(e));
    const d7 = fromEvent(element, 'blur', (e) => this.triggerBlur(e));

    return toDisposable(() => {
      d1.dispose();
      d2.dispose();
      d3.dispose();
      d4.dispose();
      d5.dispose();
      d6.dispose();
      d7.dispose();
    });
  }

  triggerKeyDown(event: KeyboardEvent): boolean {
    const result = this.onKeyDown$.emitEvent(event);
    return result.stopPropagation;
  }

  triggerKeyUp(event: KeyboardEvent): boolean {
    const result = this.onKeyUp$.emitEvent(event);
    return result.stopPropagation;
  }

  triggerCompositionStart(event: CompositionEvent): boolean {
    this._updateIMEState({ isComposing: true, preeditText: event.data || '' });
    const result = this.onCompositionStart$.emitEvent(event);
    return result.stopPropagation;
  }

  triggerCompositionUpdate(event: CompositionEvent): boolean {
    this._updateIMEState({ preeditText: event.data || '' });
    const result = this.onCompositionUpdate$.emitEvent(event);
    return result.stopPropagation;
  }

  triggerCompositionEnd(event: CompositionEvent): boolean {
    this._updateIMEState({
      isComposing: false,
      preeditText: '',
      lastCommitText: event.data || '',
    });
    const result = this.onCompositionEnd$.emitEvent(event);
    return result.stopPropagation;
  }

  triggerFocus(event: FocusEvent): boolean {
    const result = this.onFocus$.emitEvent(event);
    return result.stopPropagation;
  }

  triggerBlur(event: FocusEvent): boolean {
    const result = this.onBlur$.emitEvent(event);
    return result.stopPropagation;
  }

  override dispose(): void {
    super.dispose();

    this.onKeyDown$.complete();
    this.onKeyUp$.complete();
    this.onCompositionStart$.complete();
    this.onCompositionUpdate$.complete();
    this.onCompositionEnd$.complete();
    this.onFocus$.complete();
    this.onBlur$.complete();
    this._imeState$.complete();
  }

  private _updateIMEState(partial: Partial<IIMEState>): void {
    this._imeState$.next({ ...this._imeState$.value, ...partial });
  }
}
