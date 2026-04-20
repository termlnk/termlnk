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

import { DEFAULT_UI_FONT_SIZE } from '../controllers/config.schema';

const UI_FONT_STYLE_ID = 'tm-ui-font-variables';

export function injectUIFontToDOM(fontFamily: string, fontSize: number): void {
  if (typeof document === 'undefined') {
    return;
  }

  let styleEl = document.getElementById(UI_FONT_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = UI_FONT_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const resolvedSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : DEFAULT_UI_FONT_SIZE;

  const parts: string[] = [`html { font-size: ${resolvedSize}px; }`];

  if (fontFamily) {
    parts.push(`body { font-family: ${fontFamily}; }`);
  }

  styleEl.textContent = parts.join('\n');
}

export function removeUIFontFromDOM(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.getElementById(UI_FONT_STYLE_ID)?.remove();
}
