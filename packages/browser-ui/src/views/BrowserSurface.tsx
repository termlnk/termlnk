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

import { cn, useDependency } from '@termlnk/design';
import { BROWSER_GUEST_ATTR, BROWSER_PARTITION } from '@termlnk/electron';
import { useEffect, useRef } from 'react';
import { filter } from 'rxjs/operators';
import { IBrowserService } from '../services/browser.service';

/** Minimal surface of Electron's <webview> element used by this component. */
interface IWebviewElement extends HTMLElement {
  src: string;
  partition?: string;
  getTitle?: () => string;
  getURL?: () => string;
  canGoBack?: () => boolean;
  canGoForward?: () => boolean;
  loadURL: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
}

export interface IBrowserSurfaceProps {
  tabId: string;
  url: string;
  active: boolean;
}

/**
 * Sole component that touches the <webview> DOM API. Host logic is isolated
 * here so a future WebContentsView migration stays contained.
 */
export function BrowserSurface({ tabId, url, active }: IBrowserSurfaceProps) {
  const browser = useDependency(IBrowserService);
  const ref = useRef<IWebviewElement | null>(null);
  const lastUrlRef = useRef(url);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const history = () => ({
      canGoBack: el.canGoBack?.() ?? false,
      canGoForward: el.canGoForward?.() ?? false,
    });

    const onStart = () => {
      browser.updateTab(tabId, { loading: true });
    };
    const onStop = () => {
      browser.updateTab(tabId, {
        loading: false,
        title: el.getTitle?.() || browser.tabs.find((t) => t.id === tabId)?.title || 'Tab',
        url: el.getURL?.() || lastUrlRef.current,
        ...history(),
      });
    };
    const onTitle = (e: Event) => {
      const title = (e as Event & { title?: string }).title;
      if (title) {
        browser.updateTab(tabId, { title });
      }
    };
    const onFavicon = (e: Event) => {
      const favicons = (e as Event & { favicons?: string[] }).favicons;
      if (favicons?.[0]) {
        browser.updateTab(tabId, { favicon: favicons[0] });
      }
    };
    const onNavigate = (e: Event) => {
      const nextUrl = (e as Event & { url?: string }).url;
      if (nextUrl) {
        lastUrlRef.current = nextUrl;
        browser.updateTab(tabId, { url: nextUrl, ...history() });
      }
    };

    el.addEventListener('did-start-loading', onStart);
    el.addEventListener('did-stop-loading', onStop);
    el.addEventListener('page-title-updated', onTitle);
    el.addEventListener('page-favicon-updated', onFavicon);
    el.addEventListener('did-navigate', onNavigate);
    el.addEventListener('did-navigate-in-page', onNavigate);

    return () => {
      el.removeEventListener('did-start-loading', onStart);
      el.removeEventListener('did-stop-loading', onStop);
      el.removeEventListener('page-title-updated', onTitle);
      el.removeEventListener('page-favicon-updated', onFavicon);
      el.removeEventListener('did-navigate', onNavigate);
      el.removeEventListener('did-navigate-in-page', onNavigate);
    };
  }, [browser, tabId]);

  // History commands the toolbar publishes for this tab.
  useEffect(() => {
    const sub = browser.navigationRequest$
      .pipe(filter((req) => req.tabId === tabId))
      .subscribe((req) => {
        const el = ref.current;
        if (!el) {
          return;
        }
        if (req.action === 'back') {
          el.goBack();
        } else if (req.action === 'forward') {
          el.goForward();
        } else {
          el.reload();
        }
      });
    return () => sub.unsubscribe();
  }, [browser, tabId]);

  // Imperative navigation when the service URL changes (address bar / new tab).
  useEffect(() => {
    const el = ref.current;
    if (!el || !url || url === lastUrlRef.current) {
      return;
    }
    lastUrlRef.current = url;
    el.loadURL(url);
  }, [url]);

  // Custom data-* attribute is read by BrowserWebviewController's attach gate.
  const guestAttrs = { [BROWSER_GUEST_ATTR]: '1' } as Record<string, string>;

  return (
    // Inactive guests stay mounted and only lose visibility: `display: none`
    // detaches a <webview>, reloading the page on every tab switch.
    <webview
      ref={ref as unknown as React.RefObject<HTMLElement>}
      src={url}
      partition={BROWSER_PARTITION}
      {...guestAttrs}
      className={cn('tm:size-full', {
        'tm:pointer-events-none tm:invisible': !active,
      })}
    />
  );
}
