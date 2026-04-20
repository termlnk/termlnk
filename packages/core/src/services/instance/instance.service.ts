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

import type { Observable } from 'rxjs';
import type { IDisposable } from '../../common/di';
import type { Nullable } from '../../common/types';
import type { UnitModel, UnitType } from '../../models/unit';
import { BehaviorSubject, distinctUntilChanged, filter, map, Subject } from 'rxjs';
import { createIdentifier, Inject, Injector } from '../../common/di';
import { Disposable } from '../../common/lifecycle';
import { FOCUSING_UNIT } from '../context/context';
import { IContextService } from '../context/context.service';

export type UnitCtor = new (...args: any[]) => UnitModel;

export interface ICreateUnitOptions {
  /**
   * should make the new unit as current of its type.
   *
   * @default true
   */
  makeCurrent?: boolean;
}

export interface IInstanceService {
  /**
   * Omits value when a new unit is created.
   */
  unitCreated$: Observable<UnitModel>;

  /**
   * Subscribe to a curtain type of unit creation.
   * @param type
   */
  getTypeOfUnitCreated$<T extends UnitModel>(type: UnitType): Observable<T>;

  /**
   * Omits value when a unit is disposed.
   */
  unitDisposed$: Observable<UnitModel>;

  /**
   * Subscribe to a curtain type of unit disposing.
   * @param type
   */
  getTypeOfUnitDisposed$<T extends UnitModel>(type: UnitType): Observable<T>;

  focused$: Observable<Nullable<string>>;
  focusUnit(unitId: string | null): void;
  getFocusedUnit(): Nullable<UnitModel>;

  getCurrentUnitOfType<T extends UnitModel>(type: UnitType): Nullable<T>;
  setCurrentUnitForType(unitId: string): void;
  getCurrentTypeOfUnit$<T extends UnitModel>(type: UnitType): Observable<Nullable<T>>;

  createUnit<T, U extends UnitModel>(type: UnitType, data: Partial<T>, options?: ICreateUnitOptions): U;
  disposeUnit(unitId: string): boolean;

  registerCtorForType<T extends UnitModel>(type: UnitType, ctor: new (...args: any[]) => T): IDisposable;

  getUnit<T extends UnitModel>(id: string, type?: UnitType): Nullable<T>;
  getAllUnitsForType<T>(type: UnitType): T[];
  getUnitType(unitId: string): Nullable<UnitType>;
}
export const IInstanceService = createIdentifier<IInstanceService>('core.instance-service');

export class InstanceService extends Disposable implements IInstanceService {
  private readonly _unitsMap = new Map<UnitType, UnitModel[]>();
  private readonly _ctorByType = new Map<UnitType, new () => UnitModel>();

  private readonly _unitCreated$ = new Subject<UnitModel>();
  readonly unitCreated$ = this._unitCreated$.asObservable();

  private _currentUnits = new Map<UnitType, Nullable<UnitModel>>();
  private readonly _currentUnits$ = new BehaviorSubject<Map<UnitType, Nullable<UnitModel>>>(this._currentUnits);
  readonly currentUnits$ = this._currentUnits$.asObservable();

