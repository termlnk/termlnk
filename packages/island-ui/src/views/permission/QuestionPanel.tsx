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

import type { IAnswerMap, IAskUserQuestion, IAskUserQuestionRequestPayload } from '@termlnk/island';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuestionOption } from './QuestionOption';

interface IQuestionPanelProps {
  readonly request: IAskUserQuestionRequestPayload;
  /** Single-question single-pick no-customise no-secret → submit a bare label. */
  readonly onSubmitSingleLabel: (label: string) => void;
  /** Any other shape → submit a multi-question answer map. */
  readonly onSubmitAnswers: (answers: IAnswerMap) => void;
  /** Cancel the whole interaction (maps to `deny`). */
  readonly onDeny: () => void;
}

/**
 * Per-question local state: which predefined labels are picked, whether
 * the "Other…" free-text affordance is active, and the free-text value.
 * Keyed by {@link IAskUserQuestion.id} so answers survive navigating
 * between questions in a multi-question set.
 */
interface IPerQuestionState {
  readonly labels: readonly string[];
  readonly otherActive: boolean;
  readonly customText: string;
}

const EMPTY_STATE: IPerQuestionState = { labels: [], otherActive: false, customText: '' };

/**
 * Full-surface renderer for an AskUserQuestion-style picker. Handles:
 *
 * - 1-N question paging with a `1/N` progress indicator
 * - Single / multi-select with space-toggle and ⌘1-9 quick pick
 * - Optional "Other…" free-text affordance (`allowCustom`)
 * - Masked secret input (`isSecret`)
 * - Per-option preview pane that expands under the focused option when
 *   the option carries a Markdown/HTML preview snippet
 * - Keyboard navigation: ↑↓ to change focus, Space/Enter to toggle or
 *   advance, ⌘← for previous question, ⌘Y to advance/submit, ⌘N/Esc
 *   to cancel. Number keys 1-9 also quick-pick.
 *
 * Quick-path: when the set contains a single single-select question
 * with no customise/secret requirement, tapping an option bypasses the
 * pagination flow and submits {@link onSubmitSingleLabel} directly,
 * which lets Claude Code's macOS keyboard-injection mirror continue to
 * fast-path without constructing an {@link IAnswerMap}.
 */
