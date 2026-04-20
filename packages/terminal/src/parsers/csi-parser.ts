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

import type { CursorShape, EraseDisplayMode, EraseLineMode, TabClearMode } from '../models/csi';
import type { ICsiSequence } from './csi-stream-parser';

// --- Cursor Movement ---

/** CUU - Cursor Up */
export interface ICursorUpCommand { type: 'CUU'; count: number }
/** CUD - Cursor Down */
export interface ICursorDownCommand { type: 'CUD'; count: number }
/** CUF - Cursor Forward */
export interface ICursorForwardCommand { type: 'CUF'; count: number }
/** CUB - Cursor Backward */
export interface ICursorBackwardCommand { type: 'CUB'; count: number }
/** CNL - Cursor Next Line */
export interface ICursorNextLineCommand { type: 'CNL'; count: number }
/** CPL - Cursor Previous Line */
export interface ICursorPreviousLineCommand { type: 'CPL'; count: number }
/** CUP - Cursor Position */
export interface ICursorPositionCommand { type: 'CUP'; row: number; col: number }
/** HPA - Horizontal Position Absolute */
export interface IHorizontalPositionAbsoluteCommand { type: 'HPA'; column: number }
/** HPR - Horizontal Position Relative */
export interface IHorizontalPositionRelativeCommand { type: 'HPR'; count: number }
/** VPA - Vertical Position Absolute */
export interface IVerticalPositionAbsoluteCommand { type: 'VPA'; row: number }
/** VPR - Vertical Position Relative */
export interface IVerticalPositionRelativeCommand { type: 'VPR'; count: number }
/** CHT - Cursor Horizontal Tab */
export interface ICursorHorizontalTabCommand { type: 'CHT'; count: number }
/** CBT - Cursor Backward Tab */
export interface ICursorBackwardTabCommand { type: 'CBT'; count: number }

// --- Erase/Delete ---

/** ED - Erase in Display */
export interface IEraseInDisplayCommand { type: 'ED'; mode: EraseDisplayMode }
/** EL - Erase in Line */
export interface IEraseInLineCommand { type: 'EL'; mode: EraseLineMode }
/** ECH - Erase Character */
export interface IEraseCharacterCommand { type: 'ECH'; count: number }
/** DCH - Delete Character */
export interface IDeleteCharacterCommand { type: 'DCH'; count: number }
/** DL - Delete Line */
export interface IDeleteLineCommand { type: 'DL'; count: number }
/** IL - Insert Line */
export interface IInsertLineCommand { type: 'IL'; count: number }
/** ICH - Insert Character */
export interface IInsertCharacterCommand { type: 'ICH'; count: number }

// --- Scrolling ---

/** SU - Scroll Up */
export interface IScrollUpCommand { type: 'SU'; count: number }
/** SD - Scroll Down */
export interface IScrollDownCommand { type: 'SD'; count: number }

// --- Margins ---

/** DECSTBM - Set Top and Bottom Margins */
export interface ISetTopBottomMarginsCommand { type: 'DECSTBM'; top: number; bottom: number }
/** DECSLRM - Set Left and Right Margins */
export interface ISetLeftRightMarginsCommand { type: 'DECSLRM'; left: number; right: number }

// --- Tab ---

/** TBC - Tab Clear */
export interface ITabClearCommand { type: 'TBC'; mode: TabClearMode }

// --- Text Attributes ---

/** SGR - Select Graphic Rendition */
export interface ISelectGraphicRenditionCommand { type: 'SGR'; params: number[] }

// --- Repeat ---

/** REP - Repeat Character */
export interface IRepeatCharacterCommand { type: 'REP'; count: number }

// --- Mode Control ---

/** SM - Set Mode */
export interface ISetModeCommand { type: 'SM'; params: number[]; isPrivate: boolean }
/** RM - Reset Mode */
export interface IResetModeCommand { type: 'RM'; params: number[]; isPrivate: boolean }
/** DECRQM - Request Mode */
export interface IRequestModeCommand { type: 'DECRQM'; mode: number; isPrivate: boolean }

