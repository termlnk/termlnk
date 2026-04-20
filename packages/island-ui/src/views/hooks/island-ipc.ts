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
 * Island ↔ Main process IPC helpers.
 * Centralises all `ipcRenderer.send` calls so UI components stay
 * decoupled from the Electron transport layer.
 */

function send(channel: string, ...args: unknown[]): void {
  (window as any).electron?.ipcRenderer?.send(channel, ...args);
}

/** Toggle mouse-event pass-through on the island BrowserWindow. */
export function setIslandInteractive(interactive: boolean): void {
  send('island:set-interactive', interactive);
}
