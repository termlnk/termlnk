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

import { cn } from '@termlnk/design';

interface IQuestionBreadcrumbProps {
  readonly total: number;
  readonly currentIdx: number;
  /**
   * Bitmap of questions that already carry a user-visible answer. Used
   * to paint the "answered" fill instead of the "unanswered" outline.
   */
  readonly answeredMask: readonly boolean[];
  /** Tooltip text for each dot (header or truncated question). */
  readonly headers: readonly (string | undefined)[];
  /**
   * Called when the user clicks a dot. Only fires for dots with
   * `index <= currentIdx` — forward jumps are gated through the Next
   * button so the user is forced to see each question at least once.
   */
  readonly onJump: (index: number) => void;
}

/**
 * Multi-question progress row rendered inside the question card header.
 *
 * ```
 * ■ ■ □ □  2/4
 * ```
 *
 * Each cell is a small rounded tile — filled nord-blue for answered,
 * nord-blue with a ring for the current question, and `one-bg3` for
 * unanswered. Clicks are only honoured for answered-or-earlier dots so
 * the user must at least view each new question once.
 */
export function QuestionBreadcrumb({ total, currentIdx, answeredMask, headers, onJump }: IQuestionBreadcrumbProps) {
  return (
    <div
      className={cn('tm:flex tm:items-center tm:gap-1')}
      role="tablist"
      aria-label="Question progress"
    >
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i === currentIdx;
        const isAnswered = answeredMask[i] === true;
        const isClickable = i <= currentIdx || isAnswered;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            aria-label={headers[i] ?? `Question ${i + 1}`}
            title={headers[i] ?? `Question ${i + 1}`}
            disabled={!isClickable}
            onClick={(e) => {
              e.stopPropagation();
              if (isClickable) {
                onJump(i);
              }
            }}
            className={cn(
              'tm:h-2 tm:w-3 tm:rounded-sm tm:border-none tm:transition-colors',
              {
                'tm:cursor-pointer': isClickable,
                'tm:cursor-not-allowed': !isClickable,
              }
            )}
            style={{
              background: isCurrent || isAnswered
                ? 'var(--color-question, #06b6d4)'
                : 'rgba(255,255,255,0.15)',
              opacity: isCurrent ? 1 : isAnswered ? 0.75 : 0.4,
              outline: isCurrent ? '1.5px solid rgba(6,182,212,0.6)' : 'none',
              outlineOffset: 1,
            }}
          />
        );
      })}
    </div>
  );
}