// --- Cursor Style ---

/** DECSCUSR - Set Cursor Style */
export interface ISetCursorStyleCommand { type: 'DECSCUSR'; shape: CursorShape }

// --- Device Reports ---

/** DSR - Device Status Report */
export interface IDeviceStatusReportCommand { type: 'DSR'; param: number; isPrivate: boolean }
/** DA1 - Primary Device Attributes */
export interface IDeviceAttributesPrimaryCommand { type: 'DA1' }
/** DA2 - Secondary Device Attributes */
export interface IDeviceAttributesSecondaryCommand { type: 'DA2' }
/** DA3 - Tertiary Device Attributes */
export interface IDeviceAttributesTertiaryCommand { type: 'DA3' }
/** XTVERSION - XTerm Version Request */
export interface IXtVersionCommand { type: 'XTVERSION' }
/** XTWINOPS - Window Manipulation */
export interface IWindowManipulationCommand { type: 'XTWINOPS'; params: number[] }

// --- Kitty Keyboard Protocol ---

/** Kitty Keyboard Query (CSI ? u) */
export interface IKittyKeyboardQueryCommand { type: 'KITTY_KEYBOARD_QUERY' }
/** Kitty Keyboard Push (CSI > u) */
export interface IKittyKeyboardPushCommand { type: 'KITTY_KEYBOARD_PUSH'; flags: number }
/** Kitty Keyboard Pop (CSI < u) */
export interface IKittyKeyboardPopCommand { type: 'KITTY_KEYBOARD_POP'; count: number }
/** Kitty Keyboard Set (CSI = u) */
export interface IKittyKeyboardSetCommand { type: 'KITTY_KEYBOARD_SET'; flags: number; action: number }

// --- Cursor Save/Restore ---

/** DECSC - Save Cursor */
export interface ISaveCursorCommand { type: 'DECSC' }
/** DECRC - Restore Cursor */
export interface IRestoreCursorCommand { type: 'DECRC' }

// --- Character Protection ---

/** DECSCA - Select Character Protection Attribute */
export interface ISelectCharProtectionCommand { type: 'DECSCA'; mode: number }

// --- Unknown ---

/** An unrecognized CSI sequence */
export interface IUnknownCsiCommand { type: 'UNKNOWN'; raw: ICsiSequence }

/**
 * Discriminated union of all supported CSI commands.
 */
export type CsiCommand =
  | ICursorUpCommand | ICursorDownCommand | ICursorForwardCommand | ICursorBackwardCommand
  | ICursorNextLineCommand | ICursorPreviousLineCommand | ICursorPositionCommand
  | IHorizontalPositionAbsoluteCommand | IHorizontalPositionRelativeCommand
  | IVerticalPositionAbsoluteCommand | IVerticalPositionRelativeCommand
  | ICursorHorizontalTabCommand | ICursorBackwardTabCommand
  | IEraseInDisplayCommand | IEraseInLineCommand | IEraseCharacterCommand
  | IDeleteCharacterCommand | IDeleteLineCommand | IInsertLineCommand | IInsertCharacterCommand
  | IScrollUpCommand | IScrollDownCommand
  | ISetTopBottomMarginsCommand | ISetLeftRightMarginsCommand
  | ITabClearCommand
  | ISelectGraphicRenditionCommand
  | IRepeatCharacterCommand
  | ISetModeCommand | IResetModeCommand | IRequestModeCommand
  | ISetCursorStyleCommand
  | IDeviceStatusReportCommand
  | IDeviceAttributesPrimaryCommand | IDeviceAttributesSecondaryCommand | IDeviceAttributesTertiaryCommand
  | IXtVersionCommand | IWindowManipulationCommand
  | IKittyKeyboardQueryCommand | IKittyKeyboardPushCommand | IKittyKeyboardPopCommand | IKittyKeyboardSetCommand
  | ISaveCursorCommand | IRestoreCursorCommand
  | ISelectCharProtectionCommand
  | IUnknownCsiCommand;

