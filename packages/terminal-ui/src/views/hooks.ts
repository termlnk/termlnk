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

import type { IDisposable } from '@termlnk/core';
import type { CursorStyle, ITerminalAppearanceConfig, IWindowTransparencyConfig, TerminalRendererEngine } from '@termlnk/terminal';
import type { ISearchOptions, ISearchResultChangeEvent } from '@xterm/addon-search';
import type { ITerminalOptions, IWindowsPty } from '@xterm/xterm';
import type { RefObject } from 'react';
import type { Subscription } from 'rxjs';
import type { ITerminalInputService } from '../services/terminal-input/terminal-input.service';
import { isMacintosh } from '@termlnk/core';
import { useDependency } from '@termlnk/design';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { DEFAULT_CTRL_OR_META_OPEN_TERMINAL_LINK, DEFAULT_CURSOR_BLINK, DEFAULT_CURSOR_STYLE, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_LETTER_SPACING, DEFAULT_TERMINAL_RENDERER_ENGINE, DEFAULT_TERMINAL_WORD_SEPARATOR, DEFAULT_WINDOW_TRANSPARENCY_OPACITY, TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/terminal';
import { fromFontFaceSetEvent } from '@termlnk/ui';
import { FitAddon } from '@xterm/addon-fit';
import { ImageAddon } from '@xterm/addon-image';
import { ProgressAddon } from '@xterm/addon-progress';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { UnicodeGraphemesAddon } from '@xterm/addon-unicode-graphemes';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAsciiPunctuationKey, isShiftEnterKey } from '../services/terminal-input/key-utils';

const SCROLLBACK_SIZE = 10000;
const RESIZE_DEBOUNCE_MS = 100;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_SEARCH_RESULT: ISearchResultChangeEvent = { resultIndex: -1, resultCount: 0 };

const IMAGE_OPTIONS = {
  enableSizeReports: true,
  pixelLimit: 16777216,
  sixelSupport: true,
  iipSupport: true,
  storageLimit: 128,
  showPlaceholder: true,
};

export interface ISerializeResult {
  serializedBuffer: string;
  cols: number;
  rows: number;
  cwd?: string;
}

export interface ISubscriptionManager {
  setSub: (key: string, sub: Subscription | null) => void;
  unsubscribeAll: () => void;
}

export function useSubscriptionManager(): ISubscriptionManager {
  const subsRef = useRef<Map<string, Subscription>>(new Map());

  const setSub = useCallback((key: string, sub: Subscription | null) => {
    subsRef.current.get(key)?.unsubscribe();
    if (sub) {
      subsRef.current.set(key, sub);
    } else {
      subsRef.current.delete(key);
    }
  }, []);

  const unsubscribeAll = useCallback(() => {
    subsRef.current.forEach((sub) => sub.unsubscribe());
    subsRef.current.clear();
  }, []);

  useEffect(() => () => unsubscribeAll(), [unsubscribeAll]);

  return useMemo(() => ({ setSub, unsubscribeAll }), [setSub, unsubscribeAll]);
}

export interface IUseXtermOptions {
  enabled?: boolean;
  /**
   * Whether xterm should auto-fit to its DOM container via FitAddon and a
   * ResizeObserver. Defaults to true. Set false on joiner-side views whose
   * geometry is authoritative from the owner PTY — those views call
   * `term.resize` directly from inbound resize SessionEvents and must NOT
   * let the local container size override that.
   */
  autoFit?: boolean;
  onData: (data: string) => void;
  onResize: (rows: number, cols: number) => void;
  onTitleChange?: (title: string) => void;
  shouldFocusOnOpen?: boolean;
  theme?: ITerminalOptions['theme'];
  fontFamily?: string;
  fontSize?: number;
  letterSpacing?: number;
  cursorStyle?: CursorStyle;
  cursorBlink?: boolean;
  rendererEngine?: TerminalRendererEngine;
  allowTransparency?: boolean;
  ctrlOrMetaOpenTerminalLink?: boolean;
  windowsPty?: IWindowsPty;
  terminalInputService?: ITerminalInputService;
}

export const XTERM_PROGRESS_STATE = {
  NONE: 0,
  RUNNING: 1,
  ERROR: 2,
  INDETERMINATE: 3,
  PAUSED: 4,
} as const;

export interface IXtermProgressState {
  state: (typeof XTERM_PROGRESS_STATE)[keyof typeof XTERM_PROGRESS_STATE];
  value: number;
}

