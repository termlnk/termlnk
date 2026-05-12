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

// xterm.js loaded inside a react-native-webview. We could vendor the script as a
// bundled asset, but for the v1 prebuild ergonomics it is simpler to pull from CDN —
// once the WebView caches it (every iOS / Android system WebView does), subsequent
// loads are offline-capable. The CDN URL is pinned to a major version so an upstream
// update cannot break the bridge contract.
//
// Bridge protocol between RN and the WebView:
//   Native → WebView : injectJavaScript("__termlnkTerm.write(<base64>)")
//   WebView → Native : window.ReactNativeWebView.postMessage(JSON.stringify({
//                          type: 'input',
//                          data: <base64>
//                      }))
//
// Base64 framing keeps multi-byte UTF-8 sequences intact through string-only postMessage.
// The host (terminal screen) decodes / re-encodes via a tiny utf-8 helper.

const XTERM_VERSION = '5.5.0'; // last stable xterm v5; xterm v6 is in beta as of 2026-05.

export function buildXtermHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@${XTERM_VERSION}/css/xterm.min.css" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #0a0a0a; }
    #t { position: absolute; inset: 0; padding: 8px; }
  </style>
</head>
<body>
  <div id="t"></div>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@${XTERM_VERSION}/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
  <script>
    var term = new window.Terminal({
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, monospace',
      theme: { background: '#0a0a0a', foreground: '#e5e7eb' },
      cursorBlink: true,
      convertEol: true,
    });
    var fit = new window.FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(document.getElementById('t'));
    fit.fit();
    window.addEventListener('resize', function () { try { fit.fit(); } catch (e) {} });

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
  </script>
</body>
</html>`;
}

// Base64 encode/decode helpers used by the terminal screen to bridge string output
// (NMSSH 'Shell' events surface UTF-8 strings) and the WebView's base64 channel.
const utf8 = {
  toBase64(s: string): string {
    const enc = new TextEncoder();
    const bytes = enc.encode(s);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    // btoa exists on RN's Hermes JS runtime via the built-in polyfill.
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
