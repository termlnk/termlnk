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

import { IThemeService } from '@termlnk/core';
import { useDependency, useObservable } from '@termlnk/design';
import { IAIAgentClientService } from '@termlnk/rpc-client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assembleDocument, assembleShellDocument, buildThemeCss, STREAM_DEBOUNCE_MS } from '../../../../services/generative-ui/shell-template';

interface IWidgetRendererProps {
  title?: string;
  description?: string;
  html?: string;
  isStreaming?: boolean;
}

const HEIGHT_MIN_PX = 32;
const HEIGHT_MAX_PX = 4000;
const STREAM_MIN_CHARS = 20;
const RUN_SCRIPTS_DELAY_MS = 50;

export const WidgetRenderer = memo(function WidgetRenderer({
  title,
  description,
  html,
  isStreaming = false,
}: IWidgetRendererProps) {
  const themeService = useDependency(IThemeService);
  const aiAgentClient = useDependency(IAIAgentClientService);
  const currentTheme = useObservable(themeService.currentTheme$, themeService.currentTheme);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const usedStreamingRef = useRef(false);
  const shellInitRef = useRef(false);
  const lastSentHtmlRef = useRef('');
  const debounceTimerRef = useRef<number | null>(null);
  const scriptsRunRef = useRef(false);

  const themeCss = useMemo(() => buildThemeCss(currentTheme ?? null), [currentTheme]);

  const postToIframe = useCallback((message: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  // Theme update: push the new :root variables into the iframe whenever the host theme changes.
  useEffect(() => {
    if (!iframeRef.current || !loaded) {
      return;
    }
    postToIframe({ type: 'theme-update', css: themeCss });
  }, [themeCss, loaded, postToIframe]);

  // Initial mount: streaming branch — install the shell document once.
  useEffect(() => {
    if (!iframeRef.current) {
      return;
    }
    if (isStreaming && html && !shellInitRef.current) {
      shellInitRef.current = true;
      usedStreamingRef.current = true;
      scriptsRunRef.current = false;
      lastSentHtmlRef.current = '';
      iframeRef.current.srcdoc = assembleShellDocument(themeCss);
      setLoaded(false);
      setHeight(0);
    }
  }, [isStreaming, html, themeCss]);

  // Streaming push: debounced postMessage with the latest html.
  useEffect(() => {
    if (!html || !loaded || !iframeRef.current) {
      return;
    }
    if (!usedStreamingRef.current || !isStreaming) {
      return;
    }
    if (html === lastSentHtmlRef.current || html.length < STREAM_MIN_CHARS) {
      return;
    }
    if (debounceTimerRef.current !== null) {
      return;
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      if (!iframeRef.current || !html) {
        return;
      }
      lastSentHtmlRef.current = html;
      postToIframe({ type: 'set-content', html });
    }, STREAM_DEBOUNCE_MS);
  }, [html, isStreaming, loaded, postToIframe]);

  // Streaming finalize: once tool-call leaves streaming state, flush content + run scripts.
  useEffect(() => {
    if (!html || !loaded || !iframeRef.current) {
      return;
    }
    if (!usedStreamingRef.current || isStreaming || scriptsRunRef.current) {
      return;
    }
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    scriptsRunRef.current = true;
    lastSentHtmlRef.current = html;
    postToIframe({ type: 'set-content', html });
    window.setTimeout(() => {
      postToIframe({ type: 'run-scripts' });
    }, RUN_SCRIPTS_DELAY_MS);
  }, [html, isStreaming, loaded, postToIframe]);

  // Non-streaming path: full document via srcdoc.
  useEffect(() => {
    if (!html || !iframeRef.current) {
      return;
    }
    if (usedStreamingRef.current || isStreaming) {
      return;
    }
    shellInitRef.current = false;
    scriptsRunRef.current = true;
    iframeRef.current.srcdoc = assembleDocument(html, themeCss);
    setLoaded(false);
    setHeight(0);
  }, [html, isStreaming, themeCss]);

  // Loaded fallback timer.
  useEffect(() => {
    if (!html || (loaded && height > 0)) {
      return;
    }
    const t = window.setTimeout(() => {
      setLoaded(true);
      setHeight((h) => (h > 0 ? h : 200));
    }, 4000);
    return () => window.clearTimeout(t);
  }, [html, loaded, height]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Bridge: incoming messages from the iframe.
  useEffect(() => {
    function handle(e: MessageEvent) {
      if (!iframeRef.current) {
        return;
      }
      if (e.source !== iframeRef.current.contentWindow) {
        return;
      }
      const d = e.data as { type?: string; height?: number; url?: string; text?: string };
      if (!d || typeof d !== 'object') {
        return;
      }
      if (d.type === 'widget-resize' && typeof d.height === 'number') {
        const clamped = Math.max(HEIGHT_MIN_PX, Math.min(d.height + 8, HEIGHT_MAX_PX));
        setHeight(clamped);
      } else if (d.type === 'open-link' && typeof d.url === 'string') {
        try {
          window.open(d.url, '_blank', 'noopener,noreferrer');
        } catch (err) {
          console.error('[WidgetRenderer] open-link failed:', err);
        }
      } else if (d.type === 'send-prompt' && typeof d.text === 'string' && d.text.trim()) {
        aiAgentClient.sendMessage(d.text.trim()).catch((err) => {
          console.error('[WidgetRenderer] send-prompt failed:', err);
        });
      }
    }
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [aiAgentClient]);

  const ready = loaded && height > 0;

  return (
    <div className="tm:my-3 tm:w-full" data-testid="widget-renderer">
      {(title || description) && (
        <div className="tm:mb-3 tm:px-1">
          {title && <h3 className="tm:text-sm tm:font-semibold tm:text-white">{title}</h3>}
          {description && <p className="tm:mt-1 tm:text-xs tm:text-light-grey">{description}</p>}
        </div>
      )}
      <div className="tm:relative" style={{ display: html ? undefined : 'none' }}>
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          className="tm:w-full"
          onLoad={() => setLoaded(true)}
          style={{
            height: ready ? height : 0,
            overflow: 'hidden',
            background: 'transparent',
            border: 'none',
            opacity: ready ? 1 : 0,
            transition: 'opacity 200ms ease-in',
          }}
          title={title || 'Interactive widget'}
        />
      </div>
    </div>
  );
});
