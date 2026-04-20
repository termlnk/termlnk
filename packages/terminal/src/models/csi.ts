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

/**
 * ED (Erase in Display) mode parameter.
 *
 * Controls which portion of the display is erased when an ED command is received.
 */
export enum EraseDisplayMode {
  /** Erase from cursor to end of display */
  Below = 0,
  /** Erase from start of display to cursor */
  Above = 1,
  /** Erase entire display */
  Complete = 2,
  /** Erase scrollback buffer */
  Scrollback = 3,
}

/**
 * EL (Erase in Line) mode parameter.
 *
 * Controls which portion of the current line is erased when an EL command is received.
 */
export enum EraseLineMode {
  /** Erase from cursor to end of line */
  Right = 0,
  /** Erase from start of line to cursor */
  Left = 1,
  /** Erase entire line */
  Complete = 2,
}

/**
 * TBC (Tab Clear) mode parameter.
 *
 * Controls how tab stops are cleared.
 */
export enum TabClearMode {
  /** Clear tab stop at current position */
  Current = 0,
  /** Clear all tab stops */
  All = 3,
}

/**
 * DECSCUSR cursor shape.
 *
 * Controls the appearance of the terminal cursor.
 */
export enum CursorShape {
  /** Default cursor shape (usually block) */
  Default = 0,
  /** Blinking block */
  BlinkBlock = 1,
  /** Steady block */
  SteadyBlock = 2,
  /** Blinking underline */
  BlinkUnderline = 3,
  /** Steady underline */
  SteadyUnderline = 4,
  /** Blinking bar */
  BlinkBar = 5,
  /** Steady bar */
  SteadyBar = 6,
}

/**
 * Device Attributes request type.
 *
 * Identifies which level of device attributes is being requested.
 */
export enum DeviceAttributeType {
  /** Primary Device Attributes (CSI c) */
  Primary = 'primary',
  /** Secondary Device Attributes (CSI > c) */
  Secondary = 'secondary',
  /** Tertiary Device Attributes (CSI = c) */
  Tertiary = 'tertiary',
}

/**
 * Character protection attribute (DECSCA).
 *
 * Controls whether characters are protected from erasure by DECSED/DECSEL.
 */
export enum CharProtection {
  /** Not protected */
  Off = 0,
  /** Protected */
  On = 1,
  /** Not protected (same as 0) */
  Off2 = 2,
}
