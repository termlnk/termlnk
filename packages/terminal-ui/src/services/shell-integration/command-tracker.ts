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

import type { ITerminalCommand } from '@termlnk/terminal';
import type { IMarker, Terminal } from '@xterm/xterm';
import { generateRandomId } from '@termlnk/core';

/** Decodes hex-encoded characters in command line (e.g., \x20 -> space) */
function decodeHexEncodedString(input: string): string {
  return input.replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)));
}

/** Extracts command text after common shell prompt characters */
function extractCommandFromLine(lineText: string): string {
  const match = lineText.match(/^.*?[$#>%]\s*(.*)/);
  return match ? match[1] : lineText;
}

/** Tracks command execution state using OSC 633 shell integration markers */
export class CommandTracker {
  private _promptStartMarker: IMarker | null = null;
  private _commandStartMarker: IMarker | null = null;
  private _commandLine = '';
  private _commandStartTime = 0;
  private _isExecuting = false;
  private _currentCwd = '';

  constructor(
    private readonly _terminal: Terminal,
    private readonly _sessionId: string
  ) {}

  get isExecuting(): boolean {
    return this._isExecuting;
  }

  get currentCwd(): string {
    return this._currentCwd;
  }

  onPromptStart(): IMarker | null {
    this._promptStartMarker = this._terminal.registerMarker(0);
    this._isExecuting = false;
    return this._promptStartMarker;
  }

  onPromptEnd(): void {
    // Prompt rendering is complete; user input area starts
  }

  onCommandStart(): void {
    this._commandStartMarker = this._terminal.registerMarker(0);
    this._commandStartTime = Date.now();
    this._isExecuting = true;
    // Try to read the command from the current line if E wasn't sent
    if (!this._commandLine) {
      this._commandLine = this._readCurrentLine();
    }
  }

  setCommandLine(commandLine: string): void {
    this._commandLine = decodeHexEncodedString(commandLine);
  }

  setProperty(key: string, value: string): void {
    if (key === 'Cwd') {
      this._currentCwd = value;
    }
  }

  onCommandEnd(exitCode: number): ITerminalCommand | null {
    if (!this._isExecuting && !this._commandStartMarker) {
      return null;
    }

    const endMarker = this._terminal.registerMarker(0);
    const now = Date.now();

    const output = this._readOutputBetweenMarkers(this._commandStartMarker, endMarker);

    const command: ITerminalCommand = {
      id: generateRandomId(),
      command: this._commandLine.trim(),
      output,
      exitCode,
      cwd: this._currentCwd,
      startLine: this._promptStartMarker?.line ?? null,
      endLine: endMarker?.line ?? null,
      timestamp: {
        start: this._commandStartTime || now,
        end: now,
      },
      duration: this._commandStartTime ? now - this._commandStartTime : 0,
      sessionId: this._sessionId,
    };

    // Reset state
    this._commandLine = '';
    this._commandStartMarker = null;
    this._commandStartTime = 0;
    this._isExecuting = false;

    return command;
  }

  private _readCurrentLine(): string {
    const buffer = this._terminal.buffer.active;
    const line = buffer.getLine(buffer.cursorY + buffer.baseY);
    if (!line) {
      return '';
    }

    const text = line.translateToString(true);
    return extractCommandFromLine(text);
  }

  private _readOutputBetweenMarkers(startMarker: IMarker | null, endMarker: IMarker | null): string {
    if (!startMarker || !endMarker) return '';

    const buffer = this._terminal.buffer.active;
    const startLine = startMarker.line + 1; // Skip the command line itself
    const endLine = endMarker.line;
    const lines: string[] = [];

    for (let y = startLine; y < endLine; y++) {
      const line = buffer.getLine(y);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    return lines.join('\n');
  }
}
