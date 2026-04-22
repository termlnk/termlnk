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

import type { IAnswerMap, IQuestionViewModel } from '@termlnk/island';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { deriveQuestionFacets } from '@termlnk/island';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuestionBreadcrumb } from './QuestionBreadcrumb';
import { QuestionOption } from './QuestionOption';

interface IQuestionPanelProps {
  readonly viewModel: IQuestionViewModel;
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
 * Keyed by `IAskUserQuestion.id` so answers survive navigating between
 * questions in a multi-question set.
 */
interface IPerQuestionState {
  readonly labels: readonly string[];
  readonly otherActive: boolean;
  readonly customText: string;
}

const EMPTY_STATE: IPerQuestionState = { labels: [], otherActive: false, customText: '' };

/**
 * Full-surface renderer for an AskUserQuestion-style picker. Consumes a
 * pre-derived {@link IQuestionViewModel} so every branch (multi-select
 * vs single, multi-question vs single, quick-path vs explicit submit)
 * is decided at the view-model layer instead of sprinkled inline.
 *
 * Quick-path — only enabled when `viewModel.isQuickPath` — lets Claude
 * Code's keyboard-injection mirror continue to fast-forward single-pick
 * single-question prompts by forwarding a bare label. Every other shape
 * goes through `onSubmitAnswers(IAnswerMap)` and requires an explicit
 * Submit click (or ⌘Y / ⌘→ on the last question).
 */
export function QuestionPanel({ viewModel, onSubmitSingleLabel, onSubmitAnswers, onDeny }: IQuestionPanelProps) {
  const localeService = useDependency(LocaleService);
  const { request, questions, totalQuestions, isMultiQuestion, isQuickPath } = viewModel;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [state, setState] = useState<Record<string, IPerQuestionState>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, EMPTY_STATE]))
  );
  const [focusedOpt, setFocusedOpt] = useState(0);
  const secretInputRef = useRef<HTMLInputElement | null>(null);
  const otherInputRef = useRef<HTMLInputElement | null>(null);

  const currentQ = questions[currentIdx]!;
  const facets = useMemo(() => deriveQuestionFacets(currentQ), [currentQ]);
  const totalFocusable = currentQ.options.length + (facets.hasCustomSlot && !facets.isSecret ? 1 : 0);
  const otherSlotIndex = currentQ.options.length;

  // Reset focus on every question turn; autofocus the secret input when live.
  useEffect(() => {
    setFocusedOpt(0);
    if (facets.isSecret) {
      secretInputRef.current?.focus();
    }
  }, [currentIdx, facets.isSecret]);

  const currentState = state[currentQ.id] ?? EMPTY_STATE;

  const updateState = useCallback((patch: (prev: IPerQuestionState) => IPerQuestionState) => {
    setState((all) => ({ ...all, [currentQ.id]: patch(all[currentQ.id] ?? EMPTY_STATE) }));
  }, [currentQ.id]);

  const toggleLabel = useCallback((label: string) => {
    updateState((prev) => {
      if (facets.isMultiSelect) {
        const has = prev.labels.includes(label);
        return {
          ...prev,
          labels: has ? prev.labels.filter((l) => l !== label) : [...prev.labels, label],
        };
      }
      return { ...prev, labels: [label], otherActive: false };
    });
  }, [updateState, facets.isMultiSelect]);

  const toggleOther = useCallback(() => {
    updateState((prev) => {
      const next = !prev.otherActive;
      // In single-select mode, activating Other clears the label pick.
      if (!facets.isMultiSelect && next) {
        return { ...prev, otherActive: true, labels: [] };
      }
      return { ...prev, otherActive: next };
    });
    queueMicrotask(() => otherInputRef.current?.focus());
  }, [updateState, facets.isMultiSelect]);

  const setCustomText = useCallback((value: string) => {
    updateState((prev) => ({ ...prev, customText: value }));
  }, [updateState]);

  const buildAnswers = useCallback((): IAnswerMap => {
    const answers: IAnswerMap = {};
    for (const q of questions) {
      const entry = state[q.id] ?? EMPTY_STATE;
      const labels = [...entry.labels];
      const customTrimmed = entry.customText.trim();
      const includeCustom = (q.isSecret === true || entry.otherActive) && customTrimmed.length > 0;
      if (labels.length === 0 && !includeCustom) {
        continue;
      }
      answers[q.id] = includeCustom
        ? { labels, custom: customTrimmed }
        : { labels };
    }
    return answers;
  }, [questions, state]);

  // Which question slots already have a user-visible answer? Fuels the
  // breadcrumb fill and lets ⌘→ submit when all questions are answered.
  const answeredMask = useMemo(() => questions.map((q) => {
    const entry = state[q.id] ?? EMPTY_STATE;
    const hasCustom = (q.isSecret === true || entry.otherActive) && entry.customText.trim().length > 0;
    return entry.labels.length > 0 || hasCustom;
  }), [questions, state]);

  const submitAll = useCallback(() => {
    if (isQuickPath) {
      const only = state[currentQ.id]?.labels[0];
      if (only) {
        onSubmitSingleLabel(only);
        return;
      }
    }
    onSubmitAnswers(buildAnswers());
  }, [isQuickPath, state, currentQ.id, onSubmitSingleLabel, onSubmitAnswers, buildAnswers]);

  const goNext = useCallback(() => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx(currentIdx + 1);
      return;
    }
    submitAll();
  }, [currentIdx, totalQuestions, submitAll]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  }, [currentIdx]);

  const jumpTo = useCallback((idx: number) => {
    if (idx >= 0 && idx < totalQuestions) {
      setCurrentIdx(idx);
    }
  }, [totalQuestions]);

  // Keyboard bindings scoped to the active question turn.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typingInField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (e.metaKey) {
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          submitAll();
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
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          goNext();
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
      if (facets.isSecret) {
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
          // Enter on a quick-path question doubles as "submit my pick".
          // Space never submits — reserved for toggling without commit.
          if (e.key === 'Enter' && isQuickPath) {
            onSubmitSingleLabel(opt.label);
          }
        }
        else if (facets.hasCustomSlot && !facets.isSecret) {
          toggleOther();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentQ, facets, totalFocusable, focusedOpt, isQuickPath, submitAll, goPrev, goNext, onDeny, onSubmitSingleLabel, toggleLabel, toggleOther]);

  const t = (key: string, ...params: string[]) => localeService.t(key, ...params);
  const progress = t('island-ui.permission.question.progress', String(currentIdx + 1), String(totalQuestions));

  const showPrev = isMultiQuestion;
  const showNext = isMultiQuestion && currentIdx < totalQuestions - 1;
  const showSubmit = !isMultiQuestion || currentIdx === totalQuestions - 1;
  const selectAtLeastOne
    = facets.isMultiSelect && currentState.labels.length === 0 && !currentState.otherActive;

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
        {isMultiQuestion && (
          <div className={cn('tm:flex tm:items-center tm:gap-1.5')}>
            <QuestionBreadcrumb
              total={totalQuestions}
              currentIdx={currentIdx}
              answeredMask={answeredMask}
              headers={questions.map((q) => q.header ?? q.question)}
              onJump={jumpTo}
            />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
              {progress}
            </span>
          </div>
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

        {facets.isMultiSelect && (
          <div
            style={{
              fontSize: 9,
              color: selectAtLeastOne ? 'var(--color-alert, #f97316)' : 'rgba(255,255,255,0.5)',
            }}
          >
            {selectAtLeastOne
              ? t('island-ui.permission.question.select-at-least-one')
              : t('island-ui.permission.question.select-all-that-apply')}
          </div>
        )}

        {facets.isSecret
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
                  multiSelect={facets.isMultiSelect}
                  onToggle={() => {
                    toggleLabel(opt.label);
                    // Quick-path only: a single click commits. Multi-select /
                    // multi-question / custom-slot prompts require explicit
                    // Submit so users can revise without premature commit.
                    if (isQuickPath) {
                      onSubmitSingleLabel(opt.label);
                    }
                  }}
                  onFocus={() => setFocusedOpt(i)}
                />
              ))}
              {facets.hasCustomSlot && !facets.isSecret && (
                <div
                  className={cn(
                    `
                      tm:flex tm:w-full tm:items-center tm:gap-2 tm:border-none
                    `,
                    { 'tm:cursor-pointer': !currentState.otherActive }
                  )}
                  onClick={(e) => {
                    if (currentState.otherActive) {
                      return;
                    }
                    e.stopPropagation();
                    setFocusedOpt(otherSlotIndex);
                    toggleOther();
                  }}
                  onMouseEnter={() => setFocusedOpt(otherSlotIndex)}
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
                    minHeight: 28,
                  }}
                >
                  <span
                    className={cn('tm:flex tm:shrink-0 tm:items-center tm:justify-center')}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: facets.isMultiSelect ? 2 : '50%',
                      border: `1.25px solid ${currentState.otherActive ? 'rgba(6,182,212,1)' : 'rgba(255,255,255,0.4)'}`,
                      background: currentState.otherActive ? 'rgba(6,182,212,0.9)' : 'transparent',
                    }}
                  />
                  {currentState.otherActive
                    ? (
                      <input
                        ref={otherInputRef}
                        type="text"
                        value={currentState.customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder={t('island-ui.permission.question.other-input-placeholder')}
                        className={cn(
                          `
                            tm:flex-1 tm:border-none tm:bg-transparent tm:font-mono tm:outline-none
                          `
                        )}
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.92)',
                        }}
                      />
                    )
                    : (
                      <span className={cn('tm:flex-1 tm:italic')} style={{ fontStyle: 'italic' }}>
                        {t('island-ui.permission.question.other-placeholder')}
                      </span>
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
        {showPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            disabled={currentIdx === 0}
            className={cn(
              'tm:cursor-pointer tm:border-none',
              { 'tm:cursor-not-allowed tm:opacity-40': currentIdx === 0 }
            )}
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
        {showNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className={cn('tm:flex-1 tm:cursor-pointer tm:border-none')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 500,
              background: 'rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            {t('island-ui.permission.question.next')}
            {' '}
            <kbd className={cn('tm:font-mono')} style={{ fontSize: 8, opacity: 0.5 }}>&#8984;&#8594;</kbd>
          </button>
        )}
        {showSubmit && !isQuickPath && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              submitAll();
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
            {t('island-ui.permission.question.submit')}
            {' '}
            <kbd className={cn('tm:font-mono')} style={{ fontSize: 8, opacity: 0.6 }}>&#8984;Y</kbd>
          </button>
        )}
      </div>
    </>
  );
}
