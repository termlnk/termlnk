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

import type { IAskUserQuestion } from '@termlnk/island';
import { cn } from '@termlnk/design';
import { OptionCard } from './OptionCard';

interface IAskUserQuestionContentProps {
  readonly question: IAskUserQuestion;
  readonly onSelectOption: (label: string) => void;
}

/**
 * Renders the question prompt and picker options. Pure — the service
 * upstream owns parsing and dispatch; this component only renders and
 * forwards the selected label.
 */
export function AskUserQuestionContent({ question, onSelectOption }: IAskUserQuestionContentProps) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
        {question.question}
      </div>

      <div className={cn('tm:flex tm:flex-col tm:gap-0.5')}>
        {question.options.map((option, i) => (
          <OptionCard
            key={i}
            index={i}
            label={option.label}
            onSelect={() => onSelectOption(option.label)}
          />
        ))}
      </div>
    </>
  );
}
