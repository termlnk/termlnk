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
import type { IExtensionPoint, IExtensionPointContribution, IExtensionPointDescriptor, IExtensionPointHandler } from './extension-point';
import { createIdentifier, Disposable, ILogService, Inject, toDisposable } from '@termlnk/core';

class ExtensionPoint<T> implements IExtensionPoint<T> {
  readonly name: string;
  readonly schema: IExtensionPointDescriptor<T>['schema'];

  private _handler: IExtensionPointHandler<T> | null = null;
  private readonly _pending: Array<{ added: ReadonlyArray<IExtensionPointContribution<T>>; removed: ReadonlyArray<IExtensionPointContribution<T>> }> = [];

  constructor(
    descriptor: IExtensionPointDescriptor<T>,
    private readonly _logService: ILogService
  ) {
    this.name = descriptor.name;
    this.schema = descriptor.schema;
  }

  setHandler(handler: IExtensionPointHandler<T>): IDisposable {
    if (this._handler) {
      throw new Error(`Handler for extension point "${this.name}" already set`);
    }
    this._handler = handler;

    for (const delta of this._pending) {
      this._dispatch(delta);
    }
    this._pending.length = 0;

    return toDisposable(() => {
      this._handler = null;
    });
  }

  push(added: ReadonlyArray<IExtensionPointContribution<T>>): void {
    if (!added.length) {
      return;
    }
    this._dispatch({ added, removed: [] });
  }

  pop(removed: ReadonlyArray<IExtensionPointContribution<T>>): void {
    if (!removed.length) {
      return;
    }
    this._dispatch({ added: [], removed });
  }

  private _dispatch(delta: { added: ReadonlyArray<IExtensionPointContribution<T>>; removed: ReadonlyArray<IExtensionPointContribution<T>> }): void {
    if (!this._handler) {
      this._pending.push(delta);
      return;
    }

    try {
      const result = this._handler(delta);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((err) => {
          this._logService.error(`[ExtensionPoint:${this.name}]`, 'Handler rejected', err);
        });
      }
    } catch (err) {
      this._logService.error(`[ExtensionPoint:${this.name}]`, 'Handler threw', err);
    }
  }
}

export interface IExtensionPointRegistry {
  registerExtensionPoint<T>(descriptor: IExtensionPointDescriptor<T>): IExtensionPoint<T>;
  getExtensionPoint<T>(name: string): IExtensionPoint<T> | undefined;
  getAllExtensionPoints(): ReadonlyArray<IExtensionPoint<unknown>>;
}

export const IExtensionPointRegistry = createIdentifier<IExtensionPointRegistry>('extension.extension-point-registry');

export class ExtensionPointRegistry extends Disposable implements IExtensionPointRegistry {
  private readonly _points = new Map<string, IExtensionPoint<unknown>>();

  constructor(
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  registerExtensionPoint<T>(descriptor: IExtensionPointDescriptor<T>): IExtensionPoint<T> {
    if (this._points.has(descriptor.name)) {
      throw new Error(`Extension point "${descriptor.name}" already registered`);
    }
    const point = new ExtensionPoint<T>(descriptor, this._logService);
    this._points.set(descriptor.name, point as IExtensionPoint<unknown>);
    return point;
  }

  getExtensionPoint<T>(name: string): IExtensionPoint<T> | undefined {
    return this._points.get(name) as IExtensionPoint<T> | undefined;
  }

  getAllExtensionPoints(): ReadonlyArray<IExtensionPoint<unknown>> {
    return [...this._points.values()];
  }

  override dispose(): void {
    super.dispose();
    this._points.clear();
  }
}
