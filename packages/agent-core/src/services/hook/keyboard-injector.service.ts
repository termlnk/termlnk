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

import type { IExternalAgentSession, IKeyboardInjectorService } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import process from 'node:process';
import { Disposable, ILogService, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Minimal surface of `@termlnk/macos-utils` that this service needs. Kept
 * local so the service can be unit-tested without the native binary and
 * so non-macOS builds don't require the binding to link.
 */
interface IMacosUtilsKeyboardAddon {
  checkAccessibilityTrusted: (prompt?: boolean) => boolean;
  injectKeysByTty: (ttyPath: string, sequence: string) => boolean;
  injectKeysByPid: (pid: number, sequence: string) => boolean;
}

/** How long to wait between permission re-checks (used by requestPermission). */
const TRUSTED_RECHECK_DELAY_MS = 200;

export class KeyboardInjectorService extends Disposable implements IKeyboardInjectorService {
  readonly supported: boolean;

  private readonly _trusted$ = new BehaviorSubject<boolean>(false);
  readonly trusted$: Observable<boolean> = this._trusted$.asObservable();

  private readonly _addon: IMacosUtilsKeyboardAddon | null;

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._addon = this._loadAddon();
    this.supported = this._addon !== null && process.platform === 'darwin';
    this.disposeWithMe(toDisposable(() => {
      this._trusted$.complete();
    }));
    // Do NOT probe AX trust at construction time: on macOS 26 calling
    // AXIsProcessTrusted{,WithOptions}(NULL) from the Electron main process
    // during DI bring-up crashes inside CoreFoundation (SIGSEGV in
    // CFGetTypeID) for ad-hoc signed bundles, taking down the whole app
    // before a window is ever shown. `_trusted$` stays false until the
    // first real injection or an explicit requestPermission() call.
  }

  async requestPermission(): Promise<boolean> {
    if (!this.supported || !this._addon) {
      return false;
    }
    // Prompt surfaces the system dialog the first time; subsequent calls
    // are cheap no-ops that simply re-check the trust bit.
    this._addon.checkAccessibilityTrusted(true);
    await new Promise<void>((r) => setTimeout(r, TRUSTED_RECHECK_DELAY_MS));
    const trusted = this._addon.checkAccessibilityTrusted(false);
    this._trusted$.next(trusted);
    return trusted;
  }

  async injectOption(session: IExternalAgentSession, optionIndex: number): Promise<boolean> {
    if (!this.supported || !this._addon) {
      return false;
    }
    if (optionIndex < 0 || !Number.isInteger(optionIndex)) {
      return false;
    }
    const tty = session.externalMeta?.tty;
    if (!tty) {
      this._logService.warn(
        '[KeyboardInjector]',
        `Session ${session.terminalSessionId} has no tty in externalMeta; cannot inject`
      );
      return false;
    }

    // Re-check trust on the hot path — the user may have toggled the
    // permission off since the service booted. Don't prompt here; that
    // belongs in requestPermission().
    const trusted = this._addon.checkAccessibilityTrusted(false);
    if (trusted !== this._trusted$.getValue()) {
      this._trusted$.next(trusted);
    }
    if (!trusted) {
      this._logService.warn(
        '[KeyboardInjector]',
        'Accessibility permission not granted; skipping injection'
      );
      return false;
    }

    const sequence = this._buildOptionSequence(optionIndex);
    try {
      const ok = this._addon.injectKeysByTty(tty, sequence);
      if (!ok) {
        this._logService.warn(
          '[KeyboardInjector]',
          `injectKeysByTty(${tty}) returned false — terminal app not found or permission denied`
        );
      }
      return ok;
    } catch (err) {
      this._logService.error('[KeyboardInjector]', 'injectKeysByTty threw:', err);
      return false;
    }
  }

  /**
   * Build the keystroke token sequence for selecting the Nth option in
   * Claude Code's CLI AskUserQuestion picker. The cursor starts on the
   * first option, so N `DOWN` keystrokes (0 for the top option) followed
   * by `ENTER` commit the choice. This mirrors what a keyboard user
   * would type and is stable across Claude Code terminal-renderer
   * updates — unlike digit-shortcut alternatives, which some releases
   * require modifiers for.
   */
  private _buildOptionSequence(optionIndex: number): string {
    const tokens: string[] = [];
    for (let i = 0; i < optionIndex; i++) {
      tokens.push('DOWN');
    }
    tokens.push('ENTER');
    return tokens.join(' ');
  }

  private _loadAddon(): IMacosUtilsKeyboardAddon | null {
    if (process.platform !== 'darwin') {
      return null;
    }
    try {
      // eslint-disable-next-line ts/no-require-imports
      const mod = require('@termlnk/macos-utils') as typeof import('@termlnk/macos-utils');
      if (typeof mod.checkAccessibilityTrusted !== 'function'
        || typeof mod.injectKeysByTty !== 'function'
        || typeof mod.injectKeysByPid !== 'function') {
        this._logService.warn(
          '[KeyboardInjector]',
          '@termlnk/macos-utils missing keyboard injection exports; feature disabled'
        );
        return null;
      }
      return {
        checkAccessibilityTrusted: mod.checkAccessibilityTrusted,
        injectKeysByTty: mod.injectKeysByTty,
        injectKeysByPid: mod.injectKeysByPid,
      };
    } catch (err) {
      this._logService.warn('[KeyboardInjector]', 'Failed to load @termlnk/macos-utils:', err);
      return null;
    }
  }
}
