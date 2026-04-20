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

export interface IDcsSequence {
  /** The raw data between DCS introducer and ST */
  data: string;
  /** The intermediates/prefix bytes if any */
  intermediates: string;
}

/**
 * Stateful DCS sequence parser for raw terminal output streams.
 *
 * Extracts DCS sequences delimited by:
 * - Start: ESC P
 * - End: ST (ESC \) or BEL
 */
export class DcsStreamParser {
  private _state: 'ground' | 'escape' | 'dcs-data' | 'dcs-escape' = 'ground';
  private _data = '';
  private _intermediates = '';
  private readonly _maxPayloadLength: number;

  constructor(maxPayloadLength: number = 8192) {
    this._maxPayloadLength = maxPayloadLength;
  }

  reset(): void {
    this._state = 'ground';
    this._data = '';
    this._intermediates = '';
  }

  feed(chunk: string): IDcsSequence[] {
    const result: IDcsSequence[] = [];

    for (let i = 0; i < chunk.length; i += 1) {
      const ch = chunk[i];

      switch (this._state) {
        case 'ground':
          if (ch === '\x1B') {
            this._state = 'escape';
          }
          break;

        case 'escape':
          if (ch === 'P') {
            this._state = 'dcs-data';
            this._data = '';
            this._intermediates = '';
          } else if (ch === '\x1B') {
            // Stay in escape state
          } else {
            this._state = 'ground';
          }
          break;

        case 'dcs-data':
          if (ch === '\x1B') {
            this._state = 'dcs-escape';
          } else if (ch === '\x07') {
            // BEL terminator
            this._emit(result);
          } else {
            if (this._data.length < this._maxPayloadLength) {
              this._data += ch;
            }
          }
          break;

        case 'dcs-escape':
          if (ch === '\\') {
            // ST terminator (ESC \)
            this._emit(result);
          } else if (ch === '\x1B') {
            // Another ESC - stay in dcs-escape
          } else {
            // Not a valid terminator, add ESC and char to data
            if (this._data.length < this._maxPayloadLength) {
              this._data += '\x1B';
              this._data += ch;
            }
            this._state = 'dcs-data';
          }
          break;
      }
    }

    return result;
  }

  private _emit(result: IDcsSequence[]): void {
    result.push({
      data: this._data,
      intermediates: this._intermediates,
    });
    this._state = 'ground';
    this._data = '';
    this._intermediates = '';
  }
}
