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
import { generateCSSVariables } from '@termlnk/themes';

const MORPHDOM_CDN_URL = 'https://cdn.jsdelivr.net/npm/morphdom@2.7.4/dist/morphdom-umd.min.js';

/** Debounce window between successive `set-content` postMessage calls during streaming. */
export const STREAM_DEBOUNCE_MS = 150;

/**
 * Bridge JS injected into every widget iframe. Implements:
 *  - widget→host: widget-resize / open-link / send-prompt
 *  - host→widget: set-content / run-scripts / theme-update
 *  - DOM diff via morphdom (so streaming updates do not flicker); innerHTML fallback when CDN is unreachable
 *  - ResizeObserver-driven height reporting (with 300ms × 15s polling fallback)
 *  - Click on http(s) links → forwarded to host as open-link
 */
const BRIDGE_JS = `
(function () {
  window._morphReady = false;
  window._pending = null;
  window._setContent = function (html) {
    var root = document.getElementById('content');
    if (!root) { return; }
    if (window._morphReady && typeof window.morphdom === 'function') {
      var target = document.createElement('div');
      target.id = 'content';
      try { target.innerHTML = html; } catch (_) { return; }
      try {
        window.morphdom(root, target, {
          onBeforeElUpdated: function (from, to) { return !from.isEqualNode(to); },
          onNodeAdded: function (node) {
            if (node.nodeType === 1 && node.tagName !== 'STYLE' && node.tagName !== 'SCRIPT') {
              node.style.animation = '_tmFadeIn 0.3s ease both';
            }
            return node;
          }
        });
      } catch (_) {
        try { root.innerHTML = html; } catch (__) { /* ignore */ }
      }
    } else {
      // Either CDN failed or morphdom not loaded yet — buffer until ready, but
      // also keep a degraded innerHTML path so partial preview still renders.
      window._pending = html;
      try { root.innerHTML = html; } catch (_) { /* ignore */ }
    }
    reportSize();
  };
  window._runScripts = function () {
    var nodes = document.querySelectorAll('#content script');
    for (var i = 0; i < nodes.length; i++) {
      var old = nodes[i];
      var s = document.createElement('script');
      if (old.src) { s.src = old.src; } else { s.textContent = old.textContent; }
      old.parentNode.replaceChild(s, old);
    }
    setTimeout(reportSize, 80);
  };
  window._applyTheme = function (css) {
    var styleEl = document.getElementById('_tm_theme_vars');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = '_tm_theme_vars';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css || '';
  };
  function reportSize() {
    var c = document.getElementById('content');
    var h = c ? c.offsetHeight : document.documentElement.scrollHeight;
    var n = c ? c.querySelectorAll('*').length : 0;
    window.parent.postMessage({ type: 'widget-resize', height: h, elementCount: n }, '*');
  }
  try {
    var _ro = new ResizeObserver(reportSize);
    var _root = document.getElementById('content');
    if (_root) { _ro.observe(_root); }
  } catch (_) { /* ResizeObserver may not exist */ }
  window.sendPrompt = function (text) {
    if (typeof text !== 'string' || !text.trim()) { return; }
    window.parent.postMessage({ type: 'send-prompt', text: text }, '*');
  };
  window.openLink = function (url) {
    if (typeof url !== 'string') { return; }
    window.parent.postMessage({ type: 'open-link', url: url }, '*');
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object') { return; }
    if (d.type === 'set-content' && typeof d.html === 'string') {
      window._setContent(d.html);
    } else if (d.type === 'run-scripts') {
      window._runScripts();
      // Flush any pending content first
      if (window._pending != null) {
        window._setContent(window._pending);
        window._pending = null;
      }
    } else if (d.type === 'theme-update' && typeof d.css === 'string') {
      window._applyTheme(d.css);
    }
  });
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a && a.href && /^https?:/i.test(a.href)) {
      e.preventDefault();
      window.parent.postMessage({ type: 'open-link', url: a.href }, '*');
    }
  });
  var _ri = setInterval(reportSize, 300);
  setTimeout(function () { clearInterval(_ri); }, 15000);
  // CDN fallback: if morphdom does not load within 3s, mark ready so degraded
  // innerHTML rendering kicks in without further blocking.
  setTimeout(function () {
    if (!window._morphReady) {
      window._morphReady = true;
      if (window._pending != null) {
        window._setContent(window._pending);
        window._pending = null;
      }
    }
  }, 3000);
})();
`;

