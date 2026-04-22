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

import type { IAskUserQuestionOption } from '@termlnk/island';
import { cn } from '@termlnk/design';

interface IQuestionOptionProps {
  readonly index: number;
  readonly option: IAskUserQuestionOption;
  readonly selected: boolean;
  readonly focused: boolean;
  readonly multiSelect: boolean;
  readonly onToggle: () => void;
  readonly onFocus: () => void;
}

/**
 * A single option row inside a picker question. Renders:
 *
 * - A radio-like bullet (single-select) or checkbox (multi-select)
 *   indicator that reflects `selected`.
 * - The option label + optional description (inline, muted).
 * - A collapsible preview pane when the option has `preview` and is
 *   currently focused. Follows the Claude Code CLI behaviour where
 *   hover/focus reveals the richer preview beside the pick list —
 *   adapted to vertical stacking so it fits the island's narrow layout.
 * - A leading numeric chip (index+1) for ⌘1-9 quick selection.
 */
export function QuestionOption({
  index,
  option,
  selected,
  focused,
  multiSelect,
  onToggle,
  onFocus,
}: IQuestionOptionProps) {
  const hasPreview = focused && typeof option.preview === 'string' && option.preview.length > 0;
  return (
    <div className={cn('tm:flex tm:w-full tm:flex-col tm:gap-1')}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFocus();
          onToggle();
        }}
        onMouseEnter={onFocus}
        className={cn('tm:flex tm:w-full tm:cursor-pointer tm:items-start tm:gap-2 tm:border-none tm:text-left')}
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          background: focused
            ? 'rgba(6,182,212,0.25)'
            : selected
              ? 'rgba(6,182,212,0.18)'
              : 'rgba(255,255,255,0.06)',
          outline: focused ? '1px solid rgba(6,182,212,0.6)' : 'none',
          outlineOffset: -1,
          fontSize: 10,
          color: 'rgba(255,255,255,0.92)',
          fontFamily: 'inherit',
          transition: 'background 0.12s',
        }}
      >
        <span
          className={cn('tm:flex tm:shrink-0 tm:items-center tm:justify-center tm:font-mono')}
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#fff',
            background: 'rgba(6,182,212,0.55)',
            width: 16,
            height: 16,
            borderRadius: 4,
          }}
        >
          {index + 1}
        </span>
        <span
          className={cn('tm:mt-0.5 tm:flex tm:shrink-0 tm:items-center tm:justify-center')}
          style={{
            width: 12,
            height: 12,
            borderRadius: multiSelect ? 2 : '50%',
            border: `1.25px solid ${selected ? 'rgba(6,182,212,1)' : 'rgba(255,255,255,0.4)'}`,
            background: selected ? 'rgba(6,182,212,0.9)' : 'transparent',
          }}
        >
          {selected && (
            multiSelect
              ? (
                <svg width={8} height={8} viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )
              : <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
          )}
        </span>
        <span className={cn('tm:flex tm:flex-1 tm:flex-col tm:gap-0.5')}>
          <span style={{ fontWeight: 500 }}>{option.label}</span>
          {option.description && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.35 }}>
              {option.description}
            </span>
          )}
        </span>
      </button>
      {hasPreview && (
        <div
          className={cn('tm:overflow-auto tm:rounded-sm tm:font-mono')}
          style={{
            marginLeft: 32,
            padding: '4px 6px',
            maxHeight: 100,
            fontSize: 9,
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.65)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {option.preview}
        </div>
      )}
    </div>
  );
}
