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

import { LocaleService } from '@termlnk/core';
import { cn, useDependency, useObservable, useUpdateBinder } from '@termlnk/design';
import { AnimationState, NOTCH_OFFSET, SCENE_SIZES } from '@termlnk/island';
import { useCallback } from 'react';
import { IIslandSceneService } from '../../services/island-scene.service';
import { IIslandUIStateService } from '../../services/island-state.service';
import { IPermissionRequestService } from '../../services/permission-request.service';
import { useAutoCollapse } from '../hooks/use-auto-collapse';
import { useMeasuredHeight } from '../hooks/use-measured-height';
import { PermissionRequestView } from '../permission/PermissionRequestView';
import { SessionList } from '../session/SessionList';
import { CollapsedIsland } from './CollapsedIsland';
import { NotchContainer } from './NotchContainer';
import { NotchLayer } from './NotchLayer';

/**
 * Top-level island shell. Pure consumer of three services:
 * - `IIslandUIStateService` — sessions, animation, expand/collapse state.
 * - `IIslandSceneService` — scene / size / shadow / hover.
 * - `IPermissionRequestService` — blocking interactions (approval & picker).
 *
 * All derivation/layout logic lives in the services and their underlying
 * pure helpers in `@termlnk/island/common`, so this component only glues
 * observables to sub-views.
 */
export function DynamicIsland() {
  const stateService = useDependency(IIslandUIStateService);
  const sceneService = useDependency(IIslandSceneService);
  const permissionService = useDependency(IPermissionRequestService);
  const localeService = useDependency(LocaleService);
  useUpdateBinder(localeService.localeChanged$);

  const sessions = useObservable(stateService.sessions$, []);
  const pendingInteractions = useObservable(stateService.pendingInteractions$, []);
  const expanded = useObservable(stateService.expanded$, false);
  const activeSession = useObservable(stateService.activeSession$, null);
  const animationState = useObservable(stateService.animationState$, AnimationState.Idle);

  const scene = useObservable(sceneService.scene$, 'compact');
  const size = useObservable(sceneService.size$, SCENE_SIZES.compact);
  const shadow = useObservable(sceneService.shadow$, 'none');

  const activeRequest = useObservable(permissionService.activeRequest$, null);

  const handleToggle = useCallback(() => {
    stateService.setExpanded(!expanded);
  }, [expanded, stateService]);

  const setOverviewHeight = useCallback(
    (height: number) => sceneService.setOverviewContentHeight(height),
    [sceneService]
  );
  const overviewContentRef = useMeasuredHeight(setOverviewHeight);

  const { onMouseEnter: autoCollapseEnter, onMouseLeave: autoCollapseLeave } = useAutoCollapse(
    expanded,
    (v: boolean) => stateService.setExpanded(v),
    pendingInteractions,
    stateService.cespEvent$
  );

  const onMouseEnter = useCallback(() => {
    sceneService.setHovered(true);
    autoCollapseEnter();
  }, [sceneService, autoCollapseEnter]);

  const onMouseLeave = useCallback(() => {
    sceneService.setHovered(false);
    autoCollapseLeave();
  }, [sceneService, autoCollapseLeave]);

  return (
    <NotchContainer
      size={size}
      shadow={shadow}
      expanded={scene !== 'compact'}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NotchLayer active={scene === 'compact'}>
        <CollapsedIsland
          sessions={sessions}
          activeSession={activeSession}
          animationState={animationState}
          onClick={handleToggle}
        />
      </NotchLayer>

      <NotchLayer
        active={scene === 'overview'}
        topOffset={NOTCH_OFFSET}
        scrollable
        className="tm:flex-col tm:items-stretch tm:justify-start tm:gap-0"
      >
        {/* `shrink-0` keeps the measured height truthful when content overflows the capped layer. */}
        <div
          ref={overviewContentRef}
          className={cn('tm:flex tm:w-full tm:flex-col', {
            'tm:size-full tm:items-center tm:justify-center': sessions.length === 0,
            'tm:shrink-0': sessions.length > 0,
          })}
        >
          <SessionList
            sessions={sessions}
            animationState={animationState}
            onCollapse={handleToggle}
          />
        </div>
      </NotchLayer>

      <NotchLayer
        active={scene === 'approval'}
        topOffset={NOTCH_OFFSET}
        className="tm:flex-col tm:items-stretch tm:justify-start tm:gap-0"
      >
        {activeRequest && <PermissionRequestView request={activeRequest} />}
      </NotchLayer>
    </NotchContainer>
  );
}
