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
import { IContextService } from '@termlnk/core';
import { useDependency } from '@termlnk/design';
import { useCallback, useEffect, useState } from 'react';
import { TERMINAL_FOCUSED_CONTEXT } from '../../common/context-keys';
import { ITerminalSearchService } from '../../services/terminal/terminal-search.service';

type SearchDirection = 'next' | 'previous';

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

/**
 * Per-session terminal search state. ⌘F is owned by IShortcutService
 * (ToggleTerminalSearchCommand); this hook only reacts to toggle$ when the
 * session is active, and maintains the terminal-focused context key.
 */
export function useTerminalSearch(options: IUseTerminalSearchOptions): IUseTerminalSearchResult {
  const { sessionId, scopeRef, terminalUIService, focus, findNext, findPrevious, clearSearchDecorations } = options;
  const searchService = useDependency(ITerminalSearchService);
  const contextService = useDependency(IContextService);

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
    if (!isSessionActive) {
      return;
    }

    if (isSearchOpen) {
      closeSearch();
      return;
    }

    setIsSearchOpen(true);
  }, [isSearchOpen, isSessionActive, closeSearch]);

  const handleSearch = useCallback((text: string, direction: SearchDirection, searchOptions?: ISearchOptions): boolean => {
    if (direction === 'next') {
      return findNext(text, searchOptions);
    }
    return findPrevious(text, searchOptions);
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

  // Shortcut service → this session (only the active one reacts).
  useEffect(() => {
    const sub = searchService.toggle$.subscribe(() => {
      if (terminalUIService.getActiveSessionId() === sessionId) {
        toggleSearch();
      }
    });
    return () => sub.unsubscribe();
  }, [searchService, sessionId, terminalUIService, toggleSearch]);

  // Focus context for ⌘F preconditions / multi-candidate dispatch.
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) {
      return;
    }

    const onFocusIn = (): void => {
      if (isSessionActive) {
        contextService.setContextValue(TERMINAL_FOCUSED_CONTEXT, true);
      }
    };
    const onFocusOut = (e: FocusEvent): void => {
      if (scope.contains(e.relatedTarget as Node)) {
        return;
      }
      // Only clear if this session still owns the context (another terminal may have taken it).
      if (terminalUIService.getActiveSessionId() === sessionId) {
        contextService.setContextValue(TERMINAL_FOCUSED_CONTEXT, false);
      }
    };

    scope.addEventListener('focusin', onFocusIn);
    scope.addEventListener('focusout', onFocusOut);
    return () => {
      scope.removeEventListener('focusin', onFocusIn);
      scope.removeEventListener('focusout', onFocusOut);
      if (terminalUIService.getActiveSessionId() === sessionId) {
        contextService.setContextValue(TERMINAL_FOCUSED_CONTEXT, false);
      }
    };
  }, [scopeRef, isSessionActive, contextService, sessionId, terminalUIService]);

  return {
    isSearchOpen,
    isSessionActive,
    handleSearch,
    closeSearch,
  };
}
