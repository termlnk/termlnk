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

import { createIdentifier } from '@termlnk/core';

/**
 * IBrowserFileTransferService — capability that lets SFTP UI exchange files
 * directly with the *browser* host (the operator's laptop) rather than the
 * server-side filesystem. Only registered by `@termlnk/web-renderer` for
 * termlnk-web; on Electron the desktop's dual-pane layout already handles
 * local FS via `localFs` RPC, so this DI token is left unbound.
 *
 * The presence of this service is the signal SFTPPage uses to switch into
 * single-pane mode: the user's expectation in termlnk-web is that "local"
 * means *their machine*, not the VPS hosting termlnk-web. Hiding LocalFilePane
 * keeps the architectural promise that "in termlnk-web there is no local
 * side" honest.
 *
 * Implementation contract:
 * - `uploadFromBrowser` opens the browser file picker, reads each picked
 *   file, and writes it to `remoteDirPath` over the existing sftp router.
 *   v1 uses sftp.writeFile (full base64 payload per file); chunked / streamed
 *   uploads land in a follow-up once the sftp router grows a stream-write
 *   procedure.
 * - `downloadToBrowser` reads `remotePath` over sftp.readFile and triggers
 *   a browser download via `<a download>` against a Blob URL. Same v1 size
 *   constraint as upload.
 *
 * Errors surface as rejected promises so the calling component can show
 * inline feedback; transient progress is intentionally NOT propagated through
 * `transferProgress$` because that stream is server-driven (SFTP layer) and
 * the browser-side leg is not visible to the server.
 */
export interface IBrowserFileTransferService {
  /**
   * Open the browser file picker, then upload each selected file to
   * `remoteDirPath` using the same `sessionId` SFTP UI is connected to.
   * Resolves with the names of the files actually uploaded (may be empty if
   * the user cancelled the picker).
   */
  uploadFromBrowser(sessionId: string, remoteDirPath: string): Promise<string[]>;

  /**
   * Read `remotePath` from the SFTP host and trigger a browser download
   * named `suggestedFileName`. Resolves once the browser has been handed
   * the Blob URL (the download itself is async from the browser's POV).
   */
  downloadToBrowser(sessionId: string, remotePath: string, suggestedFileName: string): Promise<void>;
}

export const IBrowserFileTransferService = createIdentifier<IBrowserFileTransferService>(
  'sftp-ui.browser-file-transfer.service'
);
