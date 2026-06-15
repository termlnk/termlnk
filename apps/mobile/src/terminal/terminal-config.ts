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

import { Platform } from 'react-native';

export interface ITerminalFont {
  readonly label: string;
  readonly value: string;
}

const IOS_FONTS: ITerminalFont[] = [
  { label: 'Menlo', value: 'Menlo, monospace' },
  { label: 'SF Mono', value: '"SF Mono", Menlo, monospace' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Courier', value: 'Courier, monospace' },
];

const ANDROID_FONTS: ITerminalFont[] = [
  { label: 'Default Mono', value: 'monospace' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

export function getTerminalFonts(): ITerminalFont[] {
  return Platform.OS === 'ios' ? IOS_FONTS : ANDROID_FONTS;
}

export function getFontLabel(fontFamily: string): string {
  const fonts = getTerminalFonts();
  const match = fonts.find((f) => f.value === fontFamily);
  return match?.label ?? fontFamily.split(',')[0]!.replace(/"/g, '');
}

export const FONT_SIZE_STEPS = [9, 13, 15, 19, 22] as const;
export const FONT_MIN = 9;
export const FONT_MAX = 22;

export const SCROLLBACK_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '500', value: '500' },
  { label: '1,000', value: '1000' },
  { label: '2,000', value: '2000' },
  { label: '5,000', value: '5000' },
  { label: '10,000', value: '10000' },
];

export const KEEP_ALIVE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '0 sec (disabled)', value: '0' },
  { label: '30 sec', value: '30' },
  { label: '60 sec', value: '60' },
  { label: '120 sec', value: '120' },
  { label: '300 sec', value: '300' },
];
