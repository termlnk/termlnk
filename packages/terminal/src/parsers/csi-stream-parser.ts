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
 * Represents a parsed CSI (Control Sequence Introducer) sequence
 * extracted from a raw terminal data stream.
 */
export interface ICsiSequence {
  /** Parameter values (semicolon-separated). -1 means default/absent. */
  params: number[];
  /** Intermediate bytes (space, $, ", ', etc.) */
  intermediates: string;
  /** Private parameter prefix (?, >, <, =, !) */
  prefix: string;
  /** Final byte (the command character) */
  final: string;
}

type CsiParserState =
  | 'ground'
  | 'escape'
  | 'csi-entry'
  | 'csi-param'
  | 'csi-intermediate';

const ESC = '\u001B';
const DEFAULT_MAX_PARAMS = 16;

/**
 * Returns true if the character code is a CSI private parameter prefix.
 */
function isPrivatePrefix(ch: string): boolean {
  return ch === '?' || ch === '>' || ch === '<' || ch === '=' || ch === '!';
}

/**
 * Returns true if the character is a valid parameter byte (digit, semicolon, or colon).
 */
function isParamByte(ch: string): boolean {
  return (ch >= '0' && ch <= '9') || ch === ';' || ch === ':';
}

/**
 * Returns true if the character is a valid intermediate byte (0x20-0x2F).
 */
function isIntermediateByte(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x20 && code <= 0x2F;
}

/**
 * Returns true if the character is a valid CSI final byte (0x40-0x7E).
 */
function isFinalByte(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x40 && code <= 0x7E;
}

/**
 * Stateful CSI sequence parser for raw terminal output streams.
 *
 * This parser operates as a finite state machine that extracts CSI sequences
 * from decoded terminal chunks. It handles the full CSI grammar including
 * private parameter prefixes, intermediate bytes, and parameter sub-separation
 * with colons.
 *
 * State machine: ground -> escape -> csi-entry -> csi-param -> csi-intermediate -> (emit on final byte)
 */
export class CsiStreamParser {
  private _state: CsiParserState = 'ground';
  private _prefix = '';
  private _paramBuffer = '';
  private _intermediates = '';
  private _maxParams: number;

  constructor(maxParams: number = DEFAULT_MAX_PARAMS) {
    this._maxParams = maxParams;
  }

  /** Reset the parser to its initial state, discarding any partial sequence. */
  reset(): void {
    this._state = 'ground';
    this._prefix = '';
    this._paramBuffer = '';
    this._intermediates = '';
  }

  /**
   * Feed a chunk of terminal data into the parser.
   *
   * @param chunk - Raw terminal output string to parse.
   * @returns An array of complete CSI sequences found in the chunk.
   */
  feed(chunk: string): ICsiSequence[] {
    const result: ICsiSequence[] = [];

    for (let i = 0; i < chunk.length; i += 1) {
      const ch = chunk[i];

      switch (this._state) {
        case 'ground':
          if (ch === ESC) {
            this._state = 'escape';
          }
          break;

        case 'escape':
          if (ch === '[') {
            this._state = 'csi-entry';
            this._prefix = '';
            this._paramBuffer = '';
            this._intermediates = '';
          } else if (ch === ESC) {
            // Stay in escape state for consecutive ESC
            this._state = 'escape';
          } else {
            this._state = 'ground';
          }
          break;

        case 'csi-entry':
          if (isPrivatePrefix(ch)) {
            this._prefix = ch;
            this._state = 'csi-param';
          } else if (isParamByte(ch)) {
            this._paramBuffer += ch;
            this._state = 'csi-param';
          } else if (isIntermediateByte(ch)) {
            this._intermediates += ch;
            this._state = 'csi-intermediate';
          } else if (isFinalByte(ch)) {
            this._emit(ch, result);
          } else {
            this.reset();
          }
          break;

        case 'csi-param':
          if (isParamByte(ch)) {
            this._paramBuffer += ch;
          } else if (isIntermediateByte(ch)) {
            this._intermediates += ch;
            this._state = 'csi-intermediate';
          } else if (isFinalByte(ch)) {
            this._emit(ch, result);
          } else {
            this.reset();
          }
          break;

        case 'csi-intermediate':
          if (isIntermediateByte(ch)) {
            this._intermediates += ch;
          } else if (isFinalByte(ch)) {
            this._emit(ch, result);
          } else {
            this.reset();
          }
          break;
      }
    }

    return result;
  }

  /**
   * Parse the accumulated parameter buffer into an array of numeric values.
   * Empty/missing parameters are represented as -1.
   */
  private _parseParams(): number[] {
    if (this._paramBuffer.length === 0) {
      return [];
    }

    const parts = this._paramBuffer.split(';');
    const params: number[] = [];

    for (let i = 0; i < parts.length && i < this._maxParams; i += 1) {
      const part = parts[i];
      if (part.length === 0) {
        params.push(-1);
      } else {
        const num = Number.parseInt(part, 10);
        params.push(Number.isFinite(num) ? num : -1);
      }
    }

    return params;
  }

  /** Emit a completed CSI sequence and reset state. */
  private _emit(finalByte: string, result: ICsiSequence[]): void {
    result.push({
      params: this._parseParams(),
      intermediates: this._intermediates,
      prefix: this._prefix,
      final: finalByte,
    });

    this._state = 'ground';
    this._prefix = '';
    this._paramBuffer = '';
    this._intermediates = '';
  }
}
