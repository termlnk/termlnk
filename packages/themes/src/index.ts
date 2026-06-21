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

export { base46ToXterm } from './adapters';

// Dark themes
export {
  aquarium,
  ashes,
  ayuDark,
  beardedArc,
  cappuccin,
  chadracula,
  chadraculaEvondev,
  chadtain,
  chocolate,
  decay,
  doomChad,
  everblush,
  everforest,
  falcon,
  flexoki,
  gatekeeper,
  githubDark,
  gruvbox,
  gruvchad,
  horizon,
  jabuti,
  jellybeans,
  kanagawa,
  material,
  melange,
  mitoLaser,
  monekai,
  monochrome,
  mountain,
  nightfox,
  nightlamp,
  nightowl,
  nord,
  oceanicNext,
  oneDark,
  oneNord,
  oxocarbon,
  palenight,
  pastelBeans,
  pastelDark,
  peanumbraDark,
  poimandres,
  radium,
  rosePine,
  rxyhn,
  solarizedDark,
  solarizedOsaka,
  sweetPastel,
  termlnkDark,
  tokyoDark,
  tokyoNight,
  tomorrowNight,
  tundra,
  vscodeDark,
  wombat,
  yoru,
} from './themes/dark';

// Light themes
export {
  ayuLight,
  blossomLight,
  everforestLight,
  flexLight,
  flexokiLight,
  githubLight,
  gruvboxLight,
  materialLighter,
  nanoLight,
  oceanicLight,
  oneLight,
  oneNordLight,
  penumbraLight,
  rosePineDawn,
  termlnkLight,
} from './themes/light';

export type { IBase16Colors, IBase30Colors, ICustomTheme, ITheme, IXtermTheme, ThemeType } from './types';
export { isCustomTheme } from './types';
export { ALL_THEMES, generateCSSVariables, injectThemeToDOM, injectTransparencyToDOM, removeThemeFromDOM, removeTransparencyFromDOM, THEME_MAP } from './utils';
