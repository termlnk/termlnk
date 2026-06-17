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

import { Disposable, toDisposable } from '@termlnk/core';

/** Keep the compositor producing frames for this long after the last input. */
const WARMUP_DURATION_MS = 250;

/**
 * Eliminates first-frame animation hitching after a foreground page goes idle.
 *
 * Chromium stops producing compositor frames when an idle foreground page has no
 * animation; the first animation after idle must ramp the frame scheduler back
 * up, dropping a frame or two — the stutter users see on the first dialog open /
 * island expand. A bare always-on rAF loop confirmed this (warm loop => no
 * stutter) but would burn power on this always-resident app. Instead we keep the
 * compositor warm only briefly after each user input, since animations are
 * virtually always input-triggered; idle (no input) throttles normally.
 *
 * Instantiated by ElectronRendererPlugin, so it runs in BOTH renderer processes
 * (main window + island) without per-component wiring.
 */
export class CompositorWarmupController extends Disposable {
  private _warmUntil = 0;
  private _rafId: number | null = null;

  constructor() {
    super();
    this._initInputListeners();
  }

  private _initInputListeners(): void {
    // `mousemove` (not pointermove): while the island is click-through,
    // Electron's setIgnoreMouseEvents(forward:true) forwards mousemove — the
    // same source that drives the island's hover-expand — but not pointer events.
    const types: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'wheel'];
    const onInput = (): void => this._touch();
    for (const type of types) {
      window.addEventListener(type, onInput, { capture: true, passive: true });
      this.disposeWithMe(toDisposable(() => window.removeEventListener(type, onInput, { capture: true })));
    }
    this.disposeWithMe(toDisposable(() => {
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    }));
  }

  private _touch(): void {
    this._warmUntil = performance.now() + WARMUP_DURATION_MS;
    if (this._rafId === null) {
      this._rafId = requestAnimationFrame(this._tick);
    }
  }

  // No-op frame: scheduling rAF keeps the frame loop active (no DOM mutation, so
  // no extra paint) so the next CSS animation's first frame skips idle ramp-up.
  private readonly _tick = (): void => {
    if (performance.now() >= this._warmUntil) {
      this._rafId = null;
      return;
    }
    this._rafId = requestAnimationFrame(this._tick);
  };
}