export interface IUseXtermResult {
  terminalRef: RefObject<HTMLDivElement | null>;
  xtermRef: RefObject<Terminal | null>;
  write: (data: string) => void;
  fit: () => void;
  clear: () => void;
  focus: () => void;
  getSize: () => { cols: number; rows: number };
  serialize: (scrollback?: number) => ISerializeResult | null;
  findNext: (text: string, options?: ISearchOptions) => boolean;
  findPrevious: (text: string, options?: ISearchOptions) => boolean;
  clearSearchDecorations: () => void;
  searchResult: ISearchResultChangeEvent;
  progressState: IXtermProgressState;
}

const DEFAULT_PROGRESS_STATE: IXtermProgressState = { state: XTERM_PROGRESS_STATE.NONE, value: 0 };

export function useXterm(options: IUseXtermOptions): IUseXtermResult {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const onDataRef = useRef(options.onData);
  const onResizeRef = useRef(options.onResize);
  const onTitleChangeRef = useRef(options.onTitleChange);
  const rendererEngineRef = useRef(options.rendererEngine);
  const ctrlOrMetaOpenTerminalLinkRef = useRef(options.ctrlOrMetaOpenTerminalLink);
  const [searchResult, setSearchResult] = useState<ISearchResultChangeEvent>(DEFAULT_SEARCH_RESULT);
  const [progressState, setProgressState] = useState<IXtermProgressState>(DEFAULT_PROGRESS_STATE);

  useEffect(() => {
    onDataRef.current = options.onData;
    onResizeRef.current = options.onResize;
    onTitleChangeRef.current = options.onTitleChange;
    ctrlOrMetaOpenTerminalLinkRef.current = options.ctrlOrMetaOpenTerminalLink;
  }, [options.onData, options.onResize, options.onTitleChange, options.ctrlOrMetaOpenTerminalLink]);

  useEffect(() => {
    if (options.enabled === false) return;
    if (!terminalRef.current) return;

    const rendererEngine = rendererEngineRef.current ?? DEFAULT_TERMINAL_RENDERER_ENGINE;
    const term = new Terminal({
      fontFamily: options.fontFamily || DEFAULT_FONT_FAMILY,
      fontSize: options.fontSize || DEFAULT_FONT_SIZE,
      letterSpacing: options.letterSpacing ?? DEFAULT_LETTER_SPACING,
      lineHeight: 1.0,
      minimumContrastRatio: 4.5,
      cursorBlink: options.cursorBlink ?? DEFAULT_CURSOR_BLINK,
      cursorStyle: options.cursorStyle ?? DEFAULT_CURSOR_STYLE,
      cursorWidth: 2,
      scrollback: SCROLLBACK_SIZE,
      wordSeparator: DEFAULT_TERMINAL_WORD_SEPARATOR,
      scrollbar: {
        showScrollbar: true,
        showArrows: false,
        width: 8,
        overviewRuler: {
          showTopBorder: false,
          showBottomBorder: false,
        },
      },
      allowProposedApi: true,
      allowTransparency: options.allowTransparency ?? false,
      theme: options.theme,
      windowsPty: options.windowsPty,
      macOptionIsMeta: false,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const serializeAddon = new SerializeAddon();
    const progressAddon = new ProgressAddon();
    const searchResultDisposable = searchAddon.onDidChangeResults((result) => {
      setSearchResult(result);
    });

    const autoFit = options.autoFit !== false;
    if (autoFit) {
      term.loadAddon(fitAddon);
    }
    term.loadAddon(searchAddon);
    term.loadAddon(new ImageAddon(IMAGE_OPTIONS));
    term.loadAddon(progressAddon);
    term.loadAddon(new WebLinksAddon((event, uri) => {
      handleLinkClick(event, uri, ctrlOrMetaOpenTerminalLinkRef.current);
    }));
    term.loadAddon(serializeAddon);

    term.loadAddon(new UnicodeGraphemesAddon());
    term.unicode.activeVersion = '15-graphemes';

    // Subscribe after loadAddon — ProgressAddon.onChange is assigned during activate()
    const progressDisposable = progressAddon.onChange((progress) => {
      setProgressState({ state: progress.state, value: progress.value });
    });

    term.open(terminalRef.current);

    let webglAddon: WebglAddon | null = null;
    if (rendererEngine === 'webgl') {
      webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    }

    if (rendererEngine === 'webgl') {
      // @xterm/addon-ligatures requires Node.js APIs (diagnostics_channel via
      // lru-cache, font-finder via child_process). Dynamic import so the web
      // build degrades gracefully — ligatures are a nice-to-have.
      import('@xterm/addon-ligatures').then(({ LigaturesAddon }) => {
        term.loadAddon(new LigaturesAddon());
      }).catch(() => {});
    }

    if (autoFit) {
      fitAddon.fit();
    }

    setupEventListeners(term, onDataRef, onResizeRef, onTitleChangeRef);

    const inputBindingDisposable = options.terminalInputService
      ? options.terminalInputService.createTerminalBinding(term, (data) => onDataRef.current(data))
      : createLegacyTerminalInputBinding(term, onDataRef);

    xtermRef.current = term;
    if (autoFit) {
      fitAddonRef.current = fitAddon;
    }
    searchAddonRef.current = searchAddon;
    serializeAddonRef.current = serializeAddon;

    const disposeResizeObserver = autoFit
      ? setupResizeObserver(terminalRef.current, fitAddon)
      : () => {};

    // The initial fit() above measures cell height with whatever font is
    // available right now. The terminal font (JetBrains Mono) is a web font
    // loaded asynchronously, so a cold-start fit can run against a fallback
    // font whose smaller line height over-counts rows — once the real font
    // swaps in, the grid ends up taller than the container and its bottom
    // rows get clipped. Re-fit when fonts finish loading to recompute rows.
    let disposeFontsListener: IDisposable | null = null;
    if (autoFit) {
      disposeFontsListener = fromFontFaceSetEvent('loadingdone', () => {
        try {
          fitAddon.fit();
        } catch { }
      });
    }

    return () => {
      inputBindingDisposable.dispose();
      searchResultDisposable.dispose();
      progressDisposable.dispose();
      disposeResizeObserver();
      disposeFontsListener?.dispose();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      serializeAddonRef.current = null;
      searchAddonRef.current = null;
      setSearchResult(DEFAULT_SEARCH_RESULT);
      setProgressState(DEFAULT_PROGRESS_STATE);
    };
  }, [options.enabled]);

  useEffect(() => {
    if (options.enabled === false) return;
    if (!options.shouldFocusOnOpen) return;
    if (!xtermRef.current) return;

    const frameId = requestAnimationFrame(() => {
      xtermRef.current?.focus();
    });

    return () => cancelAnimationFrame(frameId);
  }, [options.enabled, options.shouldFocusOnOpen, options.rendererEngine]);

  useEffect(() => {
    if (xtermRef.current && options.theme) {
      xtermRef.current.options.theme = options.theme;
    }
  }, [options.theme]);

  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;

    let needsFit = false;
    const fontFamily = options.fontFamily || DEFAULT_FONT_FAMILY;
    const fontSize = options.fontSize || DEFAULT_FONT_SIZE;
    const letterSpacing = options.letterSpacing ?? DEFAULT_LETTER_SPACING;

    if (term.options.fontFamily !== fontFamily) {
      term.options.fontFamily = fontFamily;
      needsFit = true;
    }

    if (term.options.fontSize !== fontSize) {
      term.options.fontSize = fontSize;
      needsFit = true;
    }

    if (term.options.letterSpacing !== letterSpacing) {
      term.options.letterSpacing = letterSpacing;
      needsFit = true;
    }

    if (needsFit) {
      fitAddonRef.current?.fit();
    }
  }, [options.fontFamily, options.fontSize, options.letterSpacing]);

  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;

    const cursorStyle = options.cursorStyle ?? DEFAULT_CURSOR_STYLE;
    const cursorBlink = options.cursorBlink ?? DEFAULT_CURSOR_BLINK;

    if (term.options.cursorStyle !== cursorStyle) {
      term.options.cursorStyle = cursorStyle;
    }
    if (term.options.cursorBlink !== cursorBlink) {
      term.options.cursorBlink = cursorBlink;
    }
  }, [options.cursorStyle, options.cursorBlink]);

  const write = useCallback((data: string) => {
    xtermRef.current?.write(data);
  }, []);

  const fit = useCallback(() => {
    try {
      fitAddonRef.current?.fit();
    } catch { }
  }, []);

  const clear = useCallback(() => {
    xtermRef.current?.clear();
  }, []);

  const getSize = useCallback(() => {
    const term = xtermRef.current;
    return term
      ? { cols: term.cols, rows: term.rows }
      : { cols: DEFAULT_COLS, rows: DEFAULT_ROWS };
  }, []);

  const focus = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  const serialize = useCallback((scrollback: number = 100) => {
    const term = xtermRef.current;
    const addon = serializeAddonRef.current;
    if (!term || !addon) return null;
    return {
      serializedBuffer: addon.serialize({ scrollback }),
      cols: term.cols,
      rows: term.rows,
    };
  }, []);

  const findNext = useCallback((text: string, options?: ISearchOptions): boolean => {
    return searchAddonRef.current?.findNext(text, options) ?? false;
  }, []);

  const findPrevious = useCallback((text: string, options?: ISearchOptions): boolean => {
    return searchAddonRef.current?.findPrevious(text, options) ?? false;
  }, []);

  const clearSearchDecorations = useCallback(() => {
    searchAddonRef.current?.clearDecorations();
    setSearchResult(DEFAULT_SEARCH_RESULT);
  }, []);

  return {
    terminalRef,
    xtermRef,
    write,
    fit,
    clear,
    focus,
    getSize,
    serialize,
    findNext,
    findPrevious,
    clearSearchDecorations,
    searchResult,
    progressState,
  };
}

