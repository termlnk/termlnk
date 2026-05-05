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

import type { ITerminalCommand } from '../models/shell-integration';

/**
 * OSC 633 event types.
 *
 * A/B/C/D/E/P are defined by VS Code's shell integration spec.
 * Q is a Termlnk-private extension used to carry natural-language queries
 * intercepted by the shell before execution (e.g. zsh `accept-line` widget
 * captures `# <query>` and emits OSC 633;Q;<base64>).
 */
export type Osc633EventType = 'A' | 'B' | 'C' | 'D' | 'E' | 'P' | 'Q';

/** Base interface for all OSC 633 events */
export interface IOsc633Event {
  /**
   * Event type:
   * A=PromptStart, B=PromptEnd, C=CommandStart, D=CommandEnd,
   * E=CommandLine, P=Property, Q=NaturalLanguageQuery (Termlnk private)
   */
  type: Osc633EventType;
}

/** Prompt start event */
export interface IPromptStartEvent extends IOsc633Event {
  type: 'A';
}

/** Prompt end event */
export interface IPromptEndEvent extends IOsc633Event {
  type: 'B';
}

/** Command start event */
export interface ICommandStartEvent extends IOsc633Event {
  type: 'C';
}

/** Command end event */
export interface ICommandEndEvent extends IOsc633Event {
  type: 'D';
  exitCode: number;
  command: ITerminalCommand | null;
}

/** Command line event */
export interface ICommandLineEvent extends IOsc633Event {
  type: 'E';
  commandLine: string;
}

/** Property event */
export interface IPropertyEvent extends IOsc633Event {
  type: 'P';
  key: string;
  value: string;
}

/**
 * Natural-language query event (Termlnk private extension).
 * Payload format: `Q;<base64>` where the decoded payload is a UTF-8 query string
 * captured by the shell's accept-line interception (e.g. user typed `# list big files`).
 */
export interface INaturalLanguageQueryEvent extends IOsc633Event {
  type: 'Q';
  query: string;
}

/** Union type of all OSC 633 events */
export type Osc633Event =
  | IPromptStartEvent
  | IPromptEndEvent
  | ICommandStartEvent
  | ICommandEndEvent
  | ICommandLineEvent
  | IPropertyEvent
  | INaturalLanguageQueryEvent;

/**
 * Parse OSC 633 data string into a structured event.
 * @param data - The raw OSC 633 data (e.g., "A;" or "D;0")
 * @returns The parsed event, or null if the data is invalid
 */
export function parseOsc633(data: string): Osc633Event | null {
  const [type, ...args] = data.split(';');

  switch (type as Osc633EventType) {
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
      return { type: 'D', exitCode, command: null };
    }

    case 'E': {
      const commandLine = args.join(';');
      return { type: 'E', commandLine };
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

    case 'Q': {
      const encoded = args.join(';');
      if (!encoded) {
        return null;
      }
      const query = decodeBase64Utf8(encoded);
      if (query === null) {
        return null;
      }
      return { type: 'Q', query };
    }

    default: {
      return null;
    }
  }
}

/**
 * Decode a base64-encoded UTF-8 string. Returns null on malformed input.
 * Works in both Node and browser-like environments without a Buffer dep.
 */
function decodeBase64Utf8(encoded: string): string | null {
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}
