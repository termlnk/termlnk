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

export interface IOscSequence {
  oscNumber: number;
  data: string;
}

type OscParserState = 'ground' | 'escape' | 'osc-id' | 'osc-payload';

const DEFAULT_MAX_PAYLOAD_LENGTH = 8192;
const ESC = '\u001B';
const BEL = '\u0007';
const ST = '\\';

/**
 * Stateful OSC sequence parser for raw terminal output streams.
 *
 * This parser operates on decoded terminal chunks before they reach xterm,
 * which matches how native terminals like Ghostty handle OSC commands:
 * parse the VT stream first, then hand structured commands to the UI layer.
 */
export class OscSequenceStreamParser {
  private _state: OscParserState = 'ground';
  private _oscNumberBuffer = '';
  private _payload = '';
  private _skipNextStChar = false;

  constructor(private readonly _maxPayloadLength: number = DEFAULT_MAX_PAYLOAD_LENGTH) {

  }

  reset(): void {
    this._state = 'ground';
    this._oscNumberBuffer = '';
    this._payload = '';
    this._skipNextStChar = false;
  }

  feed(chunk: string): IOscSequence[] {
    const result: IOscSequence[] = [];

    for (let i = 0; i < chunk.length; i += 1) {
      const ch = chunk[i];

      if (this._skipNextStChar) {
        this._skipNextStChar = false;
        if (ch === ST) {
          continue;
        }
      }

      switch (this._state) {
        case 'ground':
          if (ch === ESC) {
            this._state = 'escape';
          }
          break;

        case 'escape':
          if (ch === ']') {
            this._state = 'osc-id';
            this._oscNumberBuffer = '';
            this._payload = '';
          } else if (ch === ESC) {
            this._state = 'escape';
          } else {
            this._state = 'ground';
          }
          break;

        case 'osc-id':
          if (ch >= '0' && ch <= '9') {
            this._oscNumberBuffer += ch;
          } else if (ch === ';' && this._oscNumberBuffer.length > 0) {
            this._state = 'osc-payload';
          } else if (ch === ESC) {
            this._state = 'escape';
            this._oscNumberBuffer = '';
          } else {
            this.reset();
          }
          break;

        case 'osc-payload':
          if (ch === BEL) {
            this._emit(result);
          } else if (ch === ESC) {
            this._emit(result);
            this._skipNextStChar = true;
          } else {
            if (this._payload.length < this._maxPayloadLength) {
              this._payload += ch;
            }
          }
          break;
      }
    }

    return result;
  }

  private _emit(result: IOscSequence[]): void {
    const oscNumber = Number.parseInt(this._oscNumberBuffer, 10);
    if (Number.isFinite(oscNumber)) {
      result.push({
        oscNumber,
        data: this._payload,
      });
    }

    this._state = 'ground';
    this._oscNumberBuffer = '';
    this._payload = '';
  }
}
