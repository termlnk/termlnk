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

// Key sequences for the Termius-style terminal accessory grid. Each cap either
// carries a `seq` written straight to the shell, or is marked `placeholder` for
// caps whose behaviour depends on features the WebView owns (paste) or modifier
// state we cannot bridge to the xterm textarea (standalone ctrl/alt).
const ESC = '\x1B';

export interface ITerminalKeyCap {
  readonly label: string;
  readonly seq?: string;
  readonly placeholder?: boolean;
}

// Eight-column grid mirroring the Termius default keyboard panel.
export const KEY_GRID: readonly (readonly ITerminalKeyCap[])[] = [
  [
    { label: 'shift\ntab', seq: `${ESC}[Z` },
    { label: '?', seq: '?' },
    { label: '/', seq: '/' },
    { label: '|', seq: '|' },
    { label: 'esc', seq: ESC },
    { label: 'tab', seq: '\t' },
    { label: 'ctrl', placeholder: true },
    { label: 'alt', placeholder: true },
  ],
  [
    { label: '^C', seq: '\x03' },
    { label: '^I', seq: '\x09' },
    { label: '^S', seq: '\x13' },
    { label: '^Z', seq: '\x1A' },
    { label: '/', seq: '/' },
    { label: '|', seq: '|' },
    { label: '~', seq: '~' },
    { label: '-', seq: '-' },
  ],
  [
    { label: 'home', seq: `${ESC}[H` },
    { label: 'pgUp', seq: `${ESC}[5~` },
    { label: 'pgDn', seq: `${ESC}[6~` },
    { label: 'end', seq: `${ESC}[F` },
    { label: '=', seq: '=' },
    { label: ':', seq: ':' },
    { label: ';', seq: ';' },
    { label: '!', seq: '!' },
  ],
  [
    { label: '*', seq: '*' },
    { label: '$', seq: '$' },
    { label: '%', seq: '%' },
    { label: '^', seq: '^' },
    { label: '<', seq: '<' },
    { label: '>', seq: '>' },
    { label: '(', seq: '(' },
    { label: ')', seq: ')' },
  ],
  [
    { label: '{', seq: '{' },
    { label: '}', seq: '}' },
    { label: '[', seq: '[' },
    { label: ']', seq: ']' },
    { label: 'paste', placeholder: true },
    { label: 'del', seq: `${ESC}[3~` },
    { label: 'ins', seq: `${ESC}[2~` },
    { label: '@', seq: '@' },
  ],
  [
    { label: 'F1', seq: `${ESC}OP` },
    { label: 'F2', seq: `${ESC}OQ` },
    { label: 'F3', seq: `${ESC}OR` },
    { label: 'F4', seq: `${ESC}OS` },
    { label: 'F5', seq: `${ESC}[15~` },
    { label: 'F6', seq: `${ESC}[17~` },
    { label: 'F7', seq: `${ESC}[18~` },
    { label: 'F8', seq: `${ESC}[19~` },
  ],
  [
    { label: 'F9', seq: `${ESC}[20~` },
    { label: 'F10', seq: `${ESC}[21~` },
    { label: 'F11', seq: `${ESC}[23~` },
    { label: 'F12', seq: `${ESC}[24~` },
    { label: '^_', seq: '\x1F' },
    { label: '^L', seq: '\x0C' },
    { label: 'Alt-r', seq: `${ESC}r` },
    { label: '^X^X', seq: '\x18\x18' },
  ],
];

export interface ITerminalArrow {
  readonly dir: 'left' | 'up' | 'down' | 'right';
  readonly seq: string;
}

export const ARROW_KEYS: readonly ITerminalArrow[] = [
  { dir: 'left', seq: `${ESC}[D` },
  { dir: 'up', seq: `${ESC}[A` },
  { dir: 'down', seq: `${ESC}[B` },
  { dir: 'right', seq: `${ESC}[C` },
];
