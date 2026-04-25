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

import type { IPendingInteractionPayload } from '@termlnk/agent';
import type { AnimationState } from '../models/island';
import type { ISceneSize, IslandScene } from './constants';
import { MINI_SESSION_HEIGHT, OVERVIEW_HEADER_HEIGHT, OVERVIEW_MAX_HEIGHT, OVERVIEW_PADDING, SCENE_SHADOWS, SCENE_SIZES, STATE_GLOW } from './constants';

/** Offset for expanded scenes — equal to the compact pill height. */
export const NOTCH_OFFSET = SCENE_SIZES.compact.h;

/** Empty-overview fixed height (sleeping-moon glyph only). */
const EMPTY_OVERVIEW_HEIGHT = 110;

/**
 * Derive the current scene from UI-level inputs. Pure — drives both the
 * main-process window size computation and the renderer's layer selection.
 *
 * `approval` is reserved for classic permission dialogs (Bash / Edit /
 * WebFetch / …). AskUserQuestion (`kind: 'question'`) does NOT promote
 * the scene — the island only changes the pet's animation state for it.
 */
export function deriveScene(
  expanded: boolean,
  pendingInteractions: readonly IPendingInteractionPayload[]
): IslandScene {
  if (!expanded) {
    return 'compact';
  }
  if (pendingInteractions.some((p) => p.kind === 'permission')) {
    return 'approval';
  }
  return 'overview';
}

/**
 * Compute the scene's base size. The approval scene always uses the fixed
 * permission layout now that AskUserQuestion no longer surfaces a picker.
 */
export function getSceneSize(
  scene: IslandScene,
  sessionCount: number,
  _activeInteraction: IPendingInteractionPayload | undefined
): ISceneSize {
  let base: ISceneSize;

  if (scene === 'overview') {
    const h = sessionCount === 0
      ? EMPTY_OVERVIEW_HEIGHT
      : Math.min(
        OVERVIEW_HEADER_HEIGHT + sessionCount * MINI_SESSION_HEIGHT + OVERVIEW_PADDING,
        OVERVIEW_MAX_HEIGHT
      );
    base = { w: SCENE_SIZES.overview.w, h, r: SCENE_SIZES.overview.r };
  } else {
    base = SCENE_SIZES[scene];
  }

  if (scene === 'overview' || scene === 'approval') {
    return { w: base.w, h: base.h + NOTCH_OFFSET, r: base.r };
  }
  return base;
}

/**
 * Compute the composite CSS `box-shadow` string for the current scene.
 * Hover + active sessions add a state-coloured glow on the compact pill.
 */
export function getSceneShadow(
  scene: IslandScene,
  animationState: AnimationState,
  hasActiveSessions: boolean,
  hovered: boolean
): string {
  if (scene === 'compact' && !hovered) {
    return 'none';
  }
  if (scene === 'compact' && hasActiveSessions) {
    return SCENE_SHADOWS.compact + STATE_GLOW[animationState];
  }
  return SCENE_SHADOWS[scene];
}
