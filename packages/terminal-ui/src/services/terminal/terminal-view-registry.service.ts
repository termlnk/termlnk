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

export interface ITerminalViewRegistry {
  registerView(type: string, component: ComponentType<ITerminalViewProps>): IDisposable;
  getView(type: string): ComponentType<ITerminalViewProps> | undefined;
  registerAddSessionHandler(handler: () => void): IDisposable;
  getAddSessionHandler(): (() => void) | undefined;
  addSessionHandler$: Observable<(() => void) | undefined>;
  viewsChanged$: Observable<void>;
}
export const ITerminalViewRegistry = createIdentifier<ITerminalViewRegistry>('terminal-ui.terminal-view-registry');

export class TerminalViewRegistry extends Disposable implements ITerminalViewRegistry {
  private readonly _views = new Map<string, ComponentType<ITerminalViewProps>>();

  private readonly _addSessionHandler$ = new BehaviorSubject<(() => void) | undefined>(undefined);
  readonly addSessionHandler$ = this._addSessionHandler$.asObservable();

  private readonly _viewsChanged$ = new Subject<void>();
  readonly viewsChanged$ = this._viewsChanged$.asObservable();

  override dispose(): void {
    super.dispose();
    this._addSessionHandler$.complete();
    this._viewsChanged$.complete();
  }

  registerView(type: string, component: ComponentType<ITerminalViewProps>): IDisposable {
    this._views.set(type, component);
    this._viewsChanged$.next();
    return toDisposable(() => {
      this._views.delete(type);
      this._viewsChanged$.next();
    });
  }

  getView(type: string): ComponentType<ITerminalViewProps> | undefined {
    return this._views.get(type);
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
