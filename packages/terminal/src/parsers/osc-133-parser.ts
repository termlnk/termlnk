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
 * OSC 133 - Semantic Prompts (FinalTerm / freedesktop standard)
 *
 * Similar to OSC 633 (VS Code), but predates it and is more widely adopted.
 * Supported by bash 5.1+, zsh, and other modern shells by default.
 *
 * OSC 133 uses single-character action codes:
 * - A: Fresh line with new prompt (prompt start)
 * - B: Prompt end / start of user input area
 * - C: Command execution started
 * - D: Command finished (with optional exit code)
 * - L: Start of a secondary prompt (continuation)
 * - N: Start of output from the running command
 * - I: Start of input (alternative to B in some implementations)
 * - P: Property (key=value, same as OSC 633 P)
 *
 * Format: ESC ] 133 ; <action> [; args...] BEL
 */

export type Osc133ActionType = 'A' | 'B' | 'C' | 'D' | 'L' | 'N' | 'I' | 'P';

export interface IOsc133Event {
  type: Osc133ActionType;
}

export interface IOsc133PromptStartEvent extends IOsc133Event {
  type: 'A';
}

export interface IOsc133PromptEndEvent extends IOsc133Event {
  type: 'B';
}

export interface IOsc133CommandStartEvent extends IOsc133Event {
  type: 'C';
}

export interface IOsc133CommandEndEvent extends IOsc133Event {
  type: 'D';
  exitCode: number;
}

export interface IOsc133ContinuationPromptEvent extends IOsc133Event {
  type: 'L';
}

export interface IOsc133OutputStartEvent extends IOsc133Event {
  type: 'N';
}

export interface IOsc133InputStartEvent extends IOsc133Event {
  type: 'I';
}

export interface IOsc133PropertyEvent extends IOsc133Event {
  type: 'P';
  key: string;
  value: string;
}

export type Osc133Event =
  | IOsc133PromptStartEvent
  | IOsc133PromptEndEvent
  | IOsc133CommandStartEvent
  | IOsc133CommandEndEvent
  | IOsc133ContinuationPromptEvent
  | IOsc133OutputStartEvent
  | IOsc133InputStartEvent
  | IOsc133PropertyEvent;

/**
 * Parse OSC 133 data string into a structured event.
 *
 * @param data - The raw OSC 133 data (e.g., "A" or "D;0")
 * @returns The parsed event, or null if the data is invalid
 */
export function parseOsc133(data: string): Osc133Event | null {
  const [action, ...args] = data.split(';');

  switch (action as Osc133ActionType) {
    case 'A': {
      return { type: 'A' };
    }

    case 'B': {
      return { type: 'B' };
    }

    case 'C': {
      return { type: 'C' };
    }

    case 'D': {
      const exitCode = Number.parseInt(args[0] || '0', 10);
      return { type: 'D', exitCode };
    }

    case 'L': {
      return { type: 'L' };
    }

    case 'N': {
      return { type: 'N' };
    }

    case 'I': {
      return { type: 'I' };
    }

    case 'P': {
      const propData = args.join(';');
      const eqIndex = propData.indexOf('=');
      if (eqIndex <= 0) {
        return null;
      }
      const key = propData.slice(0, eqIndex);
      const value = propData.slice(eqIndex + 1);
      return { type: 'P', key, value };
    }

    default: {
      return null;
    }
  }
}