export function QuestionPanel({ request, onSubmitSingleLabel, onSubmitAnswers, onDeny }: IQuestionPanelProps) {
  const localeService = useDependency(LocaleService);

  // Prefer the new `questionSet` carrier; fall back to the single-question
  // alias so older payloads still render.
  const questions = useMemo<readonly IAskUserQuestion[]>(
    () => request.questionSet?.questions ?? [request.question],
    [request.questionSet, request.question]
  );

  const isQuickPath = useMemo(() => {
    if (questions.length !== 1) {
      return false;
    }
    const q = questions[0]!;
    return !q.multiSelect && !q.allowCustom && !q.isSecret;
  }, [questions]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [state, setState] = useState<Record<string, IPerQuestionState>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, EMPTY_STATE]))
  );
  const [focusedOpt, setFocusedOpt] = useState(0);
  const secretInputRef = useRef<HTMLInputElement | null>(null);
  const otherInputRef = useRef<HTMLInputElement | null>(null);

  const currentQ = questions[currentIdx]!;
  const totalFocusable = currentQ.options.length + (currentQ.allowCustom ? 1 : 0);
  const otherSlotIndex = currentQ.options.length;

  // Reset focus at each question turn so the first entry always starts
  // highlighted; autofocus the password/input when the field is live.
  useEffect(() => {
    setFocusedOpt(0);
    if (currentQ.isSecret) {
      secretInputRef.current?.focus();
    }
  }, [currentIdx, currentQ.isSecret]);

  const currentState = state[currentQ.id] ?? EMPTY_STATE;

  const updateState = useCallback((patch: (prev: IPerQuestionState) => IPerQuestionState) => {
    setState((all) => ({ ...all, [currentQ.id]: patch(all[currentQ.id] ?? EMPTY_STATE) }));
  }, [currentQ.id]);

  const toggleLabel = useCallback((label: string) => {
    updateState((prev) => {
      if (currentQ.multiSelect) {
        const has = prev.labels.includes(label);
        return {
          ...prev,
          labels: has ? prev.labels.filter((l) => l !== label) : [...prev.labels, label],
        };
      }
      return { ...prev, labels: [label], otherActive: false };
    });
  }, [updateState, currentQ.multiSelect]);

  const toggleOther = useCallback(() => {
    updateState((prev) => {
      const next = !prev.otherActive;
      // In single-select mode, activating Other clears the label pick.
      if (!currentQ.multiSelect && next) {
        return { ...prev, otherActive: true, labels: [] };
      }
      return { ...prev, otherActive: next };
    });
    // Give focus to the text field so the user can start typing immediately.
    queueMicrotask(() => otherInputRef.current?.focus());
  }, [updateState, currentQ.multiSelect]);

  const setCustomText = useCallback((value: string) => {
    updateState((prev) => ({ ...prev, customText: value }));
  }, [updateState]);

  const buildAnswers = useCallback((): IAnswerMap => {
    const answers: IAnswerMap = {};
    for (const q of questions) {
      const entry = state[q.id] ?? EMPTY_STATE;
      const labels = [...entry.labels];
      const customTrimmed = entry.customText.trim();
      const includeCustom = (q.isSecret || entry.otherActive) && customTrimmed.length > 0;
      if (labels.length === 0 && !includeCustom) {
        continue;
      }
      answers[q.id] = includeCustom
        ? { labels, custom: customTrimmed }
        : { labels };
    }
    return answers;
  }, [questions, state]);

  const advanceOrSubmit = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      return;
    }
    // Quick-path single-question single-pick: submit as a bare label so the
    // keyboard-injection fast lane in the server stays live.
    if (isQuickPath) {
      const only = state[currentQ.id]?.labels[0];
      if (only) {
        onSubmitSingleLabel(only);
        return;
      }
    }
    onSubmitAnswers(buildAnswers());
  }, [currentIdx, questions.length, isQuickPath, state, currentQ.id, onSubmitSingleLabel, onSubmitAnswers, buildAnswers]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  }, [currentIdx]);

  // Keyboard bindings scoped to the active question turn.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typingInField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      // Meta-modified shortcuts always win (work even while typing).
      if (e.metaKey) {
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          advanceOrSubmit();
          return;
        }
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          onDeny();
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goPrev();
          return;
        }
        const num = Number.parseInt(e.key, 10);
        if (num >= 1 && num <= currentQ.options.length) {
          e.preventDefault();
          const opt = currentQ.options[num - 1];
          if (opt) {
            toggleLabel(opt.label);
            if (isQuickPath) {
              onSubmitSingleLabel(opt.label);
            }
          }
          return;
        }
      }

      if (typingInField) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onDeny();
        return;
      }
      if (currentQ.isSecret) {
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedOpt((idx) => (totalFocusable > 0 ? (idx + 1) % totalFocusable : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedOpt((idx) => (totalFocusable > 0 ? (idx - 1 + totalFocusable) % totalFocusable : 0));
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (focusedOpt < currentQ.options.length) {
          const opt = currentQ.options[focusedOpt]!;
          toggleLabel(opt.label);
          if (e.key === 'Enter' && isQuickPath) {
            onSubmitSingleLabel(opt.label);
          }
        } else if (currentQ.allowCustom) {
          toggleOther();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentQ, totalFocusable, focusedOpt, isQuickPath, advanceOrSubmit, goPrev, onDeny, onSubmitSingleLabel, toggleLabel, toggleOther]);

  const t = (key: string, ...params: string[]) => localeService.t(key, ...params);
  const progress = t('island-ui.permission.question.progress', String(currentIdx + 1), String(questions.length));

  return (
    <>
      <div
        className={cn('tm:flex tm:items-center tm:gap-1.5')}
        style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-question, #06b6d4)' }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="var(--color-question, #06b6d4)" opacity={0.9}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        {t('island-ui.permission.claude-asks')}
        {currentQ.header && (
          <span
            className={cn('tm:rounded-sm')}
            style={{
              fontSize: 9,
              padding: '1px 5px',
              background: 'rgba(6,182,212,0.25)',
              color: 'rgba(255,255,255,0.85)',
              fontWeight: 600,
            }}
          >
            {currentQ.header}
          </span>
        )}
        {questions.length > 1 && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
            {progress}
          </span>
        )}
        {request.source === 'external' && (
          <span
            className={cn('tm:ml-auto tm:shrink-0 tm:rounded-sm')}
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            {t('island-ui.permission.external')}
          </span>
        )}
      </div>

      <div
        className={cn('tm:flex tm:flex-col tm:gap-2 tm:overflow-auto')}
        style={{ fontSize: 11, color: 'rgba(255,255,255,0.92)' }}
      >
        <div style={{ fontWeight: 500, lineHeight: 1.4 }}>
          {currentQ.question}
        </div>

        {currentQ.multiSelect && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
            {t('island-ui.permission.question.select-all-that-apply')}
          </div>
        )}

        {currentQ.isSecret
          ? (
            <input
              ref={secretInputRef}
              type="password"
              value={currentState.customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={t('island-ui.permission.question.secret-placeholder')}
              className={cn('tm:w-full tm:rounded-sm tm:border-none tm:font-mono tm:outline-none')}
              style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.92)',
                fontSize: 11,
              }}
              autoFocus
            />
          )
          : (
            <div className={cn('tm:flex tm:flex-col tm:gap-1')}>
              {currentQ.options.map((opt, i) => (
                <QuestionOption
                  key={`${currentQ.id}-${i}`}
                  index={i}
                  option={opt}
                  selected={currentState.labels.includes(opt.label)}
                  focused={focusedOpt === i && !currentState.otherActive}
                  multiSelect={currentQ.multiSelect ?? false}
                  onToggle={() => {
                    toggleLabel(opt.label);
                    if (isQuickPath) {
                      onSubmitSingleLabel(opt.label);
                    }
                  }}
                  onFocus={() => setFocusedOpt(i)}
                />
              ))}
              {currentQ.allowCustom && (
                <div className={cn('tm:flex tm:flex-col tm:gap-1')}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFocusedOpt(otherSlotIndex);
                      toggleOther();
                    }}
                    onMouseEnter={() => setFocusedOpt(otherSlotIndex)}
                    className={cn(`
                      tm:flex tm:w-full tm:cursor-pointer tm:items-center tm:gap-2 tm:border-none tm:text-left
                    `)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: currentState.otherActive
                        ? 'rgba(6,182,212,0.2)'
                        : focusedOpt === otherSlotIndex
                          ? 'rgba(6,182,212,0.12)'
                          : 'rgba(255,255,255,0.06)',
                      outline: focusedOpt === otherSlotIndex ? '1px solid rgba(6,182,212,0.5)' : 'none',
                      outlineOffset: -1,
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  >
                    <span
                      className={cn('tm:flex tm:items-center tm:justify-center')}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: currentQ.multiSelect ? 2 : '50%',
                        border: `1.25px solid ${currentState.otherActive ? 'rgba(6,182,212,1)' : 'rgba(255,255,255,0.4)'}`,
                        background: currentState.otherActive ? 'rgba(6,182,212,0.9)' : 'transparent',
                      }}
                    />
                    <span style={{ fontStyle: 'italic' }}>
                      {t('island-ui.permission.question.other-placeholder')}
                    </span>
                  </button>
                  {currentState.otherActive && (
                    <input
                      ref={otherInputRef}
                      type="text"
                      value={currentState.customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className={cn('tm:w-full tm:rounded-sm tm:border-none tm:font-mono tm:outline-none')}
                      style={{
                        padding: '5px 10px',
                        background: 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.92)',
                        fontSize: 11,
                      }}
                      autoFocus
                    />
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      <div className={cn('tm:mt-auto tm:flex tm:gap-1.5 tm:pt-1 tm:pb-2.5')}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeny();
          }}
          className={cn('tm:flex-1 tm:cursor-pointer tm:border-none')}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 500,
            background: 'rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.9)',
          }}
        >
          {t('island-ui.permission.deny')}
          {' '}
          <kbd className={cn('tm:font-mono')} style={{ fontSize: 8, opacity: 0.5 }}>&#8984;N</kbd>
        </button>
        {currentIdx > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className={cn('tm:cursor-pointer tm:border-none')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 500,
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            {t('island-ui.permission.question.previous')}
          </button>
        )}
        {!isQuickPath && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              advanceOrSubmit();
            }}
            className={cn('tm:flex-1 tm:cursor-pointer tm:border-none')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 500,
              background: 'rgba(6,182,212,0.9)',
              color: '#fff',
            }}
          >
            {currentIdx < questions.length - 1
              ? t('island-ui.permission.question.next')
              : t('island-ui.permission.question.submit')}
            {' '}
            <kbd className={cn('tm:font-mono')} style={{ fontSize: 8, opacity: 0.6 }}>&#8984;Y</kbd>
          </button>
        )}
      </div>
    </>
  );
}
