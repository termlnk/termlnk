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

import type { IDisposable, Nullable, UnitType } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { IRender } from './render';
import { createIdentifier, Disposable, IInstanceService, ILogService, Inject, Injector } from '@termlnk/core';
import { Subject } from 'rxjs';

export interface IRenderManagerService {
  created$: Observable<IRender>;
  disposed$: Observable<string>;

  getRenderById(id: string): Nullable<IRender>;
  getRendersOfType(type: UnitType): IRender[];
  getRenderAll(): Map<string, IRender>;
}
export const IRenderManagerService = createIdentifier<IRenderManagerService>('ui.render-manager-service');

export class RenderManagerService extends Disposable implements IRenderManagerService {
  private _renderMap: Map<string, IRender> = new Map();

  private readonly _renderCreated$ = new Subject<IRender>();
  readonly created$ = this._renderCreated$.asObservable();

  private readonly _renderDisposed$ = new Subject<string>();
  readonly disposed$ = this._renderDisposed$.asObservable();

  constructor(
    @Inject(Injector) protected readonly _injector: Injector,
    @IInstanceService protected readonly _instanceService: IInstanceService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._init();
  }

  private _init() {

  }

  override dispose(): void {
    super.dispose();

    this._renderMap.forEach((item) => this._disposeItem(item));
    this._renderMap.clear();
    this._renderCreated$.complete();
    this._renderDisposed$.complete();
  }

  registerRenderer(type: UnitType, render: IRender): void {
    if (this._renderMap.has(render.id)) {
      this._logService.warn(`[RenderManagerService]: Render with id ${render.id} already exists.`);
      return;
    }

    this._renderMap.set(render.id, render);
    this._renderCreated$.next(render);
  }

  getRendersOfType(type: UnitType): IRender[] {
    const renderUnits: IRender[] = [];
    for (const [_, render] of this._renderMap) {
      const renderType = render.type;
      if (renderType === type) {
        renderUnits.push(render);
      }
    }
    return renderUnits;
  }

  getRenderById(id: string): Nullable<IRender> {
    return this._renderMap.get(id);
  }

  getRenderAll(): Map<string, IRender> {
    return this._renderMap;
  }

  private _disposeItem(item: Nullable<IRender>): void {
    if (!item) {
      return;
    }

    if (isDisposable(item)) {
      item.dispose();
    }

    this._renderDisposed$.next(item.id);
  }
}

export function isDisposable(thing: unknown): thing is IDisposable {
  return !!thing && typeof (thing as any).dispose === 'function';
}
