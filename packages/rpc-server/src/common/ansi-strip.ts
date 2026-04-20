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
 * ANSI / VT control sequence stripping for agent-facing text output.
 *
 * Main-process terminal sessions emit raw PTY / SSH bytes which contain
 * escape sequences (colors, cursor motion, OSC, DCS, mode setting, bracketed
 * paste markers, BEL). AI agents do not need any of that, and the extra
 * bytes inflate token usage noticeably. This helper removes them while
 * preserving printable text.
 *
 * Scope: covers the sequences we actually see emitted by bash/zsh/fish on
 * common Linux / macOS shells. It is intentionally not a full VT emulator —
 * anything it misses ends up as literal text, never mis-decoded.
 */

/* eslint-disable no-control-regex -- matching ANSI/VT control sequences requires literal control chars */

const CSI_SEQUENCE = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const OSC_SEQUENCE_BEL = /\x1B\][\s\S]*?\x07/g;
const OSC_SEQUENCE_ST = /\x1B\][\s\S]*?\x1B\\/g;
const DCS_SEQUENCE = /\x1BP[\s\S]*?\x1B\\/g;
const SOS_PM_APC_SEQUENCE = /\x1B[X^_][\s\S]*?\x1B\\/g;
const SINGLE_CHAR_ESCAPE = /\x1B[=>()#\[\]%@][^a-zA-Z]*?/g;
const STANDALONE_ESC = /\x1B/g;
const BEL_OUTSIDE_OSC = /\x07/g;

/**
 * Strip ANSI / VT escape sequences and normalize line endings.
 *
 * CR handling:
 * - CRLF (`\r\n`) is a line ending — normalize to LF, do NOT treat the `\r`
 *   as an overwrite. This matters because PTY tty line discipline (`onlcr`)
 *   converts every `\n` to `\r\n` on its way to the master side, so *every*
 *   line of shell output contains a `\r\n`. Treating each `\r` as overwrite
 *   would wipe every line's real content.
 * - Lone `\r` (not followed by `\n`) — true overwrite semantics. Shells /
 *   progress meters use it to rewrite the current line in place. Keep only
 *   the text after the last lone `\r` on that line, matching what the user
 *   visually sees.
 */
export function stripAnsi(input: string): string {
  let out = input
    .replace(OSC_SEQUENCE_BEL, '')
    .replace(OSC_SEQUENCE_ST, '')
    .replace(DCS_SEQUENCE, '')
    .replace(SOS_PM_APC_SEQUENCE, '')
    .replace(CSI_SEQUENCE, '')
    .replace(SINGLE_CHAR_ESCAPE, '')
    .replace(STANDALONE_ESC, '')
    .replace(BEL_OUTSIDE_OSC, '');

  out = collapseCarriageReturns(out);
  return out;
}

function collapseCarriageReturns(input: string): string {
  if (!input.includes('\r')) {
    return input;
  }

  // Normalize CRLF first — the `\r` in `\r\n` is part of the line ending, not
  // an overwrite. Only lone `\r` means "cursor back to column 0, rewrite".
  const normalized = input.replace(/\r\n/g, '\n');
  if (!normalized.includes('\r')) {
    return normalized;
  }

  const lines = normalized.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes('\r')) {
      const segments = line.split('\r');
      lines[i] = segments[segments.length - 1];
    }
  }
  return lines.join('\n');
}
