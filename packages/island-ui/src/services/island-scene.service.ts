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

import type { ISceneSize, IslandScene } from '@termlnk/island';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, toDisposable } from '@termlnk/core';
import { AnimationState, deriveScene, getSceneShadow, getSceneSize } from '@termlnk/island';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map } from 'rxjs';
import { IIslandUIStateService } from './island-state.service';

/**
 * Renderer-only hover flag: toggled from the outermost NotchContainer so
 * compact-scene shadow and the hover nudge size can react. Kept inside
 * the service so the React tree never owns transient interaction state.
 */
export interface IIslandSceneService {
  readonly scene$: Observable<IslandScene>;
  readonly size$: Observable<ISceneSize>;
  readonly shadow$: Observable<string>;
  readonly hovered$: Observable<boolean>;

  setHovered(value: boolean): void;
}

export const IIslandSceneService = createIdentifier<IIslandSceneService>('island-ui.island-scene-service');

/** Hover nudge on the compact pill — grows 6px wide / 2px tall. */
const HOVER_NUDGE_W = 6;
const HOVER_NUDGE_H = 2;

export class IslandSceneService extends Disposable implements IIslandSceneService {
  private readonly _hovered$ = new BehaviorSubject<boolean>(false);
  readonly hovered$: Observable<boolean> = this._hovered$.asObservable();

  readonly scene$: Observable<IslandScene>;
  readonly size$: Observable<ISceneSize>;
  readonly shadow$: Observable<string>;

  constructor(
    @IIslandUIStateService private readonly _stateService: IIslandUIStateService
  ) {
    super();

    this.scene$ = combineLatest([
      this._stateService.expanded$,
      this._stateService.pendingInteractions$,
    ]).pipe(
      map(([expanded, interactions]) => deriveScene(expanded, interactions)),
      distinctUntilChanged()
    );

    // Base size from scene + interaction; hover nudge layered on for the
    // compact pill only. Two pipes fused into one for a single emission.
    const baseSize$ = combineLatest([
      this.scene$,
      this._stateService.sessions$,
      this._stateService.pendingInteractions$,
    ]).pipe(
      map(([scene, sessions, interactions]) => getSceneSize(scene, sessions.length, interactions[0])),
      distinctUntilChanged((a, b) => a.w === b.w && a.h === b.h && a.r === b.r)
    );

    this.size$ = combineLatest([baseSize$, this.scene$, this._hovered$]).pipe(
      map(([base, scene, hovered]) => {
        if (hovered && scene === 'compact') {
          return { w: base.w + HOVER_NUDGE_W, h: base.h + HOVER_NUDGE_H, r: base.r };
        }
        return base;
      }),
      distinctUntilChanged((a, b) => a.w === b.w && a.h === b.h && a.r === b.r)
    );

    this.shadow$ = combineLatest([
      this.scene$,
      this._stateService.animationState$,
      this._stateService.sessions$,
      this._hovered$,
    ]).pipe(
      map(([scene, animation, sessions, hovered]) =>
        getSceneShadow(scene, animation ?? AnimationState.Idle, sessions.length > 0, hovered)
      ),
      distinctUntilChanged()
    );

    this.disposeWithMe(toDisposable(() => {
      this._hovered$.complete();
    }));
  }

  setHovered(value: boolean): void {
    this._hovered$.next(value);
  }
}
