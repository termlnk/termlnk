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
 * Types for shell integration without xterm.js dependencies.
 * These types use line numbers instead of IMarker for cross-environment compatibility.
 */

export interface ITerminalCommand {
  /** Unique identifier for the command */
  id: string;
  /** The command string that was executed */
  command: string;
  /**
   * Command output text. When produced by the main-process CommandBlockTracker
   * (shell integration path) this is ANSI-stripped clean text.
   */
  output: string;
  /** Exit code of the command */
  exitCode: number;
  /** Current working directory when command was executed */
  cwd: string;
  /** Starting line number */
  startLine: number | null;
  /** Ending line number */
  endLine: number | null;
  /** Timestamp information */
  timestamp: {
    start: number;
    end: number;
  };
  /** Duration in milliseconds */
  duration: number;
  /** Session ID this command belongs to */
  sessionId: string;
  /** Monotonically increasing sequence number within the session (main-process tracker) */
  seq?: number;
  /** Raw output with ANSI sequences preserved (optional; disabled by default to save memory) */
  outputRaw?: string;
  /** Total bytes of the captured raw output, before any truncation */
  outputTotalBytes?: number;
  /** Whether the output was truncated due to size limits */
  outputTruncated?: boolean;
  /** Whether this block was produced via shell integration (true) or heuristic fallback (false) */
  shellIntegrated?: boolean;
}

/** OSC 633 event types (includes Termlnk-private Q for natural-language queries) */
export type OscEventType = 'A' | 'B' | 'C' | 'D' | 'E' | 'P' | 'Q';

export interface IOscEvent {
  /**
   * Event type: A=PromptStart, B=PromptEnd, C=CommandStart, D=CommandEnd,
   * E=CommandLine, P=Property, Q=NaturalLanguageQuery (Termlnk private).
   */
  type: OscEventType;
  /** Event arguments */
  args: string[];
}
