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

import type { IConfigService } from '@termlnk/core';
import type { ITerminalInputConfig } from '@termlnk/terminal';
import { DEFAULT_TERMINAL_INPUT_CONFIG, TERMINAL_INPUT_CONFIG_KEY } from '@termlnk/terminal';
import { isShiftEnterKey } from './key-utils';
import { TerminalKeyIntent } from './terminal-input.service';

export interface IKeyEncodingPolicy {
  encode(intent: TerminalKeyIntent, event: KeyboardEvent): string | null;
}

export class DefaultKeyEncodingPolicy implements IKeyEncodingPolicy {
  encode(intent: TerminalKeyIntent, event: KeyboardEvent): string | null {
    switch (intent) {
      case TerminalKeyIntent.SendText:
        if (isShiftEnterKey(event)) return '\n';
        return null; // let xterm handle
      case TerminalKeyIntent.BypassToIME:
        return null; // browser handles
      case TerminalKeyIntent.SendControlSequence:
        return null; // xterm handles
      case TerminalKeyIntent.Ignore:
        return null;
    }
  }
}

export class ConfigurableKeyEncodingPolicy implements IKeyEncodingPolicy {
  private readonly _defaultPolicy = new DefaultKeyEncodingPolicy();

  constructor(private readonly _configService: IConfigService) {}

  encode(intent: TerminalKeyIntent, event: KeyboardEvent): string | null {
    const config = this._configService.getConfig<ITerminalInputConfig>(
      TERMINAL_INPUT_CONFIG_KEY,
      DEFAULT_TERMINAL_INPUT_CONFIG
    ) ?? DEFAULT_TERMINAL_INPUT_CONFIG;

    if (intent === TerminalKeyIntent.SendText && isShiftEnterKey(event)) {
      switch (config.shiftEnterBehavior) {
        case 'send-lf':
          return '\n';
        case 'send-crlf':
          return '\r\n';
        case 'protocol':
          return null; // let xterm/terminal protocol handle
        case 'inherit':
        default:
          return '\n';
      }
    }

    // All other intents — default behavior
    return this._defaultPolicy.encode(intent, event);
  }
}
