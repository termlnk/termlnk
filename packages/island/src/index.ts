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

export { AGENT_COLORS, AGENT_DISPLAY_NAMES, AUTO_COLLAPSE_DELAY_MS, CAROUSEL_INTERVAL_MS, DEFAULT_BRAND_COLOR, ISLAND_PLUGIN_NAME, ISLAND_WINDOW_HEIGHT, ISLAND_WINDOW_WIDTH, MINI_SESSION_HEIGHT, OVERVIEW_HEADER_HEIGHT, OVERVIEW_MAX_HEIGHT, OVERVIEW_PADDING, SCENE_SHADOWS, SCENE_SIZES, SESSION_DONE_LINGER_MS, STATE_COLORS, STATE_GLOW } from './common/constants';
export type { ISceneSize, IslandScene, IStateColors } from './common/constants';
export { deriveScene, getSceneShadow, getSceneSize, NOTCH_OFFSET } from './common/island-scene';
export { computeIslandView, pickActiveSession, toIslandSession } from './common/island-view';
export { deriveQuestionFacets, toPermissionViewModel, toQuestionViewModel } from './common/permission-view-model';
export type { IPermissionViewModel, IQuestionFacets, IQuestionViewModel } from './common/permission-view-model';
export { ISLAND_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IIslandPluginConfig } from './controllers/config.schema';
export { CESP_SOUND_CATEGORIES, CespEventCategory, DEFAULT_ISLAND_SOUND_CONFIG, ISLAND_SETTINGS_CONFIG_KEY, normalizeIslandSoundConfig } from './models/cesp';
export type { ICespEvent, IIslandSettings, IIslandSoundConfig, IIslandSoundEventConfig } from './models/cesp';
export { animationPriority, AnimationState, phaseToAnimationState, SessionPhase, statusToPhase } from './models/island';
export type { IIslandSession } from './models/island';
export type { IIslandState } from './models/island-state';
export { IslandPlugin } from './plugin';
export { IIslandStateService } from './services/island-state.service';
export type { AgentTodoStatus, ExternalAgentType, IAgentTodo, IAnswerEntry, IAnswerMap, IAskUserQuestion, IAskUserQuestionOption, IAskUserQuestionRequestPayload, IAskUserQuestionSet, IExternalAgentSession, IPendingInteractionPayload, IPermissionDecision, IPermissionRequestPayload } from '@termlnk/agent';
