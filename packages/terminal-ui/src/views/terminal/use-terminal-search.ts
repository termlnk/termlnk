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

import type { ISearchOptions } from '@xterm/addon-search';
import type { RefObject } from 'react';
import type { ITerminalUIService } from '../../services/terminal/terminal-ui.service';
import { useCallback, useEffect, useState } from 'react';

type SearchDirection = 'next' | 'previous';

function isSearchShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey)
    && !event.altKey
    && !event.shiftKey
    && event.key.toLowerCase() === 'f';
}

function isScopedEvent(event: KeyboardEvent, scopeRef: RefObject<HTMLElement | null>): boolean {
  const scope = scopeRef.current;
  const target = event.target;
  if (!scope || !(target instanceof HTMLElement)) {
    return false;
  }

  if (target === document.body || target === document.documentElement) {
    return true;
  }

  return scope.contains(target);
}

export interface IUseTerminalSearchOptions {
  sessionId: string;
  scopeRef: RefObject<HTMLElement | null>;
  terminalUIService: ITerminalUIService;
  focus: () => void;
  findNext: (text: string, options?: ISearchOptions) => boolean;
  findPrevious: (text: string, options?: ISearchOptions) => boolean;
  clearSearchDecorations: () => void;
}

export interface IUseTerminalSearchResult {
  isSearchOpen: boolean;
  isSessionActive: boolean;
  handleSearch: (text: string, direction: SearchDirection, options?: ISearchOptions) => boolean;
  closeSearch: () => void;
}

export function useTerminalSearch(options: IUseTerminalSearchOptions): IUseTerminalSearchResult {
  const { sessionId, scopeRef, terminalUIService, focus, findNext, findPrevious, clearSearchDecorations } = options;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const clearSearch = useCallback((): void => {
    setIsSearchOpen(false);
    clearSearchDecorations();
  }, [clearSearchDecorations]);

  const closeSearch = useCallback((): void => {
    clearSearch();
    focus();
  }, [clearSearch, focus]);

  const toggleSearch = useCallback((): void => {
    if (!isSessionActive) return;

    if (isSearchOpen) {
      closeSearch();
      return;
    }

    setIsSearchOpen(true);
  }, [isSearchOpen, isSessionActive, closeSearch]);

  const handleSearch = useCallback((text: string, direction: SearchDirection, options?: ISearchOptions): boolean => {
    if (direction === 'next') {
      return findNext(text, options);
    }
    return findPrevious(text, options);
  }, [findNext, findPrevious]);

  useEffect(() => {
    const sub = terminalUIService.activeSessionId$.subscribe((activeId) => {
      const active = activeId === sessionId;
      setIsSessionActive(active);

      if (active) {
        requestAnimationFrame(() => focus());
        return;
      }

      clearSearch();
    });

    return () => sub.unsubscribe();
  }, [sessionId, terminalUIService, focus, clearSearch]);

  useEffect(() => {
    if (!isSessionActive) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isSearchShortcut(event)) return;
      if (!isScopedEvent(event, scopeRef)) return;

      event.preventDefault();
      toggleSearch();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isSessionActive, scopeRef, toggleSearch]);

  return {
    isSearchOpen,
    isSessionActive,
    handleSearch,
    closeSearch,
  };
}
