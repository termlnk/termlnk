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
 * OSC Notification Parser
 *
 * Parses terminal notification escape sequences:
 * - OSC 9: iTerm2/Ghostty/Windows Terminal style
 * - OSC 99: Kitty style
 * - OSC 777: urxvt/foot style
 */

import type { ICreateNotificationParams } from '@termlnk/core';

/**
 * OSC notification types supported
 */
export type OscNotificationType = 9 | 99 | 777;

/**
 * Parsed OSC notification result
 */
export interface IOscNotificationResult {
  /** Whether parsing was successful */
  success: boolean;

  /** The parsed notification parameters (if success) */
  params?: ICreateNotificationParams;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Default notification parameters for terminal notifications
 */
const DEFAULT_TERMINAL_NOTIFICATION: Required<Pick<ICreateNotificationParams, 'source' | 'type' | 'priority'>> = {
  source: 'terminal',
  type: 'info',
  priority: 'normal',
};

/**
 * Create a successful parse result
 */
function createResult(
  title: string,
  body: string,
  priority?: ICreateNotificationParams['priority']
): IOscNotificationResult {
  return {
    success: true,
    params: {
      title,
      body,
      ...DEFAULT_TERMINAL_NOTIFICATION,
      ...(priority && { priority }),
    },
  };
}

/**
 * Create a failed parse result
 */
function createError(error: string): IOscNotificationResult {
  return { success: false, error };
}

/**
 * ConEmu OSC 9 subcommand range (1-12)
 *
 * Known subcommands (from ConEmu / Ghostty):
 * - 1: Sleep
 * - 2: Show notification message
 * - 3: Change tab title
 * - 4: Progress report
 * - 5: Wait for user input
 * - 6: Execute GUI macro
 * - 7: Run process
 * - 8: Output env variable
 * - 9: Report current working directory
 * - 10: xterm keyboard/output emulation
 * - 11: Comment/annotation
 * - 12: Mark prompt start
 */
const CONEMU_MIN_SUBCOMMAND = 1;
const CONEMU_MAX_SUBCOMMAND = 12;

/**
 * OSC 9 parser (iTerm2, Ghostty, Windows Terminal, ConEmu)
 *
 * Supports two formats:
 * - iTerm2 plain text: ESC ] 9 ; message BEL
 * - ConEmu subcommand: ESC ] 9 ; <digit> ; <payload> BEL
 *
 * Parsing strategy (following Ghostty):
 * If data starts with a ConEmu subcommand number (1-12) followed by ';',
 * treat as ConEmu. Only subcommand 2 produces a notification.
 * Otherwise, treat as iTerm2-style plain text notification.
 *
 * @see https://conemu.github.io/en/AnsiEscapeCodes.html#ConEmu_specific_OSC
 */
function parseOsc9(data: string): IOscNotificationResult {
  const normalized = data?.trim();

  if (!normalized) {
    return createError('Empty OSC 9 data');
  }

  // Check for ConEmu subcommand format: <integer(1-12)>;<payload>
  const semiIndex = normalized.indexOf(';');
  if (semiIndex > 0) {
    const prefix = normalized.substring(0, semiIndex);
    const subcommand = Number.parseInt(prefix, 10);
    if (
      prefix === String(subcommand)
      && subcommand >= CONEMU_MIN_SUBCOMMAND
      && subcommand <= CONEMU_MAX_SUBCOMMAND
    ) {
      return parseOsc9ConEmu(subcommand, normalized.substring(semiIndex + 1));
    }
  }

  // Check for bare ConEmu subcommand without payload (e.g., "5" for wait-input)
  const bareSubcommand = Number.parseInt(normalized, 10);
  if (
    normalized === String(bareSubcommand)
    && bareSubcommand >= CONEMU_MIN_SUBCOMMAND
    && bareSubcommand <= CONEMU_MAX_SUBCOMMAND
  ) {
    return createError(`Ignored ConEmu OSC 9 subcommand without payload: ${bareSubcommand}`);
  }

  // iTerm2-style plain text notification
  return createResult('Terminal Notification', normalized);
}

/**
 * Parse ConEmu OSC 9 subcommand
 *
 * Only subcommand 2 (show notification) produces a notification result.
 * All other subcommands return an error (non-notification).
 */
function parseOsc9ConEmu(subcommand: number, payload: string): IOscNotificationResult {
  if (subcommand === 2) {
    const message = payload.trim();
    if (!message) {
      return createError('Empty ConEmu notification message');
    }
    return createResult('Terminal Notification', message);
  }

  return createError(`Ignored ConEmu OSC 9 subcommand: ${subcommand}`);
}

/**
 * OSC 777 parser (urxvt, foot)
 *
 * Format: ESC ] 777 ; notify ; title ; body BEL
 * Example: \e]777;notify;My Title;My Message\a
 */
function parseOsc777(data: string): IOscNotificationResult {
  const parts = data.split(';');

  if (parts.length < 2) {
    return createError('Invalid OSC 777 format: insufficient parts');
  }

  const [subcommand, titlePart, ...bodyParts] = parts;

  // Only handle 'notify' subcommand
  if (subcommand !== 'notify') {
    return createError(`Unsupported OSC 777 subcommand: ${subcommand}`);
  }

  const title = titlePart?.trim() || 'Terminal Notification';
  const body = bodyParts.join(';').trim();

  return createResult(title, body);
}

/**
 * OSC 99 parser (Kitty)
 *
 * Format uses multiple sequences:
 * - ESC ] 99 ; i=id:d=0 ; title BEL/ST (start notification)
 * - ESC ] 99 ; i=id:d=1:p=body ; body BEL/ST (body part)
 *
 * This parser handles a simplified single-sequence format:
 * ESC ] 99 ; title ; body BEL
 *
 * And the key-value format:
 * ESC ] 99 ; i=1:d=0:title=MyTitle ; MyTitle BEL
 */
function parseOsc99(data: string): IOscNotificationResult {
  // Try key-value format first
  const kvResult = parseOsc99KeyValue(data);
  if (kvResult.success) {
    return kvResult;
  }

  // Fall back to simple format
  const parts = data.split(';');

  if (parts.length >= 2) {
    const title = parts[0].trim() || 'Terminal Notification';
    const body = parts.slice(1).join(';').trim();
    return createResult(title, body);
  }

  // Single part - use as body
  return createResult('Terminal Notification', data.trim());
}

/**
 * Parse Kitty-style key-value format
 * Example: i=1:d=0:title=Hello World
 */
function parseOsc99KeyValue(data: string): IOscNotificationResult {
  // Check if it looks like key-value format
  if (!data.includes('=') || !data.includes(':')) {
    return createError('Not a key-value format');
  }

  const params = parseKeyValuePairs(data);

  // Extract title and body from various kitty field names
  const title = params.title || params.t || '';
  let body = params.body || params.b || params.message || params.m || '';

  // If no explicit title/body, extract from remaining data after last colon
  if (!title && !body) {
    body = extractContentAfterLastColon(data);
  }

  const priority = parsePriority(params.urgency || params.u);

  return createResult(title || 'Terminal Notification', body, priority);
}

function parseKeyValuePairs(data: string): Record<string, string> {
  const params: Record<string, string> = {};
  const parts = data.split(':');

  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex > 0) {
      const key = part.substring(0, eqIndex).trim();
      const value = part.substring(eqIndex + 1).trim();
      params[key] = value;
    }
  }

  return params;
}