  private readonly _focused$ = new BehaviorSubject<Nullable<string>>(null);
  readonly focused$ = this._focused$.asObservable();

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IContextService private readonly _contextService: IContextService
  ) {
    super();
  }

  private _createHandler: (type: UnitType, data: unknown, ctor: UnitCtor, options?: ICreateUnitOptions) => UnitModel;

  __setCreateHandler(handler: (type: UnitType, data: unknown, ctor: UnitCtor, options?: ICreateUnitOptions) => UnitModel): void {
    this._createHandler = handler;
  }

  createUnit<T, U extends UnitModel>(type: UnitType, data: T, options?: ICreateUnitOptions): U {
    const model = this._createHandler(type, data, this._ctorByType.get(type)!, options);
    return model as U;
  }

  registerCtorForType<T extends UnitModel>(type: UnitType, ctor: new () => T): IDisposable {
    this._ctorByType.set(type, ctor);

    return {
      dispose: () => {
        this._ctorByType.delete(type);
      },
    };
  }

  getCurrentTypeOfUnit$<T>(type: UnitType): Observable<Nullable<T>> {
    return this.currentUnits$.pipe(map((units) => units.get(type) ?? null), distinctUntilChanged()) as Observable<Nullable<T>>;
  }

  getCurrentUnitForType<T extends UnitModel>(type: UnitType): Nullable<T> {
    return this._currentUnits.get(type) as Nullable<T>;
  }

  getCurrentUnitOfType<T extends UnitModel>(type: UnitType): Nullable<T> {
    return this.getCurrentUnitForType(type);
  }

  setCurrentUnitForType(unitId: string): void {
    const result = this._getUnitById(unitId);
    if (!result) throw new Error(`[InstanceService]: no document with unitId ${unitId}!`);

    this._currentUnits.set(result[1], result[0]);
    this._currentUnits$.next(this._currentUnits);
  }

  getTypeOfUnitCreated$<T extends UnitModel>(type: UnitType): Observable<T> {
    return this._unitCreated$.pipe(filter((unit) => unit.type === type)) as Observable<T>;
  }

  __addUnit(unit: UnitModel, options?: ICreateUnitOptions): void {
    const type = unit.type;

    if (!this._unitsMap.has(type)) {
      this._unitsMap.set(type, []);
    }

    const units = this._unitsMap.get(type)!;
    const newUnitId = unit.getId();
    if (units.findIndex((u) => u.getId() === newUnitId) !== -1) {
      throw new Error(`[InstanceService]: cannot create a unit with the same unit id: ${newUnitId}.`);
    }

    units.push(unit);
    this._unitCreated$.next(unit);

    if (options?.makeCurrent ?? true) {
      this.setCurrentUnitForType(unit.getId());
    }
  }

  private readonly _unitDisposed$ = new Subject<UnitModel>();
  readonly unitDisposed$ = this._unitDisposed$.asObservable();
  getTypeOfUnitDisposed$<T extends UnitModel>(type: UnitType): Observable<T> {
    return this.unitDisposed$.pipe(filter((unit) => unit.type === type)) as Observable<T>;
  }

  getUnit<T extends UnitModel = UnitModel>(id: string, type?: UnitType): Nullable<T> {
    const unit = this._getUnitById(id)?.[0] as Nullable<T>;
    if (type && unit?.type !== type) return null;
    return unit;
  }

  getAllUnitsForType<T>(type: UnitType): T[] {
    return (this._unitsMap.get(type) ?? []) as T[];
  }

  get focused(): Nullable<UnitModel> {
    const id = this._focused$.getValue();
    if (!id) return null;

    return this._getUnitById(id)?.[0];
  }

  focusUnit(id: string | null): void {
    this._focused$.next(id);

    if (this.focused) {
      this._contextService.setContextValue(FOCUSING_UNIT, true);
      this.setCurrentUnitForType(id!);
    } else {
      this._contextService.setContextValue(FOCUSING_UNIT, false);
    }
  }

  getFocusedUnit(): Nullable<UnitModel> {
    return this.focused;
  }

  getUnitType(unitId: string): Nullable<UnitType> {
    const result = this._getUnitById(unitId);
    if (!result) {
      return null;
    }

    return result[1];
  }

  disposeUnit(unitId: string): boolean {
    const result = this._getUnitById(unitId);
    if (!result) return false;

    const [unit, type] = result;
    const units = this._unitsMap.get(type)!;
    const index = units.indexOf(unit);
    units.splice(index, 1);

    this._tryResetCurrentOnRemoval(unitId, type);
    this._tryResetFocusOnRemoval(unitId);

    this._unitDisposed$.next(unit);

    return true;
  }

  private _tryResetCurrentOnRemoval(unitId: string, type: UnitType): void {
    const current = this.getCurrentUnitForType(type);
    if (current?.getId() === unitId) {
      this._currentUnits.set(type, null);
      this._currentUnits$.next(this._currentUnits);
    }
  }

  private _tryResetFocusOnRemoval(unitId: string): void {
    if (this.focused?.getId() === unitId) {
      this._focused$.next(null);
    }
  };

  private _getUnitById(unitId: string): Nullable<[UnitModel, UnitType]> {
    for (const [type, units] of this._unitsMap) {
      const unit = units.find((unit) => unit.getId() === unitId);
      if (unit) {
        return [unit, type];
      }
    }
  }

  override dispose(): void {
    super.dispose();

    this._focused$.complete();
    this._currentUnits$.complete();
    this._unitCreated$.complete();
    this._currentUnits.clear();
    this._unitsMap.clear();
  }
}
