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

import type { ITheme } from '@termlnk/themes';
import { cn } from '@termlnk/design';

export interface IThemeCardProps {
  theme: ITheme;
  isSelected?: boolean;
  onClick?: () => void;
}

function formatThemeName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function ThemeCard(props: IThemeCardProps) {
  const {
    theme,
    isSelected,
    onClick,
  } = props;
  const { base_30 } = theme;
  const colors = [
    base_30.black,
    base_30.blue,
    base_30.green,
    base_30.red,
    base_30.purple,
    base_30.one_bg3,
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        `
          tm:group
          tm:relative tm:flex tm:h-[68px] tm:w-full tm:flex-col tm:items-start tm:justify-between tm:rounded-xl
          tm:border tm:p-2.5 tm:text-left tm:transition-all tm:duration-200
          tm:focus-visible:ring-2 tm:focus-visible:ring-blue/40 tm:focus-visible:outline-none
        `,
        isSelected
          ? 'tm:border-blue tm:bg-black tm:shadow-xs tm:ring-1 tm:ring-blue/35'
          : `
            tm:border-line tm:bg-black
            tm:hover:border-blue/45 tm:hover:bg-black
          `
      )}
    >
      {isSelected && (
        <span
          className={`
            tm:absolute tm:top-2 tm:right-2 tm:flex tm:size-4 tm:items-center tm:justify-center tm:rounded-full
            tm:bg-blue tm:text-white
          `}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="tm:size-2.5 tm:text-white"
            aria-hidden="true"
          >
            <path
              d="M3.5 8.5L6.5 11.5L12.5 4.5"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      <div className="tm:flex tm:items-center tm:gap-1.5">
        {colors.map((color, index) => (
          <span
            key={`${theme.name}-${index}`}
            className="tm:size-3.5 tm:shrink-0 tm:rounded-full tm:border tm:border-line"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <span className="tm:block tm:w-full tm:truncate tm:text-xs tm:font-medium tm:text-white">
        {formatThemeName(theme.name)}
      </span>
    </button>
  );
}
