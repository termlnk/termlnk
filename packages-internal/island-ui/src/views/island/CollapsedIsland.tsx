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

import type { IIslandSession } from '@termlnk/island';
import { cn } from '@termlnk/design';
import { AGENT_COLORS, AGENT_DISPLAY_NAMES, AnimationState, DEFAULT_BRAND_COLOR, QUESTION_BRAND_COLOR, SessionPhase } from '@termlnk/island';
import { BrandGlyph } from './BrandGlyph';

interface ICollapsedIslandProps {
  sessions: IIslandSession[];
  activeSession: IIslandSession | null;
  animationState: AnimationState;
  onClick: () => void;
}

export function CollapsedIsland({ sessions, activeSession, animationState, onClick }: ICollapsedIslandProps) {
  const isQuestioning = animationState === AnimationState.Question;
  // Pulse for both Working and Question states — Question reuses the same
  // pulse rhythm but with a yellow accent so "terminal needs input" reads
  // at a glance.
  const animated = animationState === AnimationState.Working || isQuestioning;
  // Brand glyph tracks the active agent; collapsed idle keeps the default
  // sky-blue. A pending AskUserQuestion overrides to yellow regardless of
  // agent so the Question state is unambiguous.
  let brandColor: string;
  if (isQuestioning) {
    brandColor = QUESTION_BRAND_COLOR;
  } else if (activeSession) {
    brandColor = AGENT_COLORS[activeSession.agent] ?? DEFAULT_BRAND_COLOR;
  } else {
    brandColor = DEFAULT_BRAND_COLOR;
  }

  // Once the turn ends, fall back to the stable `project · title` label
  // instead of the stale tool activity (mirrors the Done marker).
  const showToolActivity = activeSession !== null
    && activeSession.phase !== SessionPhase.WaitingForInput
    && activeSession.phase !== SessionPhase.Ended;

  // Priority:
  //   1. Most recent tool activity ("Bash: git status") while the turn is live
  //   2. project · title (stable, survives resume)
  //   3. project / agent name
  //   4. empty (brand glyph only)
  let primaryText: string;
  if (showToolActivity && activeSession.lastToolName && activeSession.lastToolDetail) {
    primaryText = `${activeSession.lastToolName}: ${activeSession.lastToolDetail}`;
  } else if (showToolActivity && activeSession.lastToolDescription) {
    primaryText = activeSession.lastToolDescription;
  } else if (activeSession?.title) {
    primaryText = activeSession.project
      ? `${activeSession.project} · ${activeSession.title}`
      : activeSession.title;
  } else if (activeSession) {
    primaryText = activeSession.project
      ?? AGENT_DISPLAY_NAMES[activeSession.agent]
      ?? activeSession.agent;
  } else {
    primaryText = '';
  }

  return (
    <div
      onClick={onClick}
      className={cn('tm:flex tm:size-full tm:items-center tm:gap-2')}
    >
      <BrandGlyph accentColor={brandColor} animated={animated} questioning={isQuestioning} />
      <span
        className={cn('tm:flex-1 tm:truncate')}
        style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}
      >
        {primaryText}
      </span>
      {/* Always show the session count — defaults to 0 when no agent is active. */}
      <span
        className={cn('tm:shrink-0')}
        style={{
          fontSize: 9,
          fontWeight: 600,
          background: 'rgba(255,255,255,0.12)',
          padding: '1px 5px',
          borderRadius: 4,
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        {sessions.length}
      </span>
    </div>
  );
}
