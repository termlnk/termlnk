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

// Stable color assignment for host avatars. Driven by host id (not label) so a
// rename does not visually move the host. Palette picks Base46 "onedark"
// vibrant accents that read clearly on the app's `bg-black` background.
//
// Foreground color is paired per-entry rather than computed from luminance
// so muted accents (e.g. baby-pink) get a darker text and bright accents
// (e.g. blue) get a darker text — keeps contrast consistent.

interface IAvatarColor {
  readonly bg: string;
  readonly fg: string;
}

const PALETTE: readonly IAvatarColor[] = [
  { bg: '#e06c75', fg: '#1e222a' }, // red
  { bg: '#de8c92', fg: '#1e222a' }, // baby-pink
  { bg: '#fca2aa', fg: '#1e222a' }, // orange
  { bg: '#e7c787', fg: '#1e222a' }, // yellow
  { bg: '#e5c07b', fg: '#1e222a' }, // sun
  { bg: '#98c379', fg: '#1e222a' }, // green
  { bg: '#7eca9c', fg: '#1e222a' }, // vibrant-green
  { bg: '#519aba', fg: '#1e222a' }, // teal
  { bg: '#61afef', fg: '#1e222a' }, // blue
  { bg: '#81a1c1', fg: '#1e222a' }, // nord-blue
  { bg: '#de98fd', fg: '#1e222a' }, // purple
  { bg: '#c882e7', fg: '#1e222a' }, // dark-purple
];

// DJB2 — classic small-table hash, deterministic across platforms.
function hashStringDjb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    // Force 32-bit signed via |0 so the modulo distribution stays uniform
    // regardless of input length.
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

export function getAvatarPalette(id: string): IAvatarColor {
  const index = hashStringDjb2(id) % PALETTE.length;
  return PALETTE[index]!;
}

export function getAvatarInitial(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return '?';
  }
  const codePoint = trimmed.codePointAt(0);
  if (codePoint === undefined) {
    return '?';
  }
  return String.fromCodePoint(codePoint).toUpperCase();
}
