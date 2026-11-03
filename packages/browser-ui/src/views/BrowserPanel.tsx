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

import type { BrowserNavigationAction } from '../services/browser.service';
import { IContextService, LocaleService } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { IExternalLinkService } from '@termlnk/ui';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BROWSER_FOCUSED_CONTEXT } from '../common/constants';
import { IBrowserService } from '../services/browser.service';
import { BrowserSurface } from './BrowserSurface';

export function BrowserPanel() {
  const localeService = useDependency(LocaleService);
  const contextService = useDependency(IContextService);
  const browser = useDependency(IBrowserService);
  const externalLinkService = useDependency(IExternalLinkService);
  const tabs = useObservable(browser.tabs$, []);
  const activeId = useObservable(browser.activeTabId$, null);
  const active = tabs.find((t) => t.id === activeId) ?? null;

  const [address, setAddress] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tabs.length === 0) {
      browser.newTab();
    }
  }, [tabs.length, browser]);

  useEffect(() => {
    if (active) {
      setAddress(active.url);
    }
  }, [active?.id, active?.url]);

  useEffect(() => {
    const sub = browser.focusAddressRequest$.subscribe(() => {
      addressRef.current?.focus();
      addressRef.current?.select();
    });
    return () => sub.unsubscribe();
  }, [browser]);

  const go = useCallback(() => {
    if (!activeId) {
      return;
    }
    browser.navigate(activeId, address);
  }, [activeId, address, browser]);

  const navigate = useCallback((action: BrowserNavigationAction) => {
    if (activeId) {
      browser.requestNavigation(activeId, action);
    }
  }, [activeId, browser]);

  const handleFocus = useCallback(() => {
    contextService.setContextValue(BROWSER_FOCUSED_CONTEXT, true);
  }, [contextService]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      contextService.setContextValue(BROWSER_FOCUSED_CONTEXT, false);
    }
  }, [contextService]);

  useEffect(() => () => {
    contextService.setContextValue(BROWSER_FOCUSED_CONTEXT, false);
  }, [contextService]);

  const openExternal = useCallback(() => {
    if (active?.url) {
      externalLinkService.openExternal(active.url);
    }
  }, [active?.url, externalLinkService]);

  return (
    <div
      ref={containerRef}
      className="tm:flex tm:h-full tm:min-w-0 tm:flex-col tm:bg-black"
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      {/* Tab strip */}
      <div
        className={cn(`
          tm:flex tm:h-8 tm:shrink-0 tm:items-center tm:gap-0.5 tm:overflow-x-auto tm:border-b tm:border-line
          tm:bg-one-bg tm:px-1
        `)}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              `
                tm:group
                tm:flex tm:h-6 tm:max-w-[140px] tm:min-w-[80px] tm:items-center tm:gap-1 tm:rounded-sm tm:px-1.5
                tm:text-[11px]
              `,
              {
                'tm:bg-one-bg3 tm:text-light-grey': tab.id === activeId,
                'tm:text-grey tm:hover:bg-one-bg2': tab.id !== activeId,
              }
            )}
          >
            <button
              type="button"
              className="tm:min-w-0 tm:flex-1 tm:truncate tm:text-left"
              onClick={() => browser.setActiveTab(tab.id)}
              title={tab.title}
            >
              {tab.title || tab.url}
            </button>
            <button
              type="button"
              className="
                tm:hidden tm:shrink-0 tm:text-grey
                tm:group-hover:inline
                tm:hover:text-light-grey
              "
              onClick={() => browser.closeTab(tab.id)}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button
          type="button"
          title={localeService.t('browser-ui.new-tab')}
          onClick={() => browser.newTab()}
          className="
            tm:ml-0.5 tm:rounded-sm tm:p-1 tm:text-grey
            tm:hover:bg-one-bg2 tm:hover:text-light-grey
          "
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Address bar */}
      <div
        className={cn(`
          tm:flex tm:h-9 tm:shrink-0 tm:items-center tm:gap-1 tm:border-b tm:border-line tm:bg-one-bg tm:px-2
        `)}
      >
        <IconBtn
          title={localeService.t('browser-ui.back')}
          disabled={!active?.canGoBack}
          onClick={() => navigate('back')}
        >
          <ArrowLeft size={13} />
        </IconBtn>
        <IconBtn
          title={localeService.t('browser-ui.forward')}
          disabled={!active?.canGoForward}
          onClick={() => navigate('forward')}
        >
          <ArrowRight size={13} />
        </IconBtn>
        <IconBtn
          title={localeService.t('browser-ui.reload')}
          onClick={() => navigate('reload')}
        >
          <RefreshCw size={13} className={cn({ 'tm:animate-spin': active?.loading })} />
        </IconBtn>

        <form
          className="tm:min-w-0 tm:flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <input
            ref={addressRef}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className={cn(`
              tm:h-7 tm:w-full tm:rounded-md tm:border tm:border-line tm:bg-black tm:px-2 tm:text-xs tm:text-light-grey
              tm:outline-none
              tm:focus:border-nord-blue
            `)}
            placeholder={localeService.t('browser-ui.address-placeholder')}
          />
        </form>

        <IconBtn title={localeService.t('browser-ui.open-external')} onClick={openExternal}>
          <ExternalLink size={13} />
        </IconBtn>
      </div>

      {/* Content — keep all tab webviews mounted */}
      <div className="tm:relative tm:min-h-0 tm:flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn('tm:absolute tm:inset-0', {
              'tm:pointer-events-none tm:invisible': tab.id !== activeId,
            })}
          >
            <BrowserSurface tabId={tab.id} url={tab.url} active={tab.id === activeId} />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:text-xs tm:text-grey">
            {localeService.t('browser-ui.empty')}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'tm:rounded-sm tm:p-1.5 tm:text-grey tm:transition-colors',
        {
          'tm:opacity-40': disabled,
          'tm:hover:bg-one-bg2 tm:hover:text-light-grey': !disabled,
        }
      )}
    >
      {children}
    </button>
  );
}