const BASE_CSS = `
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  /* base46 \`white\` is high-contrast in BOTH dark and light themes — dark→#fff, light→#26292f */
  color: var(--tm-white, #ffffff);
  background: transparent;
}
body { padding: 12px; }
#content { min-height: 1px; }
button {
  font-family: inherit;
  cursor: pointer;
  border: 1px solid var(--tm-line, #3e4452);
  background: var(--tm-one-bg, #21252b);
  color: var(--tm-white, #ffffff);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  transition: background 120ms ease, border-color 120ms ease;
}
button:hover { background: var(--tm-one-bg2, #2c313a); }
button:active { background: var(--tm-one-bg3, #353b45); }
button[aria-pressed="true"] { background: var(--tm-blue, #61afef); color: var(--tm-black, #282c34); }
input, textarea, select {
  font-family: inherit;
  background: var(--tm-darker-black, #1e222a);
  color: var(--tm-white, #ffffff);
  border: 1px solid var(--tm-line, #3e4452);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  outline: none;
}
input:focus, textarea:focus, select:focus { border-color: var(--tm-blue, #61afef); }
a { color: var(--tm-blue, #61afef); text-decoration: none; }
a:hover { text-decoration: underline; }
hr { border: none; border-top: 1px solid var(--tm-line, #3e4452); margin: 12px 0; }
@keyframes _tmFadeIn {
  from { opacity: 0; transform: translateY(2px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

/**
 * Generate the `:root { --tm-*: ...; }` block from a base46 theme. Falls back to a minimal
 * hard-coded one-dark palette if no theme is set so the iframe never renders raw white.
 */
export function buildThemeCss(theme: ITheme | null): string {
  if (!theme) {
    // One-Dark fallback — keeps widgets readable before the first theme is loaded
    return ':root {\n  --tm-black: #282c34;\n  --tm-light-grey: #abb2bf;\n  --tm-one-bg: #21252b;\n  --tm-one-bg2: #2c313a;\n  --tm-one-bg3: #353b45;\n  --tm-line: #3e4452;\n  --tm-blue: #61afef;\n  --tm-red: #e06c75;\n  --tm-green: #98c379;\n  --tm-yellow: #e5c07b;\n  --tm-purple: #c678dd;\n  --tm-cyan: #56b6c2;\n  --tm-white: #ffffff;\n}';
  }
  const vars = generateCSSVariables(theme, '--tm');
  return `:root {\n${vars}\n}`;
}

/**
 * Build the streaming shell document. The fragment HTML is empty initially; the host
 * pushes content via postMessage `{type:'set-content', html}` and finalizes with
 * `{type:'run-scripts'}` once the assistant finishes streaming.
 */
export function assembleShellDocument(themeCss: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style id="_tm_theme_vars">${themeCss}</style>
<style>${BASE_CSS}</style>
</head>
<body>
<div id="content"></div>
<script>${BRIDGE_JS}</script>
<script src="${MORPHDOM_CDN_URL}" onload="window._morphReady=true;if(window._pending!=null){window._setContent(window._pending);window._pending=null;}"></script>
</body>
</html>`;
}

/**
 * Build a fully-rendered (non-streaming) document for finalized widgets. Skips morphdom
 * since no further DOM diffing is needed.
 */
export function assembleDocument(html: string, themeCss: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style id="_tm_theme_vars">${themeCss}</style>
<style>${BASE_CSS}</style>
</head>
<body>
<div id="content">${html}</div>
<script>${BRIDGE_JS}</script>
</body>
</html>`;
}
