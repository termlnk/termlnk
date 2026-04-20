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

import type { ExtensionStatus } from '../models/extension-status';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject, distinctUntilChanged, filter, map, Observable, Subject } from 'rxjs';

/**
 * Event payload emitted every time an extension changes status.
 */
export interface IExtensionStatusChange {
  readonly extensionId: string;
  readonly previous: ExtensionStatus | undefined;
  readonly current: ExtensionStatus;
  readonly error?: string;
}

/**
 * Tracks the live status of every extension known to the host. This service
 * is the single source of truth for "is extension X currently active?" and is
 * consumed by UI surfaces (extension explorer), the extension activator, and
 * contribution adapters that need to react to lifecycle events.
 *
 * Unlike `ILifecycleService` (which describes the *application* lifecycle in
 * fixed stages), this service describes *per-extension* state that can cycle
 * arbitrarily many times during one application session.
 */
export interface IExtensionLifecycleService {
  /**
   * All known extension status entries. Emits the full map on subscribe and on
   * every change — consumers can derive per-extension Observables via
   * `watch(extensionId)` to avoid re-rendering on unrelated changes.
   */
  readonly state$: Observable<ReadonlyMap<string, ExtensionStatus>>;

  /**
   * Granular status change stream; fires exactly once per transition.
   */
  readonly change$: Observable<IExtensionStatusChange>;

  getStatus(extensionId: string): ExtensionStatus | undefined;
  setStatus(extensionId: string, status: ExtensionStatus, error?: string): void;
  remove(extensionId: string): void;

  /**
   * Per-extension status stream filtered to `extensionId`. Emits the current
   * status immediately on subscribe (if known) and on every subsequent change.
   */
  watch(extensionId: string): Observable<ExtensionStatus>;
}

export const IExtensionLifecycleService = createIdentifier<IExtensionLifecycleService>('extension.lifecycle-service');

export class ExtensionLifecycleService extends Disposable implements IExtensionLifecycleService {
  private readonly _statuses = new Map<string, ExtensionStatus>();
  private readonly _errors = new Map<string, string>();

  private readonly _state$ = new BehaviorSubject<ReadonlyMap<string, ExtensionStatus>>(new Map());
  readonly state$: Observable<ReadonlyMap<string, ExtensionStatus>> = this._state$.asObservable();

  private readonly _change$ = new Subject<IExtensionStatusChange>();
  readonly change$: Observable<IExtensionStatusChange> = this._change$.asObservable();

  override dispose(): void {
    super.dispose();
    this._state$.complete();
    this._change$.complete();
    this._statuses.clear();
    this._errors.clear();
  }

  getStatus(extensionId: string): ExtensionStatus | undefined {
    return this._statuses.get(extensionId);
  }

  setStatus(extensionId: string, status: ExtensionStatus, error?: string): void {
    const previous = this._statuses.get(extensionId);
    if (previous === status && (error ?? undefined) === this._errors.get(extensionId)) {
      return;
    }

    this._statuses.set(extensionId, status);
    if (error) {
      this._errors.set(extensionId, error);
    } else {
      this._errors.delete(extensionId);
    }

    this._state$.next(new Map(this._statuses));
    this._change$.next({ extensionId, previous, current: status, error });
  }

  remove(extensionId: string): void {
    if (!this._statuses.has(extensionId)) {
      return;
    }

    this._statuses.delete(extensionId);
    this._errors.delete(extensionId);
    this._state$.next(new Map(this._statuses));
  }

  watch(extensionId: string): Observable<ExtensionStatus> {
    return new Observable<ExtensionStatus>((observer) => {
      const current = this._statuses.get(extensionId);
      if (current !== undefined) {
        observer.next(current);
      }

      const sub = this._change$
        .pipe(
          filter((change) => change.extensionId === extensionId),
          map((change) => change.current),
          distinctUntilChanged()
        )
        .subscribe({
          next: (status) => observer.next(status),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });

      return () => sub.unsubscribe();
    });
  }
}
