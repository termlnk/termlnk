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

import process from 'process';
import { electronAPI } from '@electron-toolkit/preload';
import { exposeElectronTRPC } from '@janwirth/electron-trpc-link/main';
import { contextBridge, ipcRenderer, shell, webUtils } from 'electron';

// Expose electron-trpc for tRPC communication
process.once('loaded', async () => {
  exposeElectronTRPC();
});

const nativeFileUtils = {
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
};

const nativeShell = {
  openExternal: (url: string) => shell.openExternal(url),
};

// Boot channel: renderer calls `window.__TERMLNK_BOOT__.getUIConfig()` before
// creating Core so the initial theme reflects the persisted user preference
// (avoids the default -> stored flash on cold start). See bootstrap.ts.
const termlnkBoot = {
  getUIConfig: (): Promise<unknown> => ipcRenderer.invoke('termlnk:boot-ui-config'),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('nativeFileUtils', nativeFileUtils);
    contextBridge.exposeInMainWorld('nativeShell', nativeShell);
    contextBridge.exposeInMainWorld('__TERMLNK_BOOT__', termlnkBoot);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.nativeFileUtils = nativeFileUtils;
  // @ts-ignore (define in dts)
  window.nativeShell = nativeShell;
  // @ts-ignore (define in dts)
  window.__TERMLNK_BOOT__ = termlnkBoot;
}
