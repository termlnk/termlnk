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

export function getSystemType(): string {
  const sUserAgent = navigator.userAgent;
  const isWin = navigator.platform === 'Win32' || navigator.platform === 'Windows';
  const isMac = navigator.platform === 'Mac68K' || navigator.platform === 'MacPPC' || navigator.platform === 'Macintosh' || navigator.platform === 'MacIntel';
  if (isMac) {
    return 'Mac';
  }
  const isUnix = navigator.platform === 'X11' && !isWin && !isMac;
  if (isUnix) {
    return 'Unix';
  }
  const isLinux = String(navigator.platform).includes('Linux');
  if (isLinux) {
    return 'Linux';
  }
  if (isWin) {
    const isWin2K = sUserAgent.includes('Windows NT 5.0') || sUserAgent.includes('Windows 2000');
    if (isWin2K) {
      return 'Windows 2000';
    }
    const isWinXP = sUserAgent.includes('Windows NT 5.1') || sUserAgent.includes('Windows XP');
    if (isWinXP) {
      return 'Windows XP';
    }
    const isWin2003 = sUserAgent.includes('Windows NT 5.2') || sUserAgent.includes('Windows 2003');
    if (isWin2003) {
      return 'Windows 2003';
    }
    const isWinVista = sUserAgent.includes('Windows NT 6.0') || sUserAgent.includes('Windows Vista');
    if (isWinVista) {
      return 'Windows Vista';
    }
    const isWin7 = sUserAgent.includes('Windows NT 6.1') || sUserAgent.includes('Windows 7');
    if (isWin7) {
      return 'Windows 7';
    }
    const isWin10 = sUserAgent.includes('Windows NT 10') || sUserAgent.includes('Windows 10');
    if (isWin10) {
      return 'Windows 10';
    }
    const isWin11 = sUserAgent.includes('Windows NT 11') || sUserAgent.includes('Windows 11');
    if (isWin11) {
      return 'Windows 11';
    }
  }
  return 'Unknown system';
}

export function getBrowserType(): string {
  const userAgent = navigator.userAgent;
  const isOpera = userAgent.includes('Opera');
  const isIE = userAgent.includes('compatible') && userAgent.includes('MSIE') && !isOpera;
  const isIE11 = userAgent.includes('Trident') && userAgent.includes('rv:11.0');
  const isEdge = userAgent.includes('Edge');
  const isFF = userAgent.includes('Firefox');
  const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
  const isChrome = userAgent.includes('Chrome') && userAgent.includes('Safari');
  if (isIE) {
    const reIE = new RegExp('MSIE (\\d+\\.\\d+);');
    reIE.test(userAgent);
    const fIEVersion = Number.parseFloat(RegExp.$1);
    if (fIEVersion === 7) {
      return 'IE7';
    }
    if (fIEVersion === 8) {
      return 'IE8';
    }
    if (fIEVersion === 9) {
      return 'IE9';
    }
    if (fIEVersion === 10) {
      return 'IE10';
    }
    return '0';
  }
  if (isFF) {
    return 'FF';
  }
  if (isOpera) {
    return 'Opera';
  }
  if (isSafari) {
    return 'Safari';
  }
  if (isChrome) {
    return 'Chrome';
  }
  if (isEdge) {
    return 'Edge';
  }
  if (isIE11) {
    return 'IE11';
  }
  return 'Unknown browser';
}

export function getLanguage(): string {
  const defaultValue = 'en-US';
  if (globalThis.navigator) {
    return (navigator.languages && navigator.languages[0]) || navigator.language || defaultValue;
  }
  return defaultValue;
}

export function isTablet(): boolean {
  return /ipad|android|android 3.0|xoom|sch-i800|playbook|tablet|kindle/i.test(navigator.userAgent.toLowerCase());
}

export function isWeChat(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return String(userAgent.match(/MicroMessenger/i)) === 'micromessenger' ? !0 : !1;
}

export function isIPhone(): boolean {
  return /iPhone/i.test(navigator.userAgent);
}
