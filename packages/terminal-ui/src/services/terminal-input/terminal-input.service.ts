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
import type { IIMEState } from '@termlnk/ui';
import type { Terminal } from '@xterm/xterm';
import type { Observable } from 'rxjs';
import type { IKeyEncodingPolicy } from './key-encoding-policy';
import { createIdentifier, EventSubject, IConfigService, toDisposable } from '@termlnk/core';
import { DOMEventObserver, fromEvent } from '@termlnk/ui';
import { ConfigurableKeyEncodingPolicy } from './key-encoding-policy';
import { isAsciiPunctuationKey, isShiftEnterKey } from './key-utils';

export enum TerminalKeyIntent {
  /** Normal text input — let xterm handle encoding. */
  SendText = 'SendText',
  /** Ctrl / Meta / Alt combo — let xterm handle encoding. */
  SendControlSequence = 'SendControlSequence',
  /** Bypass xterm so the browser / IME can emit the actual character. */
  BypassToIME = 'BypassToIME',
  /** Ignore — swallow the event. */
  Ignore = 'Ignore',
}

export interface ITerminalInputEvent {
  intent: TerminalKeyIntent;
  data?: string;
  originalEvent: KeyboardEvent;
}

export interface ITerminalInputService extends IDisposable {
  // From DOMEventObserver
  readonly onKeyDown$: EventSubject<KeyboardEvent>;
  readonly onKeyUp$: EventSubject<KeyboardEvent>;
  readonly onCompositionStart$: EventSubject<CompositionEvent>;
  readonly onCompositionUpdate$: EventSubject<CompositionEvent>;
  readonly onCompositionEnd$: EventSubject<CompositionEvent>;
  readonly onFocus$: EventSubject<FocusEvent>;
  readonly onBlur$: EventSubject<FocusEvent>;
  readonly imeState$: Observable<IIMEState>;
  readonly isComposing: boolean;
  readonly preeditText: string;

  // Terminal-specific
  readonly onInput$: EventSubject<ITerminalInputEvent>;
  resolveKeyIntent(event: KeyboardEvent): TerminalKeyIntent;
  createTerminalBinding(terminal: Terminal, onData: (data: string) => void): IDisposable;
}
export const ITerminalInputService = createIdentifier<ITerminalInputService>('terminal-ui.terminal-input-service');

export class TerminalInputService extends DOMEventObserver implements ITerminalInputService {
  readonly onInput$ = new EventSubject<ITerminalInputEvent>();
  private readonly _encodingPolicy: IKeyEncodingPolicy;

  constructor(
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
    this._encodingPolicy = new ConfigurableKeyEncodingPolicy(this._configService);
  }

  resolveKeyIntent(event: KeyboardEvent): TerminalKeyIntent {
    // Shift+Enter (no other modifiers, not composing) → SendText
    if (isShiftEnterKey(event) && !event.isComposing) {
      return TerminalKeyIntent.SendText;
    }

    // Ctrl / Meta / Alt modifier → let xterm handle control sequences
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return TerminalKeyIntent.SendControlSequence;
    }

    // ASCII punctuation → bypass to browser/IME so full-width chars work
    if (isAsciiPunctuationKey(event.key)) {
      return TerminalKeyIntent.BypassToIME;
    }

    return TerminalKeyIntent.SendText;
  }

  createTerminalBinding(terminal: Terminal, onData: (data: string) => void): IDisposable {
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent): boolean => {
      if (event.type !== 'keydown') return true;

      const intent = this.resolveKeyIntent(event);

      const inputEvent: ITerminalInputEvent = {
        intent,
        originalEvent: event,
      };

      // Try encoding policy first
      const encoded = this._encodingPolicy.encode(intent, event);
      if (encoded !== null) {
        inputEvent.data = encoded;
        onData(encoded);
        event.preventDefault();
        this.onInput$.emitEvent(inputEvent);
        return false;
      }

      // Shift+Enter fallback (when policy returns null for 'protocol' mode)
      if (intent === TerminalKeyIntent.SendText && isShiftEnterKey(event)) {
        inputEvent.data = '\n';
        onData('\n');
        event.preventDefault();
        this.onInput$.emitEvent(inputEvent);
        return false;
      }

      // Control sequences → let xterm handle
      if (intent === TerminalKeyIntent.SendControlSequence) {
        this.onInput$.emitEvent(inputEvent);
        return true;
      }

      // Bypass to IME → prevent xterm from intercepting
      if (intent === TerminalKeyIntent.BypassToIME) {
        this.onInput$.emitEvent(inputEvent);
        return false;
      }

      // SendText / Ignore → let xterm handle normally
      this.onInput$.emitEvent(inputEvent);
      return true;
    });

    // Bind composition events from the xterm textarea
    const textarea = terminal.textarea;
    const compositionDisposable = textarea
      ? this._bindCompositionEvents(textarea)
      : toDisposable(() => {});

    return toDisposable(() => {
      compositionDisposable.dispose();
    });
  }

  override dispose(): void {
    this.onInput$.complete();
    super.dispose();
  }

  private _bindCompositionEvents(element: HTMLTextAreaElement): IDisposable {
    const d1 = fromEvent(element as unknown as HTMLElement, 'compositionstart', (e) => this.triggerCompositionStart(e as CompositionEvent));
    const d2 = fromEvent(element as unknown as HTMLElement, 'compositionupdate', (e) => this.triggerCompositionUpdate(e as CompositionEvent));
    const d3 = fromEvent(element as unknown as HTMLElement, 'compositionend', (e) => this.triggerCompositionEnd(e as CompositionEvent));

    return toDisposable(() => {
      d1.dispose();
      d2.dispose();
      d3.dispose();
    });
  }
}