function extractContentAfterLastColon(data: string): string {
  const lastColon = data.lastIndexOf(':');
  if (lastColon <= 0) return '';

  const afterLastColon = data.substring(lastColon + 1).trim();
  const contentMatch = afterLastColon.match(/^[^=]+=(.+)$/);
  return contentMatch?.[1] || afterLastColon;
}

function parsePriority(urgency: string | undefined): ICreateNotificationParams['priority'] {
  if (urgency === 'critical' || urgency === 'high') return 'urgent';
  if (urgency === 'low') return 'low';
  return 'normal';
}

/**
 * Main OSC notification parser
 * Detects the OSC type and dispatches to appropriate parser
 *
 * @param oscNumber - The OSC number (9, 99, or 777)
 * @param data - The raw data after the OSC number and semicolon
 * @returns Parse result with notification parameters or error
 */
export function parseOscNotification(
  oscNumber: number,
  data: string
): IOscNotificationResult {
  switch (oscNumber) {
    case 9:
      return parseOsc9(data);
    case 99:
      return parseOsc99(data);
    case 777:
      return parseOsc777(data);
    default:
      return createError(`Unsupported OSC number: ${oscNumber}`);
  }
}

/**
 * Check if an OSC number is a notification OSC
 */
export function isOscNotification(oscNumber: number): boolean {
  return oscNumber === 9 || oscNumber === 99 || oscNumber === 777;
}

/**
 * Create an OSC handler callback for xterm.js
 *
 * Usage:
 * ```typescript
 * term.parser.registerOscHandler(9, createOscNotificationHandler((params) => {
 *   notificationService.notify(params);
 * }));
 * ```
 */
export function createOscNotificationHandler(
  onNotification: (params: ICreateNotificationParams) => void
): (data: string) => boolean {
  return (data: string) => {
    const result = parseOscNotification(9, data);
    if (result.success && result.params) {
      onNotification(result.params);
      return true;
    }
    return false;
  };
}

/**
 * Register all OSC notification handlers on an xterm.js terminal
 *
 * Usage:
 * ```typescript
 * const disposables = registerOscNotificationHandlers(term, (params) => {
 *   notificationService.notify(params);
 * });
 *
 * // Cleanup:
 * disposables.forEach(d => d.dispose());
 * ```
 */
export function registerOscNotificationHandlers(
  terminal: { parser: { registerOscHandler: (id: number, callback: (data: string) => boolean) => { dispose: () => void } } },
  onNotification: (params: ICreateNotificationParams, oscNumber: number) => void
): Array<{ dispose: () => void }> {
  const disposables: Array<{ dispose: () => void }> = [];
  const oscNumbers: OscNotificationType[] = [9, 99, 777];

  for (const oscNumber of oscNumbers) {
    const disposable = terminal.parser.registerOscHandler(oscNumber, (data: string) => {
      const result = parseOscNotification(oscNumber, data);
      if (result.success && result.params) {
        onNotification(result.params, oscNumber);
        return true;
      }
      return false;
    });

    disposables.push(disposable);
  }

  return disposables;
}
