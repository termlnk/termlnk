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

import type { KeyboardEvent } from 'react';
import { cn } from '@termlnk/design';
import { ChevronRight, Folder } from 'lucide-react';

export interface IInlineGroupInputProps {
  level: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function InlineGroupInput({ level, onConfirm, onCancel }: IInlineGroupInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = e.currentTarget.value.trim();
      if (value) {
        onConfirm(value);
      } else {
        onCancel();
      }
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className={cn(`
        tm:relative tm:box-border tm:flex tm:h-[22px] tm:w-full tm:flex-row tm:items-center tm:leading-[22px]
      `)}
      style={{ paddingLeft: `${level * 15}px` }}
    >
      <div className="tm:mr-1.5 tm:flex tm:h-full tm:items-center">
        <ChevronRight
          strokeWidth={1}
          className="tm:mr-0.5 tm:h-[16px] tm:w-[16px]"
        />
        <Folder strokeWidth={1} className="tm:h-[14px] tm:w-[14px]" />
      </div>
      <input
        ref={(el) => el?.focus()}
        className={cn(`
          tm:h-[18px] tm:min-w-0 tm:flex-1 tm:rounded-xs tm:border tm:border-blue tm:bg-one-bg2 tm:px-1 tm:text-[13px]
          tm:outline-hidden
        `)}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
      />
    </div>
  );
}
