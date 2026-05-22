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

import type { IProviderDefinition, IProviderRegistryService, IRegisteredProvider } from '@termlnk/agent';
import type { IDisposable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { Disposable, ILogService, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

interface IEntryKey {
  readonly extensionId: string;
  readonly providerId: string;
}

export class ProviderRegistryService extends Disposable implements IProviderRegistryService {
  private readonly _byKey = new Map<string, IRegisteredProvider>();
  private readonly _providers$ = new BehaviorSubject<ReadonlyArray<IRegisteredProvider>>([]);
  readonly providers$: Observable<ReadonlyArray<IRegisteredProvider>> = this._providers$.asObservable();

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._byKey.clear();
    this._providers$.complete();
  }

  list(): ReadonlyArray<IRegisteredProvider> {
    return [...this._byKey.values()];
  }

  get(extensionId: string, providerId: string): IRegisteredProvider | undefined {
    return this._byKey.get(this._key({ extensionId, providerId }));
  }

  register(extensionId: string, definition: IProviderDefinition): IDisposable {
    const key = this._key({ extensionId, providerId: definition.id });
    if (this._byKey.has(key)) {
      this._logService.warn(
        '[ProviderRegistryService]',
        `Provider "${definition.id}" from ${extensionId} already registered; overwriting`
      );
    }

    const entry: IRegisteredProvider = { extensionId, definition };
    this._byKey.set(key, entry);
    this._providers$.next(this.list());

    if (definition.initialize) {
      Promise.resolve(definition.initialize()).catch((err) => {
        this._logService.error(
          '[ProviderRegistryService]',
          `initialize() threw for provider ${definition.id} from ${extensionId}`,
          err
        );
      });
    }

    return toDisposable(() => {
      if (this._byKey.delete(key)) {
        this._providers$.next(this.list());
      }
    });
  }

  private _key(k: IEntryKey): string {
    return `${k.extensionId}::${k.providerId}`;
  }
}
