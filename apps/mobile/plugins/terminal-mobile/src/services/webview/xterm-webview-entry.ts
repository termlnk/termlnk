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

// Build-time-only entry: this module is NEVER imported by the React Native runtime
// graph. scripts/build-xterm-webview.mjs (esbuild) bundles it into a single IIFE that
// is inlined into the WebView HTML (see ../xterm-webview-html.ts). Authoring the
// WebView side as a real TypeScript module — instead of a hand-written string — gives
// type-checking against the xterm API and lets the addon set grow cleanly.
//
// Bridge protocol (must stay in sync with ../xterm-webview-html.ts and the terminal
// screen at apps/mobile/app/host/[id]/terminal.tsx):
//   Native  → WebView : window.__termlnkTerm.write(<base64>)
//   WebView → Native  : window.ReactNativeWebView.postMessage(JSON.stringify({ type, ... }))
// Base64 framing keeps multi-byte UTF-8 sequences intact through the string-only channel.

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

interface BridgeMessage {
  type: 'input' | 'size' | 'ready' | 'error';
  [key: string]: unknown;
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    __termlnkTerm?: { write: (base64: string) => void };
    __termlnkReport?: (payload: BridgeMessage) => void;
    __TERMLNK_CONFIG__?: { fontSize?: number };
  }
}

function post(payload: BridgeMessage): void {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
  } catch {
    // postMessage failure is non-fatal here.
  }
}

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clampFontSize(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(22, Math.max(9, Math.round(value)))
    : 13;
}

// Error bridge first — installed before xterm starts so an init crash surfaces to the
// RN host instead of leaving the user with a black screen.
window.__termlnkReport = post;
window.addEventListener('error', (ev) => {
  post({
    type: 'error',
    message: ev?.message || 'unknown error',
    source: ev?.filename || '',
    line: ev?.lineno || 0,
    col: ev?.colno || 0,
    stack: ev?.error?.stack ? String(ev.error.stack).slice(0, 2000) : '',
  });
}, true);
window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev?.reason;
  post({
    type: 'error',
    message: `unhandledrejection: ${reason?.message ?? String(reason)}`,
    stack: reason?.stack ? String(reason.stack).slice(0, 2000) : '',
  });
});

function start(): void {
  const term = new Terminal({
    fontSize: clampFontSize(window.__TERMLNK_CONFIG__?.fontSize),
    fontFamily: 'Menlo, Monaco, monospace',
    theme: { background: '#0a0a0a', foreground: '#e5e7eb' },
    cursorBlink: true,
    // Do NOT set convertEol: the SSH PTY already does onlcr, so the stream is already
    // \r\n. Re-inserting CR before every LF corrupts tmux's cursor-positioning
    // sequences and causes status-bar drift on refresh.
  });
  const fit = new FitAddon();
  term.loadAddon(fit);

  const host = document.getElementById('t');
  if (!host) {
    post({ type: 'error', message: 'terminal host element #t missing' });
    return;
  }
  term.open(host);

  // RN-WebView does not fire window.resize when its native container relayouts
  // (rotation, keyboard show/hide, first-paint sizing). Observe the host element
  // directly so xterm always matches the viewport. rAF coalesces bursts.
  let fitPending = false;
  let lastCols = 0;
  let lastRows = 0;
  const scheduleFit = (): void => {
    if (fitPending) {
      return;
    }
    fitPending = true;
    requestAnimationFrame(() => {
      fitPending = false;
      try {
        fit.fit();
        if (term.cols && term.rows && (term.cols !== lastCols || term.rows !== lastRows)) {
          lastCols = term.cols;
          lastRows = term.rows;
          post({ type: 'size', cols: term.cols, rows: term.rows });
        }
      } catch (error) {
        post({ type: 'error', message: `fit.fit() threw: ${errMessage(error)}` });
      }
    });
  };
  scheduleFit();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(scheduleFit).observe(host);
  }
  window.addEventListener('resize', scheduleFit);

  // Native injects via __termlnkTerm.write(b64); decode then route to xterm.
  window.__termlnkTerm = {
    write: (base64: string): void => {
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        term.write(new TextDecoder('utf-8').decode(bytes));
      } catch {
        term.write('\r\n[termlnk-webview decode error]\r\n');
      }
    },
  };

  // Forward user input as base64 so high-bit bytes survive the postMessage round-trip.
  term.onData((data) => {
    const bytes = new TextEncoder().encode(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    post({ type: 'input', data: btoa(binary) });
  });

  // Tell RN the WebView side is fully wired so the host can distinguish "fit failed
  // silently" from "xterm never started".
  post({ type: 'ready' });
}

try {
  start();
} catch (error) {
  post({
    type: 'error',
    message: `xterm init threw: ${errMessage(error)}`,
    stack: error instanceof Error && error.stack ? error.stack.slice(0, 2000) : '',
  });
}
