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

export const LANGUAGE_DEFAULT = 'en';

let _isWindows = false;
let _isMacintosh = false;
let _isLinux = false;
let _isLinuxSnap = false;
let _isNative = false;
let _isWeb = false;
let _isElectron = false;
let _isIOS = false;
let _isCI = false;
let _isMobile = false;
let _locale: string | undefined;
let _userAgent: string | undefined;

export interface IProcessEnvironment {
  [key: string]: string | undefined;
}

/**
 * This interface is intentionally not identical to node.js
 * process because it also works in sandboxed environments
 * where the process object is implemented differently. We
 * define the properties here that we need for `platform`
 * to work and nothing else.
 */
export interface INodeProcess {
  platform: string;
  arch: string;
  env: IProcessEnvironment;
  versions?: {
    node?: string;
    electron?: string;
    chrome?: string;
  };
  type?: string;
  cwd: () => string;
}

declare const process: INodeProcess;

// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
const $globalThis: any = globalThis;

let nodeProcess: INodeProcess | undefined;
if (typeof $globalThis.vscode !== 'undefined' && typeof $globalThis.vscode.process !== 'undefined') {
  // Native environment (sandboxed)
  nodeProcess = $globalThis.vscode.process;
} else if (typeof process !== 'undefined' && typeof process?.versions?.node === 'string') {
  // Native environment (non-sandboxed)
  nodeProcess = process;
}

const isElectronProcess = typeof nodeProcess?.versions?.electron === 'string';
const isElectronRenderer = isElectronProcess && nodeProcess?.type === 'renderer';

interface INavigator {
  userAgent: string;
  maxTouchPoints?: number;
  language: string;
}
declare const navigator: INavigator;

if (typeof nodeProcess === 'object') {
  // Native environment
  _isWindows = (nodeProcess.platform === 'win32');
  _isMacintosh = (nodeProcess.platform === 'darwin');
  _isLinux = (nodeProcess.platform === 'linux');
  _isLinuxSnap = _isLinux && !!nodeProcess.env.SNAP && !!nodeProcess.env.SNAP_REVISION;
  _isElectron = isElectronProcess;
  _isCI = !!nodeProcess.env.CI || !!nodeProcess.env.BUILD_ARTIFACTSTAGINGDIRECTORY || !!nodeProcess.env.GITHUB_WORKSPACE;
  _locale = LANGUAGE_DEFAULT;
  _isNative = true;
} else if (typeof navigator === 'object' && !isElectronRenderer) {
  // Web environment
  _userAgent = navigator.userAgent;
  _isWindows = _userAgent.includes('Windows');
  _isMacintosh = _userAgent.includes('Macintosh');
  _isIOS = (_userAgent.includes('Macintosh') || _userAgent.includes('iPad') || _userAgent.includes('iPhone')) && !!navigator.maxTouchPoints && navigator.maxTouchPoints > 0;
  _isLinux = _userAgent.includes('Linux');
  _isMobile = _userAgent?.indexOf('Mobi') >= 0;
  _isWeb = true;
  _locale = navigator.language.toLowerCase();
} else {
  // Unknown environment
  console.error('Unable to resolve platform.');
}

export enum Platform {
  Web,
  Mac,
  Linux,
  Windows,
}
export type PlatformName = 'Web' | 'Windows' | 'Mac' | 'Linux';

export function PlatformToString(platform: Platform): PlatformName {
  switch (platform) {
    case Platform.Web: return 'Web';
    case Platform.Mac: return 'Mac';
    case Platform.Linux: return 'Linux';
    case Platform.Windows: return 'Windows';
  }
}

let _platform: Platform = Platform.Web;
if (_isMacintosh) {
  _platform = Platform.Mac;
} else if (_isWindows) {
  _platform = Platform.Windows;
} else if (_isLinux) {
  _platform = Platform.Linux;
}

export const isWindows = _isWindows;
export const isMacintosh = _isMacintosh;
export const isLinux = _isLinux;
export const isLinuxSnap = _isLinuxSnap;
export const isNative = _isNative;
export const isElectron = _isElectron;
export const isWeb = _isWeb;
export const isWebWorker = (_isWeb && typeof $globalThis.importScripts === 'function');
export const webWorkerOrigin = isWebWorker ? $globalThis.origin : undefined;
export const isIOS = _isIOS;
export const isMobile = _isMobile;
export const isCI = _isCI; // Whether we run inside a CI environment, such as GH actions or Azure Pipelines.
export const platform = _platform;
export const userAgent = _userAgent;
export const locale = _locale;

export const setTimeout0IsFaster = (typeof $globalThis.postMessage === 'function' && !$globalThis.importScripts);

/**
 * See https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#:~:text=than%204%2C%20then-,set%20timeout%20to%204,-.
 *
 * Works similarly to `setTimeout(0)` but doesn't suffer from the 4ms artificial delay
 * that browsers set when the nesting level is > 5.
 */
export const setTimeout0 = (() => {
  if (setTimeout0IsFaster) {
    interface IQueueElement {
      id: number;
      callback: () => void;
    }
    const pending: IQueueElement[] = [];

    $globalThis.addEventListener('message', (e: any) => {
      if (e.data && e.data.vscodeScheduleAsyncWork) {
        for (let i = 0, len = pending.length; i < len; i++) {
          const candidate = pending[i];
          if (candidate.id === e.data.vscodeScheduleAsyncWork) {
            pending.splice(i, 1);
            candidate.callback();
            return;
          }
        }
      }
    });
    let lastId = 0;
    return (callback: () => void) => {
      const myId = ++lastId;
      pending.push({
        id: myId,
        callback,
      });
      $globalThis.postMessage({ vscodeScheduleAsyncWork: myId }, '*');
    };
  }
  return (callback: () => void) => setTimeout(callback);
})();

export enum OperatingSystem {
  Windows = 1,
  Macintosh = 2,
  Linux = 3,
}
export const OS = (_isMacintosh || _isIOS ? OperatingSystem.Macintosh : (_isWindows ? OperatingSystem.Windows : OperatingSystem.Linux));

export const isChrome = !!(userAgent && userAgent.includes('Chrome'));
export const isFirefox = !!(userAgent && userAgent.includes('Firefox'));
export const isSafari = !!(!isChrome && (userAgent && userAgent.includes('Safari')));
export const isEdge = !!(userAgent && userAgent.includes('Edg/'));
export const isAndroid = !!(userAgent && userAgent.includes('Android'));
