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
import type { IXtermTheme } from '@termlnk/themes';
import type { ComponentType } from 'react';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, toDisposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface ITerminalViewProps {
  sessionId: string;
  hostId: string;
  hostName: string;
  theme?: IXtermTheme;
  allowTransparency?: boolean;
}

/**
 * Props passed to a tab adornment component. An adornment renders in the
 * tab's action area (before the close button) and is the extension point for
 * type-specific controls — e.g. shared-terminal's "request keyboard" popover.
 *
 * The adornment owns its own pointer/click handling and MUST stop propagation
 * on its interactive elements when needed — TerminalTabItem renders adornments
 * inside a `display: contents` wrapper so the slot does not absorb clicks of
 * its own.
 */
export interface ITabAdornmentProps {
  sessionId: string;
}

export interface ITerminalViewRegistry {
  registerView(type: string, component: ComponentType<ITerminalViewProps>): IDisposable;
  getView(type: string): ComponentType<ITerminalViewProps> | undefined;
  registerTabAdornment(type: string, component: ComponentType<ITabAdornmentProps>): IDisposable;
  getTabAdornment(type: string): ComponentType<ITabAdornmentProps> | undefined;
  registerAddSessionHandler(handler: () => void): IDisposable;
  getAddSessionHandler(): (() => void) | undefined;
  addSessionHandler$: Observable<(() => void) | undefined>;
  viewsChanged$: Observable<void>;
  adornmentsChanged$: Observable<void>;
}
export const ITerminalViewRegistry = createIdentifier<ITerminalViewRegistry>('terminal-ui.terminal-view-registry');

export class TerminalViewRegistry extends Disposable implements ITerminalViewRegistry {
  private readonly _views = new Map<string, ComponentType<ITerminalViewProps>>();
  private readonly _adornments = new Map<string, ComponentType<ITabAdornmentProps>>();

  private readonly _addSessionHandler$ = new BehaviorSubject<(() => void) | undefined>(undefined);
  readonly addSessionHandler$ = this._addSessionHandler$.asObservable();

  private readonly _viewsChanged$ = new Subject<void>();
  readonly viewsChanged$ = this._viewsChanged$.asObservable();

  private readonly _adornmentsChanged$ = new Subject<void>();
  readonly adornmentsChanged$ = this._adornmentsChanged$.asObservable();

  override dispose(): void {
    super.dispose();
    this._addSessionHandler$.complete();
    this._viewsChanged$.complete();
    this._adornmentsChanged$.complete();
  }

  registerView(type: string, component: ComponentType<ITerminalViewProps>): IDisposable {
    this._views.set(type, component);
    this._viewsChanged$.next();
    return toDisposable(() => {
      // Identity guard: a later registerView(type, other) silently replaces
      // ours; we must NOT delete that replacement on our own dispose.
      if (this._views.get(type) !== component) {
        return;
      }
      this._views.delete(type);
      this._viewsChanged$.next();
    });
  }

  getView(type: string): ComponentType<ITerminalViewProps> | undefined {
    return this._views.get(type);
  }

  registerTabAdornment(type: string, component: ComponentType<ITabAdornmentProps>): IDisposable {
    this._adornments.set(type, component);
    this._adornmentsChanged$.next();
    return toDisposable(() => {
      if (this._adornments.get(type) !== component) {
        return;
      }
      this._adornments.delete(type);
      this._adornmentsChanged$.next();
    });
  }

  getTabAdornment(type: string): ComponentType<ITabAdornmentProps> | undefined {
    return this._adornments.get(type);
  }

  registerAddSessionHandler(handler: () => void): IDisposable {
    this._addSessionHandler$.next(handler);
    return toDisposable(() => {
      this._addSessionHandler$.next(undefined);
    });
  }

  getAddSessionHandler(): (() => void) | undefined {
    return this._addSessionHandler$.getValue();
  }
}
