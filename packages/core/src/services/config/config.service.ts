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

import type { IDisposable } from '../../common/di';
import type { Nullable } from '../../common/types';
import { filter, Observable, Subject } from 'rxjs';
import { createIdentifier } from '../../common/di';
import { toDisposable } from '../../common/lifecycle';
import { get, merge, set, unset } from '../../common/lodash';

export interface IConfigOptions {
  /**
   * Whether to merge the configuration with the existing one.
   * @default false
   */
  merge?: boolean;
}

export interface IConfigService {
  readonly configChanged$: Observable<Record<string, unknown>>;

  getConfig<T>(id: string, defaultValue?: any): Nullable<T>;
  setConfig(id: string, value: unknown, options?: IConfigOptions): void;
  /**
   * Register a config value that can be rolled back when the returned
   * disposable is invoked. On dispose the previous value at `id` is restored
   * (or the key is deleted if none existed). Intended for dynamic
   * contributors such as extensions, whose side-effects must be undoable.
   */
  registerConfig(id: string, value: unknown, options?: IConfigOptions): IDisposable;
  deleteConfig(id: string): boolean;
  subscribeConfigValue$<T = unknown>(key: string): Observable<T>;
}
export const IConfigService = createIdentifier<IConfigService>('core.config-service');

export class ConfigService implements IConfigService, IDisposable {
  private readonly _configChanged$ = new Subject<Record<string, unknown>>();
  readonly configChanged$ = this._configChanged$.asObservable();

  private _config: Record<string, any> = {};

  dispose(): void {
    this._config = {};
    this._configChanged$.complete();
  }

  getConfig<T>(id: string, defaultValue?: T): Nullable<T> {
    return get(this._config, id, defaultValue) as T;
  }

  setConfig(id: string, value: any, options?: IConfigOptions): void {
    const { merge: isMerge = false } = options || {};

    let nextValue;
    if (isMerge) {
      nextValue = this.getConfig(id, {});
      nextValue = merge(nextValue, value);
    } else {
      nextValue = value;
    }

    set(this._config, id, nextValue);
    this._configChanged$.next({ [id]: nextValue });
  }

  registerConfig(id: string, value: any, options?: IConfigOptions): IDisposable {
    const hadPrevious = Object.hasOwn(this._config, id);
    const previous = hadPrevious ? this.getConfig(id) : undefined;

    this.setConfig(id, value, options);

    return toDisposable(() => {
      if (hadPrevious) {
        this.setConfig(id, previous);
      } else if (this.deleteConfig(id)) {
        this._configChanged$.next({ [id]: undefined });
      }
    });
  }

  deleteConfig(id: string): boolean {
    return unset(this._config, id);
  }

  subscribeConfigValue$<T = unknown>(key: string): Observable<T> {
    return new Observable<T>((observer) => {
      if (Object.hasOwn(this._config, key)) {
        observer.next(this.getConfig(key) as T);
      }

      const sub = this.configChanged$
        .pipe(filter((c) => Object.hasOwn(c, key)))
        .subscribe((c) => observer.next(c[key] as T));

      return () => sub.unsubscribe();
    });
  }
}
