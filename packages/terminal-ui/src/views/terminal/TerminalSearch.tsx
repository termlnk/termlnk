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

import type { ISearchDecorationOptions, ISearchOptions } from '@xterm/addon-search';
import type { ITerminalOptions } from '@xterm/xterm';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Button, cn, InputGroup, InputGroupAddon, InputGroupInput, Toggle } from '@termlnk/design';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Search decoration colors based on Base46/base16 terminal accent colors.
 */
export function buildSearchDecorations(theme?: ITerminalOptions['theme']): ISearchDecorationOptions {
  const match = normalizeHex(theme?.yellow)
    || normalizeHex(theme?.brightYellow)
    || '#d7ba7d';
  const active = normalizeHex(theme?.blue)
    || normalizeHex(theme?.brightBlue)
    || '#569cd6';
  const activeBorder = normalizeHex(theme?.cyan)
    || normalizeHex(theme?.brightCyan)
    || '#4ec9b0';

  return {
    matchBackground: match,
    matchBorder: match,
    matchOverviewRuler: match,
    activeMatchBackground: active,
    activeMatchBorder: activeBorder,
    activeMatchColorOverviewRuler: active,
  };
}

function normalizeHex(color?: string): string | null {
  if (!color) return null;
  const value = color.trim();
  return /^#[\da-fA-F]{6}$/.test(value) ? value : null;
}

export interface ITerminalSearchProps {
  isOpen: boolean;
  isActive?: boolean;
  resultCount: number;
  theme?: ITerminalOptions['theme'];
  onClose: () => void;
  onSearch: (text: string, direction: 'next' | 'previous', options?: ISearchOptions) => boolean;
  onClearSearch: () => void;
}

type SearchState = 'idle' | 'found' | 'not-found';
const AUTO_SEARCH_DELAY_MS = 80;

