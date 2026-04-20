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

interface IOptionCardProps {
  index: number;
  label: string;
  onSelect: () => void;
}

export function OptionCard({ index, label, onSelect }: IOptionCardProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn('tm:flex tm:w-full tm:cursor-pointer tm:items-center tm:gap-2 tm:border-none tm:text-left')}
      style={{
        padding: '5px 10px',
        borderRadius: 6,
        background: 'rgba(6,182,212,0.15)',
        fontSize: 10,
        color: 'rgba(255,255,255,0.9)',
        fontFamily: 'inherit',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6,182,212,0.25)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(6,182,212,0.15)'; }}
    >
      <span
        className={cn('tm:flex tm:shrink-0 tm:items-center tm:justify-center tm:font-mono')}
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          background: 'rgba(6,182,212,0.6)',
          width: 18,
          height: 18,
          borderRadius: 4,
        }}
      >
        {index + 1}
      </span>
      {label}
    </button>
  );
}
