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

// xterm.js renders inside a react-native-webview. Its UMD bundle and matching
// CSS are inlined from the npm packages at app build time (see
// scripts/generate-xterm-bundle.cjs and xterm-bundle.generated.ts) so the
// runtime never depends on a CDN reachable from the device.
//
// Bridge protocol between RN and the WebView:
//   Native → WebView : injectJavaScript("__termlnkTerm.write(<base64>)")
//   WebView → Native : window.ReactNativeWebView.postMessage(JSON.stringify({
//                          type: 'input' | 'size' | 'error' | 'ready',
//                          ...payload
//                      }))
//
// Base64 framing keeps multi-byte UTF-8 sequences intact through string-only postMessage.

import {
  XTERM_ADDON_FIT_JS,
  XTERM_ADDON_FIT_VERSION,
  XTERM_CSS,
  XTERM_JS,
  XTERM_VERSION,
} from './xterm-bundle.generated';

// Defensive escape for content embedded inside <script> / <style>. xterm's
// minified UMD currently contains no `</script>` sequence, but masking `</` to
// `<\/` keeps the HTML parser safe if a future bundle introduces one — the
// backslash is a no-op inside a JS string literal.
function escapeForHtmlInline(source: string): string {
  return source.replace(/<\//g, '<\\/');
}

export function buildXtermHtml(fontSize = 13): string {
  const css = escapeForHtmlInline(XTERM_CSS);
  const xtermJs = escapeForHtmlInline(XTERM_JS);
  const addonFitJs = escapeForHtmlInline(XTERM_ADDON_FIT_JS);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <script>
    // Error-bridge first — installed before xterm scripts run so an init crash
    // surfaces to the RN host instead of leaving the user with a black screen.
    (function () {
      function report(payload) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (_) { /* postMessage failure is non-fatal here */ }
      }
      window.__termlnkReport = report;
      window.addEventListener('error', function (ev) {
        report({
          type: 'error',
          message: (ev && ev.message) || 'unknown error',
          source: (ev && ev.filename) || '',
          line: (ev && ev.lineno) || 0,
          col: (ev && ev.colno) || 0,
          stack: ev && ev.error && ev.error.stack ? String(ev.error.stack).slice(0, 2000) : '',
        });
      }, true);
      window.addEventListener('unhandledrejection', function (ev) {
        var reason = ev && ev.reason;
        report({
          type: 'error',
          message: 'unhandledrejection: ' + (reason && reason.message ? reason.message : String(reason)),
          stack: reason && reason.stack ? String(reason.stack).slice(0, 2000) : '',
        });
      });
    })();
  </script>
  <style>${css}</style>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #0a0a0a; }
    #t { position: absolute; inset: 0; padding: 8px; }
  </style>
</head>
<body>
  <div id="t"></div>
  <!-- xterm ${XTERM_VERSION} (UMD, inlined) -->
  <script>${xtermJs}</script>
  <!-- @xterm/addon-fit ${XTERM_ADDON_FIT_VERSION} (UMD, inlined) -->
  <script>${addonFitJs}</script>
  <script>
    (function () {
      try {
        if (!window.Terminal) {
          window.__termlnkReport({ type: 'error', message: 'window.Terminal not defined — inlined xterm UMD did not execute' });
          return;
        }
        if (!window.FitAddon || !window.FitAddon.FitAddon) {
          window.__termlnkReport({ type: 'error', message: 'window.FitAddon.FitAddon not defined — inlined addon-fit UMD did not execute' });
          return;
        }
        var term = new window.Terminal({
          fontSize: ${fontSize},
          fontFamily: 'Menlo, Monaco, monospace',
          theme: { background: '#0a0a0a', foreground: '#e5e7eb' },
          cursorBlink: true,
          // Do NOT set convertEol: the SSH PTY already does onlcr, so the stream
          // is already \\r\\n. Re-inserting CR before every LF corrupts tmux's
          // cursor-positioning sequences and causes status-bar drift on refresh.
        });
        var fit = new window.FitAddon.FitAddon();
        term.loadAddon(fit);
        var host = document.getElementById('t');
        term.open(host);

        // RN-WebView does not fire window.resize when its native container relayouts
        // (rotation, keyboard show/hide, first-paint sizing). Observe the host element
        // directly so xterm always matches the viewport. rAF coalesces bursts.
        var fitPending = false;
        var lastCols = 0;
        var lastRows = 0;
        function scheduleFit() {
          if (fitPending) return;
          fitPending = true;
          requestAnimationFrame(function () {
            fitPending = false;
            try {
              fit.fit();
              if ((term.cols && term.rows) && (term.cols !== lastCols || term.rows !== lastRows)) {
                lastCols = term.cols;
                lastRows = term.rows;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'size', cols: term.cols, rows: term.rows,
                }));
              }
            } catch (e) {
              window.__termlnkReport({ type: 'error', message: 'fit.fit() threw: ' + (e && e.message ? e.message : String(e)) });
            }
          });
        }
        scheduleFit();
        if (typeof ResizeObserver !== 'undefined') {
          new ResizeObserver(scheduleFit).observe(host);
        }
        window.addEventListener('resize', scheduleFit);

        // Native injects via __termlnkTerm.write(b64); we decode then route to xterm.
        window.__termlnkTerm = {
          write: function (b64) {
            try {
              var binary = atob(b64);
              var bytes = new Uint8Array(binary.length);
              for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              term.write(new TextDecoder('utf-8').decode(bytes));
            } catch (e) {
              term.write('\\r\\n[termlnk-webview decode error]\\r\\n');
            }
          },
        };

        // Forward user input as base64 so high-bit bytes survive the postMessage string round-trip.
        term.onData(function (data) {
          var enc = new TextEncoder();
          var bytes = enc.encode(data);
          var binary = '';
          for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          var b64 = btoa(binary);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'input', data: b64 }));
        });

        // Tell RN the WebView side is fully wired. Without this the host couldn't
        // distinguish "fit failed silently" from "xterm never started".
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      } catch (e) {
        window.__termlnkReport({
          type: 'error',
          message: 'xterm init threw: ' + (e && e.message ? e.message : String(e)),
          stack: e && e.stack ? String(e.stack).slice(0, 2000) : '',
        });
      }
    })();
  </script>
</body>
</html>`;
}

// Base64 encode/decode helpers used by the terminal screen to bridge string output
// and the WebView's base64 channel.
const utf8 = {
  toBase64(s: string): string {
    const enc = new TextEncoder();
    const bytes = enc.encode(s);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return globalThis.btoa(binary);
  },
  fromBase64(b64: string): string {
    const binary = globalThis.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  },
};

export const xtermBridge = utf8;
