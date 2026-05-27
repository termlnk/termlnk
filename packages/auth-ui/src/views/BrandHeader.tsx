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

export interface IBrandHeaderProps {
  readonly title: string;
  readonly subtitle: string;
}

// Gradient-stroked rounded square with the Termlnk `>_` prompt glyph.
// The glyph uses currentColor so it follows the theme foreground; the border
// keeps the brand gradient regardless of light/dark theme.
function TermlnkMark() {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="Termlnk"
      className={cn('tm:size-11 tm:text-white')}
    >
      <defs>
        <linearGradient id="auth-ui-brand-border" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF6B9D" />
          <stop offset="35%" stopColor="#C084FC" />
          <stop offset="65%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect
        x="2.5"
        y="2.5"
        width="35"
        height="35"
        rx="11"
        fill="none"
        stroke="url(#auth-ui-brand-border)"
        strokeWidth="2.5"
      />
      <polyline
        points="13,15 19,20 13,25"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="21.5"
        y1="25.5"
        x2="28"
        y2="25.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandHeader(props: IBrandHeaderProps) {
  return (
    <div className={cn('tm:flex tm:flex-col tm:items-center tm:gap-3 tm:py-1 tm:text-center')}>
      <TermlnkMark />
      <div className={cn('tm:flex tm:flex-col tm:gap-1.5')}>
        <h2 className={cn('tm:text-lg tm:font-semibold tm:text-white')}>
          {props.title}
        </h2>
        <p className={cn('tm:text-sm tm:text-grey-fg')}>
          {props.subtitle}
        </p>
      </div>
    </div>
  );
}
