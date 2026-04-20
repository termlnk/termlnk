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

import { filter, Observable, Subject } from 'rxjs';
import { createIdentifier } from '../../common/di';
import { Disposable } from '../../common/lifecycle';

export interface IContextService {
  readonly contextChanged$: Observable<{ [key: string]: boolean }>;

  getContextValue(key: string): boolean;
  setContextValue(key: string, value: boolean): void;

  subscribeContextValue$(key: string): Observable<boolean>;
}

export const IContextService = createIdentifier<IContextService>('core.context-service');

export class ContextService extends Disposable implements IContextService {
  private readonly _contextChanged$ = new Subject<{ [key: string]: boolean }>();
  readonly contextChanged$ = this._contextChanged$.asObservable();

  private readonly _contextMap = new Map<string, boolean>();

  override dispose(): void {
    super.dispose();
    this._contextChanged$.complete();
    this._contextMap.clear();
  }

  getContextValue(key: string): boolean {
    return this._contextMap.get(key) ?? false;
  }

  setContextValue(key: string, value: boolean): void {
    this._contextMap.set(key, value);
    this._contextChanged$.next({ [key]: value });
  }

  subscribeContextValue$(key: string): Observable<boolean> {
    return new Observable((observer) => {
      const contextChangeSubscription = this._contextChanged$
        .pipe(filter((event) => typeof event[key] !== 'undefined'))
        .subscribe((event) => observer.next(event[key]));

      if (this._contextMap.has(key)) {
        observer.next(this._contextMap.get(key) as boolean);
      }

      return () => contextChangeSubscription.unsubscribe();
    });
  }
}
