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

import type { IEmojiGridEntry } from './emoji-data';
import { LocaleService } from '@termlnk/core';
import { Button, cn, Input, useDependency } from '@termlnk/design';
import { useEffect, useRef, useState } from 'react';
import { ALL_EMOJIS, searchEmojis } from './emoji-data';

/** An emoji glyph plus the badge background color behind it. */
export interface IIconPickerValue {
  /** Emoji character. */
  emoji: string;
  /** Badge background color (hex). */
  background: string;
}

/**
 * Badge backgrounds offered by default (Dify-style pastel palette). These hex values
 * are user-picked data, not theme colors: a chosen badge color must stay stable across
 * theme switches, so the Base46 no-hardcoded-color rule is deliberately not applied.
 */
export const ICON_PICKER_BACKGROUNDS: readonly string[] = [
  '#FFE9A8',
  '#C7F0BD',
  '#B8EACC',
  '#BDE3FF',
  '#C9D6FF',
  '#DCCBFF',
  '#F3C6F1',
  '#FFC9DE',
  '#FFD6C2',
  '#E4E7EC',
];

export interface IIconPickerProps {
  /** Current value; drives the selected highlight and live recoloring. */
  value?: IIconPickerValue;
  /** Override the background swatch palette. */
  backgrounds?: readonly string[];
  /** Fired when an emoji is picked. */
  onSelect(value: IIconPickerValue): void;
  /** Fired when the background changes while a value already exists. */
  onBackgroundChange(value: IIconPickerValue): void;
  /** Fired to clear the current value back to the consumer's default. */
  onReset(): void;
}

/**
 * Controlled, service-free icon editor (Dify-style): emoji search + grid, background
 * swatches, reset. The consumer owns the value and decides what each event means
 * (e.g. close a popover on select, recolor in place on background change).
 */
export function IconPicker(props: IIconPickerProps) {
  const { value, backgrounds = ICON_PICKER_BACKGROUNDS, onSelect, onBackgroundChange, onReset } = props;
  const localeService = useDependency(LocaleService);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly IEmojiGridEntry[] | null>(null);
  const [background, setBackground] = useState<string>(value?.background ?? backgrounds[0]);
  // Guards the async search against out-of-order resolves for stale queries.
  const searchSeqRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const seq = ++searchSeqRef.current;
    let cancelled = false;
    void searchEmojis(trimmed).then((entries) => {
      if (cancelled || seq !== searchSeqRef.current) {
        return;
      }
      setResults(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const handleSelectEmoji = (emoji: string) => {
    onSelect({ emoji, background });
  };

  const handleSelectBackground = (color: string) => {
    setBackground(color);
    // Recolor in place once a value exists; otherwise the color applies to the next pick.
    if (value) {
      onBackgroundChange({ ...value, background: color });
    }
  };

  const displayed = query.trim() ? (results ?? []) : ALL_EMOJIS;

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-2')}>
      <Input
        value={query}
        placeholder={localeService.t('ui.icon-picker.search-placeholder')}
        className={cn('tm:h-8')}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div
        className={cn('tm:grid tm:h-[220px] tm:grid-cols-8 tm:content-start tm:gap-0.5 tm:overflow-y-auto')}
      >
        {displayed.map((entry) => (
          <button
            key={entry.id}
            type="button"
            title={entry.id}
            className={cn(
              `
                tm:flex tm:size-8 tm:items-center tm:justify-center tm:rounded-md tm:text-[18px]
                tm:hover:bg-one-bg2
              `,
              { 'tm:ring-1 tm:ring-blue': value?.emoji === entry.native }
            )}
            onClick={() => handleSelectEmoji(entry.native)}
          >
            {entry.native}
          </button>
        ))}
        {displayed.length === 0 && (
          <div className={cn('tm:col-span-8 tm:py-8 tm:text-center tm:text-xs tm:text-grey-fg')}>
            {localeService.t('ui.icon-picker.no-results')}
          </div>
        )}
      </div>

      <div className={cn('tm:flex tm:flex-col tm:gap-1.5')}>
        <span className={cn('tm:text-xs tm:text-grey-fg')}>
          {localeService.t('ui.icon-picker.style')}
        </span>
        <div className={cn('tm:flex tm:flex-wrap tm:items-center tm:gap-1.5')}>
          {backgrounds.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              className={cn(
                `
                  tm:size-5 tm:rounded-full tm:transition-transform
                  tm:hover:scale-110
                `,
                { 'tm:ring-2 tm:ring-blue tm:ring-offset-1 tm:ring-offset-one-bg': background === color }
              )}
              style={{ backgroundColor: color }}
              onClick={() => handleSelectBackground(color)}
            />
          ))}
        </div>
      </div>

      <div className={cn('tm:flex tm:justify-end')}>
        <Button variant="ghost" size="sm" onClick={onReset}>
          {localeService.t('ui.icon-picker.reset-default')}
        </Button>
      </div>
    </div>
  );
}