export function TerminalSearch({ isOpen, isActive = true, resultCount, theme, onClose, onSearch, onClearSearch }: ITerminalSearchProps) {
  const [searchText, setSearchText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const panelRef = useRef<HTMLDivElement>(null);
  const hasQuery = searchText.trim().length > 0;

  // Focus input when opened
  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      const input = panelRef.current?.querySelector<HTMLInputElement>('input[data-slot="input-group-control"]');
      input?.focus();
      input?.select();
    }, 40);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const buildSearchOptions = useCallback((): ISearchOptions => ({
    caseSensitive,
    wholeWord,
    regex,
    decorations: buildSearchDecorations(theme),
  }), [caseSensitive, wholeWord, regex, theme]);

  const handleSearch = useCallback((direction: 'next' | 'previous', queryOverride?: string) => {
    const query = (queryOverride ?? searchText).trim();
    if (!query.length) {
      setSearchState('idle');
      return false;
    }

    const found = onSearch(query, direction, buildSearchOptions());
    setSearchState(found ? 'found' : 'not-found');
    return found;
  }, [searchText, onSearch, buildSearchOptions]);

  // Live search while typing, aligned with VSCode behavior.
  useEffect(() => {
    if (!isOpen) return;

    const query = searchText.trim();
    if (!query.length) {
      setSearchState('idle');
      onClearSearch();
      return;
    }

    const timer = window.setTimeout(() => {
      handleSearch('next', query);
    }, AUTO_SEARCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isOpen, searchText, handleSearch, onClearSearch]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  }, []);

  const handleClose = useCallback(() => {
    onClearSearch();
    setSearchText('');
    setSearchState('idle');
    onClose();
  }, [onClearSearch, onClose]);

  // Close on Escape even if focus leaves the input while search is open.
  useEffect(() => {
    if (!isOpen || !isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      handleClose();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, isActive, handleClose]);

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
      return;
    }

    if (e.key !== 'Enter') return;

    e.preventDefault();
    handleSearch(e.shiftKey ? 'previous' : 'next');
  }, [handleSearch, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        'tm:absolute tm:top-3 tm:right-3 tm:z-50 tm:w-90 tm:max-w-[calc(100vw-0.75rem)]',
        'tm:animate-in tm:duration-100 tm:fade-in tm:slide-in-from-top-1',
        `
          tm:flex tm:items-center tm:gap-1 tm:rounded-md tm:border tm:border-line tm:bg-black/85 tm:p-1
          tm:backdrop-blur-sm
        `,
        'tm:shadow-[0_8px_16px_rgba(0,0,0,0.28)]'
      )}
    >
      <InputGroup className="tm:h-8 tm:flex-1 tm:rounded-md tm:border-one-bg3 tm:bg-one-bg2/70">
        <InputGroupInput
          type="text"
          value={searchText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="查找"
          aria-invalid={searchState === 'not-found'}
          className="
            tm:h-full tm:text-[0.92rem] tm:text-light-grey
            tm:placeholder:text-grey-fg
          "
        />
        <InputGroupAddon align="inline-end" className="tm:gap-0 tm:py-0 tm:pr-0.5 tm:pl-0">
          <div className="tm:flex tm:items-center tm:gap-px">
            <SearchOption
              label="Aa"
              checked={caseSensitive}
              onChange={setCaseSensitive}
              title="Match case"
            />
            <SearchOption
              label="ab"
              checked={wholeWord}
              onChange={setWholeWord}
              title="Whole word"
            />
            <SearchOption
              label=".*"
              checked={regex}
              onChange={setRegex}
              title="Use regular expression"
            />
          </div>
        </InputGroupAddon>
      </InputGroup>

      <div
        className={cn(
          'tm:flex tm:h-6 tm:min-w-6 tm:items-center tm:justify-center tm:text-xs tm:leading-none tm:tabular-nums',
          !hasQuery && 'tm:text-grey-fg',
          hasQuery && resultCount === 0 && 'tm:text-red',
          hasQuery && resultCount > 0 && 'tm:text-light-grey'
        )}
      >
        {hasQuery ? resultCount : ''}
      </div>

      <SearchButton
        direction="previous"
        disabled={!hasQuery}
        onClick={() => handleSearch('previous')}
        title="Previous match (Shift+Enter)"
      />
      <SearchButton
        direction="next"
        disabled={!hasQuery}
        onClick={() => handleSearch('next')}
        title="Next match (Enter)"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleClose}
        title="Close (Escape)"
        className={cn(
          'tm:size-6 tm:rounded-xs tm:text-grey-fg',
          'tm:hover:bg-one-bg2 tm:hover:text-light-grey'
        )}
      >
        <X className="tm:size-3.5" />
      </Button>
    </div>
  );
}

interface ISearchButtonProps {
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
  title: string;
}

function SearchButton({ direction, disabled, onClick, title }: ISearchButtonProps) {
  const Icon = direction === 'previous' ? ChevronUp : ChevronDown;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'tm:size-6 tm:rounded-xs tm:text-grey-fg',
        'tm:hover:bg-one-bg2 tm:hover:text-light-grey',
        'tm:disabled:opacity-40'
      )}
    >
      <Icon className="tm:size-3.5" />
    </Button>
  );
}

interface ISearchOptionProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
}

function SearchOption({ label, checked, onChange, title }: ISearchOptionProps) {
  return (
    <Toggle
      pressed={checked}
      onPressedChange={onChange}
      size="sm"
      aria-label={title}
      title={title}
      className={cn(
        `
          tm:h-6 tm:min-w-5 tm:rounded-md tm:border tm:border-transparent tm:px-0.5 tm:text-[10px] tm:font-medium
          tm:text-grey-fg2
        `,
        'tm:hover:bg-one-bg3/70 tm:hover:text-light-grey',
        'tm:data-[state=on]:border-blue tm:data-[state=on]:bg-one-bg3/80 tm:data-[state=on]:text-light-grey',
        'tm:data-[state=on]:underline tm:data-[state=on]:underline-offset-2'
      )}
    >
      {label}
    </Toggle>
  );
}