function handleLinkClick(event: MouseEvent, uri: string, ctrlOrMetaRequired?: boolean): void {
  if (ctrlOrMetaRequired) {
    const modifierHeld = isMacintosh ? event.metaKey : event.ctrlKey;
    if (!modifierHeld) return;
  }

  const nativeShell = (window as any).nativeShell;
  if (nativeShell?.openExternal) {
    nativeShell.openExternal(uri);
  } else {
    window.open(uri, '_blank');
  }
}

function setupEventListeners(
  term: Terminal,
  onDataRef: RefObject<(data: string) => void>,
  onResizeRef: RefObject<(rows: number, cols: number) => void>,
  onTitleChangeRef: RefObject<((title: string) => void) | undefined>
): void {
  term.onData((data) => onDataRef.current(data));
  term.onResize(({ rows, cols }) => onResizeRef.current(rows, cols));
  term.onTitleChange((title) => onTitleChangeRef.current?.(title));
}

function createLegacyTerminalInputBinding(
  term: Terminal,
  onDataRef: RefObject<(data: string) => void>
): { dispose(): void } {
  term.attachCustomKeyEventHandler((event: KeyboardEvent): boolean => {
    if (event.type !== 'keydown') return true;

    if (isShiftEnterKey(event) && !event.isComposing) {
      onDataRef.current('\n');
      event.preventDefault();
      return false;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return true;
    if (!isAsciiPunctuationKey(event.key)) return true;

    // Bypass xterm keydown translation for punctuation so browser/IME can emit
    // the actual character (e.g. full-width Chinese punctuation) downstream.
    return false;
  });

  return {
    dispose: () => undefined,
  };
}

function setupResizeObserver(container: HTMLDivElement, fitAddon: FitAddon): () => void {
  let resizeTimeout: number | null = null;

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;

    const { width, height } = entry.contentRect;
    if (width === 0 || height === 0) return;

    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      try {
        fitAddon.fit();
      } catch { }
    }, RESIZE_DEBOUNCE_MS);
  });

  observer.observe(container);
  return () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    observer.disconnect();
  };
}

