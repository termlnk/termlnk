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

import type { ExternalAgentType } from '@termlnk/agent';
import { AnimationState } from '../models/island';

export { AGENT_DISPLAY_NAMES } from '@termlnk/agent';

export const ISLAND_PLUGIN_NAME = 'ISLAND_PLUGIN';

// ---------------------------------------------------------------------------
// Island scene types
// ---------------------------------------------------------------------------

export type IslandScene = 'compact' | 'overview' | 'approval';

export interface ISceneSize {
  readonly w: number;
  readonly h: number;
  readonly r: number;
}

export const SCENE_SIZES: Record<IslandScene, ISceneSize> = {
  compact: { w: 290, h: 38, r: 14 },
  overview: { w: 600, h: 175, r: 18 },
  approval: { w: 600, h: 220, r: 18 },
};

// ---------------------------------------------------------------------------
// Overview dynamic height
// ---------------------------------------------------------------------------

export const OVERVIEW_HEADER_HEIGHT = 44;
export const MINI_SESSION_HEIGHT = 68;
export const OVERVIEW_PADDING = 12;
export const OVERVIEW_MAX_HEIGHT = 360;

// ---------------------------------------------------------------------------
// Scene shadows
// ---------------------------------------------------------------------------

const BASE_SHADOW = '0 2px 8px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.3)';

export const SCENE_SHADOWS: Record<IslandScene, string> = {
  compact: BASE_SHADOW,
  overview: `${BASE_SHADOW}, 0 0 15px rgba(255,255,255,0.04)`,
  approval: `${BASE_SHADOW}, 0 0 20px rgba(249,115,22,0.15)`,
};

/** State-specific glow appended to compact shadow when sessions are active. */
export const STATE_GLOW: Record<AnimationState, string> = {
  [AnimationState.Idle]: '',
  [AnimationState.Working]: ', 0 0 15px rgba(59,130,246,0.15)',
  [AnimationState.NeedsYou]: ', 0 0 20px rgba(245,158,11,0.15)',
  [AnimationState.Thinking]: ', 0 0 15px rgba(139,92,246,0.15)',
  [AnimationState.Error]: ', 0 0 15px rgba(239,68,68,0.15)',
  [AnimationState.Done]: ', 0 0 15px rgba(34,197,94,0.15)',
  [AnimationState.Question]: ', 0 0 18px rgba(250,204,21,0.2)',
};

// ---------------------------------------------------------------------------
// State color palette
// ---------------------------------------------------------------------------

export interface IStateColors {
  readonly dot: string;
  readonly bg: string;
  readonly text: string;
  readonly glow: string;
}

export const STATE_COLORS: Record<AnimationState, IStateColors> = {
  [AnimationState.Idle]: { dot: '#6b7280', bg: '#000000', text: '#8b8fa3', glow: 'none' },
  [AnimationState.Working]: { dot: '#3b82f6', bg: '#000000', text: '#60a5fa', glow: '0 0 12px rgba(59,130,246,0.3)' },
  [AnimationState.NeedsYou]: { dot: '#f59e0b', bg: '#000000', text: '#fbbf24', glow: '0 0 16px rgba(245,158,11,0.3)' },
  [AnimationState.Thinking]: { dot: '#8b5cf6', bg: '#000000', text: '#a78bfa', glow: '0 0 12px rgba(139,92,246,0.3)' },
  [AnimationState.Error]: { dot: '#ef4444', bg: '#000000', text: '#fca5a5', glow: '0 0 12px rgba(239,68,68,0.3)' },
  [AnimationState.Done]: { dot: '#22c55e', bg: '#000000', text: '#4ade80', glow: '0 0 12px rgba(34,197,94,0.3)' },
  [AnimationState.Question]: { dot: '#facc15', bg: '#000000', text: '#fde047', glow: '0 0 14px rgba(250,204,21,0.3)' },
};

// ---------------------------------------------------------------------------
// Per-agent brand palette (drives BrandGlyph accent color)
// ---------------------------------------------------------------------------

/**
 * Sky-blue fallback used when the island is collapsed with no active agent
 * session — preserves the original brand color in the default state.
 */
export const DEFAULT_BRAND_COLOR = '#3b82f6';

/**
 * Yellow accent used by the pet glyph when an AskUserQuestion is pending.
 * Matches the Tailwind `yellow-400` palette so the Question state reads
 * clearly against the `DEFAULT_BRAND_COLOR` sky-blue family.
 */
export const QUESTION_BRAND_COLOR = '#facc15';

/**
 * Accent color per external agent. Used by `BrandGlyph` to tint the pixel
 * pet so each agent reads at a glance.
 */
export const AGENT_COLORS: Record<ExternalAgentType, string> = {
  'claude-code': '#D97757', // Anthropic warm orange
  codex: '#10A37F', // OpenAI green
  cursor: '#E5E7EB', // Cursor silver
  gemini: '#4285F4', // Google blue
  copilot: '#A78BFA', // GitHub Copilot violet
  codebuddy: '#EC4899', // CodeBuddy pink
  opencode: '#F97316', // OpenCode orange
  'kimi-code': '#A855F7', // Moonshot purple
  unknown: '#9CA3AF', // neutral grey
};

// ---------------------------------------------------------------------------
// Window dimensions (Electron BrowserWindow — fixed, CSS drives the morph)
// ---------------------------------------------------------------------------

export const ISLAND_WINDOW_WIDTH = 680;
export const ISLAND_WINDOW_HEIGHT = 580;

// ---------------------------------------------------------------------------
// Timings
// ---------------------------------------------------------------------------

export const CAROUSEL_INTERVAL_MS = 3000;
export const AUTO_COLLAPSE_DELAY_MS = 1000;
export const SESSION_DONE_LINGER_MS = 3000;
