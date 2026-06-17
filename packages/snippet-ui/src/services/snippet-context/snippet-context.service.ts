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

import type { ISnippet, ISnippetPackage } from '@termlnk/snippet';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface ISnippetContextService {
  readonly target$: Observable<ISnippet | null>;
  readonly target: ISnippet | null;
  readonly packageTarget$: Observable<ISnippetPackage | null>;
  readonly packageTarget: ISnippetPackage | null;
  readonly packageRenameRequest$: Observable<string>;
  readonly createPackageRequest$: Observable<void>;
  setTarget(snippet: ISnippet): void;
  setPackageTarget(pkg: ISnippetPackage): void;
  requestPackageRename(pkgId: string): void;
  requestCreatePackage(): void;
  clear(): void;
}
export const ISnippetContextService = createIdentifier<ISnippetContextService>('snippet-ui.snippet-context-service');

export class SnippetContextService extends Disposable implements ISnippetContextService {
  private readonly _target$ = new BehaviorSubject<ISnippet | null>(null);
  readonly target$: Observable<ISnippet | null> = this._target$.asObservable();

  private readonly _packageTarget$ = new BehaviorSubject<ISnippetPackage | null>(null);
  readonly packageTarget$: Observable<ISnippetPackage | null> = this._packageTarget$.asObservable();

  private readonly _packageRenameRequest$ = new Subject<string>();
  readonly packageRenameRequest$: Observable<string> = this._packageRenameRequest$.asObservable();

  private readonly _createPackageRequest$ = new Subject<void>();
  readonly createPackageRequest$: Observable<void> = this._createPackageRequest$.asObservable();

  get target(): ISnippet | null {
    return this._target$.getValue();
  }

  get packageTarget(): ISnippetPackage | null {
    return this._packageTarget$.getValue();
  }

  setTarget(snippet: ISnippet): void {
    this._target$.next(snippet);
  }

  setPackageTarget(pkg: ISnippetPackage): void {
    this._packageTarget$.next(pkg);
  }

  requestPackageRename(pkgId: string): void {
    this._packageRenameRequest$.next(pkgId);
  }

  requestCreatePackage(): void {
    this._createPackageRequest$.next();
  }

  clear(): void {
    this._target$.next(null);
    this._packageTarget$.next(null);
  }

  override dispose(): void {
    super.dispose();
    this._target$.complete();
    this._packageTarget$.complete();
    this._packageRenameRequest$.complete();
    this._createPackageRequest$.complete();
  }
}
