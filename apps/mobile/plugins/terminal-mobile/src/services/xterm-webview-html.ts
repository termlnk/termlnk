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

import { XTERM_ADDON_FIT_VERSION, XTERM_CSS, XTERM_VERSION, XTERM_WEBVIEW_BUNDLE_JS } from './webview/xterm-webview-bundle.generated';

// Defensive escape for content embedded inside <script> / <style>. The bundle and CSS
// currently contain no `</script>` / `</style>` sequence, but masking `</` to `<\/`
// keeps the HTML parser safe if a future build introduces one — the backslash is a
// no-op inside a JS string literal and is ignored by the CSS tokenizer.
function escapeForHtmlInline(source: string): string {
  return source.replace(/<\//g, '<\\/');
}

export function buildXtermHtml(fontSize = 13): string {
  // Coerce + clamp before injecting into the inline config; a dirty stored value
  // (NaN / out-of-range / non-numeric) would otherwise emit a bad font size. The entry
  // bundle clamps again defensively when the config is absent.
  const safeFontSize = Number.isFinite(fontSize) ? Math.min(22, Math.max(9, Math.round(fontSize))) : 13;
  const css = escapeForHtmlInline(XTERM_CSS);
  const bundle = escapeForHtmlInline(XTERM_WEBVIEW_BUNDLE_JS);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <style>${css}</style>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #0a0a0a; }
    #t { position: absolute; inset: 0; padding: 8px; }
  </style>
</head>
<body>
  <div id="t"></div>
  <!-- xterm ${XTERM_VERSION} + @xterm/addon-fit ${XTERM_ADDON_FIT_VERSION} (esbuild IIFE, inlined) -->
  <script>window.__TERMLNK_CONFIG__ = { fontSize: ${safeFontSize} };</script>
  <script>${bundle}</script>
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