export interface IGlobalTerminalAppearance {
  isReady: boolean;
  fontFamily: string | undefined;
  fontSize: number | undefined;
  letterSpacing: number | undefined;
  cursorStyle: CursorStyle | undefined;
  cursorBlink: boolean | undefined;
  rendererEngine: TerminalRendererEngine | undefined;
  ctrlOrMetaOpenTerminalLink: boolean;
}

export function useGlobalTerminalAppearance(): IGlobalTerminalAppearance {
  const configManagerService = useDependency(IConfigManagerService);
  const [isReady, setIsReady] = useState(false);
  const [fontFamily, setFontFamily] = useState<string | undefined>(undefined);
  const [fontSize, setFontSize] = useState<number | undefined>(undefined);
  const [letterSpacing, setLetterSpacing] = useState<number | undefined>(undefined);
  const [cursorStyle, setCursorStyle] = useState<CursorStyle | undefined>(undefined);
  const [cursorBlink, setCursorBlink] = useState<boolean | undefined>(undefined);
  const [rendererEngine, setRendererEngine] = useState<TerminalRendererEngine | undefined>(undefined);
  const [ctrlOrMetaOpenTerminalLink, setCtrlOrMetaOpenTerminalLink] = useState(DEFAULT_CTRL_OR_META_OPEN_TERMINAL_LINK);

  useEffect(() => {
    let active = true;

    const applyConfig = (config: ITerminalAppearanceConfig | null) => {
      if (!active) return;
      if (config) {
        setFontFamily(config.fontFamily || undefined);
        setFontSize(config.fontSize || undefined);
        setLetterSpacing(typeof config.letterSpacing === 'number' ? config.letterSpacing : undefined);
        setCursorStyle(config.cursorStyle || undefined);
        setCursorBlink(typeof config.cursorBlink === 'boolean' ? config.cursorBlink : undefined);
        setRendererEngine(config.rendererEngine === 'webgl' || config.rendererEngine === 'dom'
          ? config.rendererEngine
          : DEFAULT_TERMINAL_RENDERER_ENGINE);
        setCtrlOrMetaOpenTerminalLink(
          typeof config.ctrlOrMetaOpenTerminalLink === 'boolean'
            ? config.ctrlOrMetaOpenTerminalLink
            : DEFAULT_CTRL_OR_META_OPEN_TERMINAL_LINK
        );
      } else {
        setFontFamily(undefined);
        setFontSize(undefined);
        setLetterSpacing(undefined);
        setCursorStyle(undefined);
        setCursorBlink(undefined);
        setRendererEngine(undefined);
        setCtrlOrMetaOpenTerminalLink(DEFAULT_CTRL_OR_META_OPEN_TERMINAL_LINK);
      }
      setIsReady(true);
    };

    configManagerService.getField<ITerminalAppearanceConfig>(TERMINAL_PLUGIN_CONFIG_KEY, 'appearance')
      .then(applyConfig)
      .catch(() => {
        applyConfig(null);
      });

    const sub = configManagerService.onChanged$().subscribe((event) => {
      if (event.key !== TERMINAL_PLUGIN_CONFIG_KEY) {
        return;
      }
      if (event.subKey !== undefined && event.subKey !== 'appearance') {
        return;
      }
      if (event.type === 'delete') {
        applyConfig(null);
        return;
      }
      configManagerService.getField<ITerminalAppearanceConfig>(TERMINAL_PLUGIN_CONFIG_KEY, 'appearance')
        .then(applyConfig)
        .catch(() => { });
    });

    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [configManagerService]);

  return { isReady, fontFamily, fontSize, letterSpacing, cursorStyle, cursorBlink, rendererEngine, ctrlOrMetaOpenTerminalLink };
}

export interface IWindowTransparencyState {
  isReady: boolean;
  enabled: boolean;
  opacity: number;
}

export function useWindowTransparency(): IWindowTransparencyState {
  const configManagerService = useDependency(IConfigManagerService);
  const [isReady, setIsReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    let active = true;

    const applyConfig = (config: IWindowTransparencyConfig | null) => {
      if (!active) return;
      if (config && config.enabled) {
        setEnabled(true);
        setOpacity(typeof config.opacity === 'number' && config.opacity >= 0.3 && config.opacity <= 1
          ? config.opacity
          : DEFAULT_WINDOW_TRANSPARENCY_OPACITY);
      } else {
        setEnabled(false);
        setOpacity(1);
      }
      setIsReady(true);
    };

    configManagerService.getField<IWindowTransparencyConfig>(TERMINAL_PLUGIN_CONFIG_KEY, 'transparency')
      .then(applyConfig)
      .catch(() => {
        applyConfig(null);
      });

    const sub = configManagerService.onChanged$().subscribe((event) => {
      if (event.key !== TERMINAL_PLUGIN_CONFIG_KEY) {
        return;
      }
      if (event.subKey !== undefined && event.subKey !== 'transparency') {
        return;
      }
      if (event.type === 'delete') {
        applyConfig(null);
        return;
      }
      configManagerService.getField<IWindowTransparencyConfig>(TERMINAL_PLUGIN_CONFIG_KEY, 'transparency')
        .then(applyConfig)
        .catch(() => { });
    });

    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [configManagerService]);

  return { isReady, enabled, opacity };
}