/**
 * Extract a parameter value at the given index, returning a default if absent.
 * A value of -1 indicates the parameter was omitted (default/absent).
 */
function paramOrDefault(params: number[], index: number, defaultValue: number): number {
  if (index >= params.length) {
    return defaultValue;
  }
  const value = params[index];
  return value === -1 ? defaultValue : value;
}

/**
 * Replace all -1 (absent) values in a params array with the given default.
 */
function normalizeParams(params: number[], defaultValue: number): number[] {
  return params.map((p) => (p === -1 ? defaultValue : p));
}

/**
 * Parse an extracted CSI sequence into a typed command.
 *
 * @param seq - The raw CSI sequence as extracted by CsiStreamParser.
 * @returns A typed CsiCommand representing the parsed sequence.
 */
export function parseCsi(seq: ICsiSequence): CsiCommand {
  const { params, intermediates, prefix, final: finalByte } = seq;

  switch (finalByte) {
    // --- Cursor Movement ---
    case 'A':
      return { type: 'CUU', count: paramOrDefault(params, 0, 1) };

    case 'B':
      return { type: 'CUD', count: paramOrDefault(params, 0, 1) };

    case 'C':
      return { type: 'CUF', count: paramOrDefault(params, 0, 1) };

    case 'D':
      return { type: 'CUB', count: paramOrDefault(params, 0, 1) };

    case 'E':
      return { type: 'CNL', count: paramOrDefault(params, 0, 1) };

    case 'F':
      return { type: 'CPL', count: paramOrDefault(params, 0, 1) };

    case 'G':
    case '`':
      return { type: 'HPA', column: paramOrDefault(params, 0, 1) };

    case 'H':
    case 'f':
      return {
        type: 'CUP',
        row: paramOrDefault(params, 0, 1),
        col: paramOrDefault(params, 1, 1),
      };

    case 'I':
      return { type: 'CHT', count: paramOrDefault(params, 0, 1) };

    // --- Erase ---
    case 'J':
      return { type: 'ED', mode: paramOrDefault(params, 0, 0) as EraseDisplayMode };

    case 'K':
      return { type: 'EL', mode: paramOrDefault(params, 0, 0) as EraseLineMode };

    // --- Insert/Delete Lines ---
    case 'L':
      return { type: 'IL', count: paramOrDefault(params, 0, 1) };

    case 'M':
      return { type: 'DL', count: paramOrDefault(params, 0, 1) };

    // --- Delete/Insert Characters ---
    case 'P':
      return { type: 'DCH', count: paramOrDefault(params, 0, 1) };

    case '@':
      return { type: 'ICH', count: paramOrDefault(params, 0, 1) };

    // --- Scrolling ---
    case 'S':
      return { type: 'SU', count: paramOrDefault(params, 0, 1) };

    case 'T':
      return { type: 'SD', count: paramOrDefault(params, 0, 1) };

    // --- Erase/Repeat ---
    case 'X':
      return { type: 'ECH', count: paramOrDefault(params, 0, 1) };

    case 'Z':
      return { type: 'CBT', count: paramOrDefault(params, 0, 1) };

    // --- Horizontal Position Relative ---
    case 'a':
      return { type: 'HPR', count: paramOrDefault(params, 0, 1) };

    // --- Repeat Character ---
    case 'b':
      return { type: 'REP', count: paramOrDefault(params, 0, 1) };

    // --- Device Attributes ---
    case 'c':
      if (prefix === '>') {
        return { type: 'DA2' };
      }
      if (prefix === '=') {
        return { type: 'DA3' };
      }
      return { type: 'DA1' };

    // --- Vertical Position Absolute ---
    case 'd':
      return { type: 'VPA', row: paramOrDefault(params, 0, 1) };

    // --- Vertical Position Relative ---
    case 'e':
      return { type: 'VPR', count: paramOrDefault(params, 0, 1) };

    // --- Tab Clear ---
    case 'g':
      return { type: 'TBC', mode: paramOrDefault(params, 0, 0) as TabClearMode };

    // --- Set Mode ---
    case 'h':
      return {
        type: 'SM',
        params: normalizeParams(params, 0),
        isPrivate: prefix === '?',
      };

    // --- Reset Mode ---
    case 'l':
      return {
        type: 'RM',
        params: normalizeParams(params, 0),
        isPrivate: prefix === '?',
      };

    // --- SGR / XTerm Modify Key ---
    case 'm':
      if (prefix === '>') {
        // XTerm modify key — treat as unknown for now; main use is SGR
        return { type: 'UNKNOWN', raw: seq };
      }
      return {
        type: 'SGR',
        params: params.length === 0 ? [0] : normalizeParams(params, 0),
      };

    // --- Device Status Report ---
    case 'n':
      return {
        type: 'DSR',
        param: paramOrDefault(params, 0, 0),
        isPrivate: prefix === '?',
      };

    // --- DECRQM ---
    case 'p':
      if (intermediates.includes('$')) {
        return {
          type: 'DECRQM',
          mode: paramOrDefault(params, 0, 0),
          isPrivate: prefix === '?',
        };
      }
      return { type: 'UNKNOWN', raw: seq };

    // --- XTVERSION / DECSCUSR / DECSCA ---
    case 'q':
      if (prefix === '>') {
        return { type: 'XTVERSION' };
      }
      if (intermediates.includes(' ')) {
        return {
          type: 'DECSCUSR',
          shape: paramOrDefault(params, 0, 0) as CursorShape,
        };
      }
      if (intermediates.includes('"')) {
        return {
          type: 'DECSCA',
          mode: paramOrDefault(params, 0, 0),
        };
      }
      return { type: 'UNKNOWN', raw: seq };

    // --- DECSTBM ---
    case 'r':
      if (prefix === '') {
        return {
          type: 'DECSTBM',
          top: paramOrDefault(params, 0, 1),
          bottom: paramOrDefault(params, 1, 0),
        };
      }
      return { type: 'UNKNOWN', raw: seq };

    // --- DECSLRM / DECSC ---
    case 's':
      if (prefix === '') {
        if (params.length >= 2) {
          return {
            type: 'DECSLRM',
            left: paramOrDefault(params, 0, 1),
            right: paramOrDefault(params, 1, 0),
          };
        }
        return { type: 'DECSC' };
      }
      return { type: 'UNKNOWN', raw: seq };

    // --- Window Manipulation ---
    case 't':
      return {
        type: 'XTWINOPS',
        params: normalizeParams(params, 0),
      };

    // --- DECRC / Kitty Keyboard ---
    case 'u':
      if (prefix === '?') {
        return { type: 'KITTY_KEYBOARD_QUERY' };
      }
      if (prefix === '>') {
        return { type: 'KITTY_KEYBOARD_PUSH', flags: paramOrDefault(params, 0, 0) };
      }
      if (prefix === '<') {
        return { type: 'KITTY_KEYBOARD_POP', count: paramOrDefault(params, 0, 1) };
      }
      if (prefix === '=') {
        return {
          type: 'KITTY_KEYBOARD_SET',
          flags: paramOrDefault(params, 0, 0),
          action: paramOrDefault(params, 1, 1),
        };
      }
      if (prefix === '' && intermediates === '') {
        return { type: 'DECRC' };
      }
      return { type: 'UNKNOWN', raw: seq };

    // --- VPA alias via 'k' ---
    case 'k':
      return { type: 'VPA', row: paramOrDefault(params, 0, 1) };

    // --- CUB alias via 'j' ---
    case 'j':
      return { type: 'CUB', count: paramOrDefault(params, 0, 1) };

    default:
      return { type: 'UNKNOWN', raw: seq };
  }
}
