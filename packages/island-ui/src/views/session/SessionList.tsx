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

import type { AgentTodoStatus, AnimationState, IAgentTodo, IIslandSession } from '@termlnk/island';
import type { ReactNode } from 'react';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { AGENT_COLORS, AGENT_DISPLAY_NAMES, DEFAULT_BRAND_COLOR, SessionPhase, sessionToAnimationState, STATE_COLORS } from '@termlnk/island';
import { Moon } from 'lucide-react';
import { useElapsedTime } from '../hooks/use-elapsed-time';
import { BrandGlyph } from '../island/BrandGlyph';

// ---------------------------------------------------------------------------
// Tag (agent badge / directory label)
// ---------------------------------------------------------------------------

function Tag({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn('tm:shrink-0')}
      style={{
        fontSize: 9,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.5)',
        background: 'rgba(255,255,255,0.1)',
        padding: '2px 5px',
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ToolTag — colored pill for the tool name in the third line
// ---------------------------------------------------------------------------

/**
 * Per-tool accent colors. Unknown tools fall back to neutral grey.
 * Values match Tailwind 500-shades so they read well on the dark island.
 */
const TOOL_COLORS: Record<string, string> = {
  Bash: '#10B981', // green
  Shell: '#10B981', // Kimi Code's bash-equivalent
  Edit: '#3B82F6', // blue
  MultiEdit: '#3B82F6',
  Write: '#3B82F6',
  Read: '#94A3B8', // slate
  Glob: '#A855F7', // purple
  Grep: '#A855F7',
  WebFetch: '#EC4899', // pink
  WebSearch: '#EC4899',
  Agent: '#F59E0B', // amber
  AskUserQuestion: '#F59E0B',
  Task: '#F59E0B',
};

function ToolTag({ tool }: { tool: string }) {
  const color = TOOL_COLORS[tool] ?? '#6B7280';
  return (
    <span
      className={cn('tm:shrink-0')}
      style={{
        fontSize: 9,
        fontWeight: 600,
        color,
        background: `${color}22`,
        padding: '1px 5px',
        borderRadius: 4,
      }}
    >
      {tool}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TodoListSection — task plan rendered under the session content
// ---------------------------------------------------------------------------

const TODO_TEXT_COLOR: Record<AgentTodoStatus, string> = {
  completed: 'rgba(255,255,255,0.4)',
  in_progress: '#fff',
  pending: 'rgba(255,255,255,0.7)',
};

function TodoIcon({ status }: { status: AgentTodoStatus }) {
  if (status === 'completed') {
    return (
      <span
        className={cn('tm:inline-flex tm:shrink-0 tm:items-center tm:justify-center')}
        style={{ width: 10, height: 10, color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1 }}
      >
        ☑
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span
        className={cn('tm:inline-block tm:shrink-0 tm:rounded-full')}
        style={{ width: 8, height: 8, background: '#3B82F6' }}
      />
    );
  }
  return (
    <span
      className={cn('tm:inline-block tm:shrink-0 tm:rounded-full')}
      style={{
        width: 8,
        height: 8,
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'transparent',
      }}
    />
  );
}

function TodoItem({ todo }: { todo: IAgentTodo }) {
  const label = todo.status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content;
  return (
    <li
      className={cn('tm:flex tm:items-center tm:gap-1.5 tm:truncate')}
      style={{ fontSize: 11, lineHeight: 1.3 }}
    >
      <TodoIcon status={todo.status} />
      <span
        className={cn('tm:truncate')}
        style={{
          color: TODO_TEXT_COLOR[todo.status],
          textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
          fontWeight: todo.status === 'in_progress' ? 500 : 400,
        }}
      >
        {label}
      </span>
    </li>
  );
}

function TodoListSection({ todos }: { todos: readonly IAgentTodo[] }) {
  const localeService = useDependency(LocaleService);
  const completed = todos.filter((t) => t.status === 'completed').length;
  const inProgress = todos.filter((t) => t.status === 'in_progress').length;
  const pending = todos.filter((t) => t.status === 'pending').length;

  return (
    <div
      className={cn('tm:mt-1.5 tm:rounded-md tm:px-2 tm:py-1.5')}
      style={{ background: 'rgba(255,255,255,0.04)' }}
    >
      <div
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.4)',
          marginBottom: 4,
          letterSpacing: '0.02em',
        }}
      >
        {localeService.t('island-ui.session.todo-summary', String(completed), String(inProgress), String(pending))}
      </div>
      <ul
        className={cn('tm:flex tm:flex-col tm:gap-0.5')}
        style={{ listStyle: 'none', padding: 0, margin: 0 }}
      >
        {todos.map((t) => <TodoItem key={t.id} todo={t} />)}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionCard — uniform card for each session
// ---------------------------------------------------------------------------

function SessionCard({ session }: { session: IIslandSession }) {
  const localeService = useDependency(LocaleService);
  const anim = sessionToAnimationState(session);
  const colors = STATE_COLORS[anim];
  const agentName = AGENT_DISPLAY_NAMES[session.agent] || session.agent;
  const elapsed = useElapsedTime(session.startedAt);
  const isDone = session.phase === SessionPhase.WaitingForInput || session.phase === SessionPhase.Ended;

  return (
    <div
      className={cn('tm:flex tm:items-start tm:gap-2.5 tm:rounded-lg tm:p-2 tm:transition-colors tm:duration-150')}
      style={{ fontSize: 12 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Brand icon with state accent */}
      <div className={cn('tm:mt-0.5 tm:shrink-0')}>
        <BrandGlyph
          accentColor={AGENT_COLORS[session.agent] ?? DEFAULT_BRAND_COLOR}
          animated={anim === 'working'}
        />
      </div>

      {/* Content */}
      <div className={cn('tm:min-w-0 tm:flex-1')}>
        {/* Title row: "project · <title>" with meta tags on the right */}
        <div className={cn('tm:flex tm:items-center tm:gap-1.5')}>
          <span
            className={cn('tm:flex-1 tm:truncate tm:leading-tight tm:font-medium')}
            style={{ color: '#fff' }}
          >
            {session.project && (
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                {session.project}
                {' · '}
              </span>
            )}
            {session.title || agentName}
          </span>
          {session.source === 'external' && <Tag>{localeService.t('island-ui.session.external')}</Tag>}
          <Tag>{agentName}</Tag>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{elapsed}</span>
        </div>

        {/* User prompt */}
        {session.lastPrompt && (
          <div
            className={cn('tm:mt-0.5 tm:truncate')}
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}
          >
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>{localeService.t('island-ui.session.user-prompt-prefix')}</span>
            {session.lastPrompt}
          </div>
        )}

        {!isDone && session.lastToolName && (
          <div
            className={cn('tm:mt-1 tm:flex tm:items-center tm:gap-1.5')}
            style={{ fontSize: 10, lineHeight: 1.3 }}
          >
            <ToolTag tool={session.lastToolName} />
            {session.lastToolDetail && (
              <span
                className={cn('tm:min-w-0 tm:flex-1 tm:truncate tm:font-mono')}
                style={{ color: colors.text }}
              >
                {session.lastToolDetail}
              </span>
            )}
          </div>
        )}
        {isDone && (
          <div
            className={cn('tm:mt-0.5')}
            style={{ fontSize: 10, lineHeight: 1.3, color: STATE_COLORS.done.text }}
          >
            {localeService.t('island-ui.session.done')}
          </div>
        )}

        {/* Task plan (from agent's todo-list tool calls) */}
        {session.todos && session.todos.length > 0 && (
          <TodoListSection todos={session.todos} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SleepingMoonIcon — empty-state glyph (lucide Moon + stacked Zzz snoring)
// ---------------------------------------------------------------------------

function SleepingMoonIcon() {
  return (
    <div className={cn('tm:relative')} style={{ width: 44, height: 36 }}>
      <Moon
        size={28}
        strokeWidth={2}
        fill="rgba(255,255,255,0.35)"
        color="rgba(255,255,255,0.6)"
        style={{ position: 'absolute', left: 0, bottom: 0 }}
      />
      {/* Stacked Zzz — ascending size & opacity toward the top */}
      <span
        style={{
          position: 'absolute',
          left: 22,
          top: 14,
          fontSize: 8,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1,
        }}
      >
        z
      </span>
      <span
        style={{
          position: 'absolute',
          left: 26,
          top: 6,
          fontSize: 11,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1,
        }}
      >
        z
      </span>
      <span
        style={{
          position: 'absolute',
          left: 32,
          top: -2,
          fontSize: 14,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.7)',
          lineHeight: 1,
        }}
      >
        Z
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionList (OverviewLayer content)
// ---------------------------------------------------------------------------

interface ISessionListProps {
  sessions: IIslandSession[];
  animationState: AnimationState;
  onCollapse: () => void;
}

export function SessionList({ sessions, animationState, onCollapse }: ISessionListProps) {
  const localeService = useDependency(LocaleService);
  const colors = STATE_COLORS[animationState];

  if (sessions.length === 0) {
    return (
      <div
        onClick={onCollapse}
        className={cn('tm:flex tm:size-full tm:cursor-pointer tm:flex-col tm:items-center tm:justify-center tm:gap-2')}
      >
        <SleepingMoonIcon />
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.05em',
          }}
        >
          {localeService.t('island-ui.session.empty-state')}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div
        onClick={onCollapse}
        className={cn('tm:flex tm:cursor-pointer tm:items-center tm:gap-1.5 tm:px-2 tm:pb-1')}
        style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}
      >
        <div
          className={cn('tm:shrink-0 tm:rounded-full')}
          style={{ width: 6, height: 6, background: colors.dot }}
        />
        <span className={cn('tm:flex-1')}>
          {localeService.t('island-ui.session.session-count', String(sessions.length))}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>&#9650;</span>
      </div>

      {/* Session cards */}
      {sessions.map((session) => (
        <SessionCard key={session.terminalSessionId} session={session} />
      ))}
    </>
  );
}
