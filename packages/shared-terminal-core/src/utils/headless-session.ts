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

import type { ITerminalAddon } from '@xterm/headless';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from '@xterm/headless';

/**
 * Per-session xterm-headless wrapper — holds the authoritative terminal state
 * and serialises on demand.
 *
 * See cloud-sync-architecture.md §5.3.
 *
 * Responsibilities:
 * - Accept PTY output bytes; xterm.js parses them into cursor / SGR /
 *   scrollback semantic state.
 * - `serialize()` returns an ANSI byte string a client can replay via
 *   `Terminal.write()`.
 * - `resize()` propagates driver-side resize events into the headless
 *   terminal's internal buffer.
 *
 * Boundary vs. `RingBuffer`:
 * - `HeadlessSession`: semantic state (cursor position, colors, alt-buffer,
 *   scrollback line count).
 * - `RingBuffer`: raw byte stream (preserves SGR boundaries so the last N
 *   bytes can be replayed).
 *
 * Out of scope:
 * - Concurrency. Used single-threaded in the main process.
 * - No attached-client state — that belongs to `PtyMultiplexer`.
 */
export class HeadlessSession {
  private readonly _terminal: Terminal;
  private readonly _serialize: SerializeAddon;

  constructor(opts: { cols: number; rows: number; scrollback?: number }) {
    this._terminal = new Terminal({
      cols: opts.cols,
      rows: opts.rows,
      scrollback: opts.scrollback ?? 1000,
      allowProposedApi: true,
    });
    this._serialize = new SerializeAddon();
    // SerializeAddon ships with the `ITerminalAddon` type from `@xterm/xterm`;
    // the headless variant has a structurally identical interface but TS sees
    // them as distinct. Runtime is compatible — the cast is standard practice
    // in the xterm.js ecosystem.
    this._terminal.loadAddon(this._serialize as unknown as ITerminalAddon);
  }

  get cols(): number {
    return this._terminal.cols;
  }

  get rows(): number {
    return this._terminal.rows;
  }

  write(chunk: Uint8Array): void {
    this._terminal.write(chunk);
  }

  resize(cols: number, rows: number): void {
    this._terminal.resize(cols, rows);
  }

  /**
   * Return the ANSI replay sequence for the current state.
   *
   * `Terminal.write` is parsed asynchronously (event-loop chunked), so any
   * pending writes must drain before serialization or we'd serialize an
   * intermediate state. Injecting a zero-length write gives us a flush
   * callback to await.
   */
  async serialize(scrollback?: number): Promise<string> {
    await new Promise<void>((resolve) => {
      this._terminal.write('', () => resolve());
    });
    return this._serialize.serialize({ scrollback });
  }

  dispose(): void {
    this._serialize.dispose();
    this._terminal.dispose();
  }
}
