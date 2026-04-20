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

import type { IDisposable } from '@termlnk/core';
import type { IExtensionDescription } from '../models/extension-description';
import type { IContributionPoint, IContributionPointRegistry } from './contribution-point';
import { Disposable, ILogService, Inject, toDisposable } from '@termlnk/core';

/**
 * Pending contribution that arrived before its target point was registered.
 *
 * When the matching point registers later (common pattern: business plugin
 * loads after the extension that wants to contribute), each pending entry is
 * replayed through `point.apply()`.
 */
interface IPendingContribution {
  readonly description: IExtensionDescription;
  readonly value: unknown;
  readonly onApplied: (disposable: IDisposable) => void;
}

/**
 * Per-extension bindings produced by a single point. Disposing the point
 * must cascade to every binding it produced, so each point owns its own
 * bag of disposables keyed by extension id.
 */
interface IPointState {
  readonly point: IContributionPoint<unknown>;
  readonly bindings: Map<string, IDisposable>;
}

export class ContributionPointRegistry extends Disposable implements IContributionPointRegistry {
  private readonly _points = new Map<string, IPointState>();
  private readonly _pending = new Map<string, IPendingContribution[]>();

  constructor(
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  register<T>(point: IContributionPoint<T>): IDisposable {
    if (this._points.has(point.name)) {
      throw new Error(`Contribution point "${point.name}" already registered`);
    }

    const state: IPointState = {
      point: point as IContributionPoint<unknown>,
      bindings: new Map(),
    };
    this._points.set(point.name, state);

    // Replay any contributions that arrived before this point was ready.
    const pending = this._pending.get(point.name);
    if (pending) {
      this._pending.delete(point.name);
      for (const entry of pending) {
        this._applySafe(state, entry.description, entry.value, entry.onApplied);
      }
    }

    return toDisposable(() => this._unregister(point.name));
  }

  getPoint(name: string): IContributionPoint<unknown> | undefined {
    return this._points.get(name)?.point;
  }

  listNames(): readonly string[] {
    return [...this._points.keys()];
  }

  /**
   * Apply a contribution to a named point; if the point is not yet
   * registered the entry is queued and replayed when it becomes available.
   *
   * Internal API — invoked by `ContributionRegistry`, not by extensions.
   */
  applyContribution(
    pointName: string,
    description: IExtensionDescription,
    value: unknown,
    onApplied: (disposable: IDisposable) => void
  ): void {
    const state = this._points.get(pointName);
    if (state) {
      this._applySafe(state, description, value, onApplied);
      return;
    }

    const queue = this._pending.get(pointName) ?? [];
    queue.push({ description, value, onApplied });
    this._pending.set(pointName, queue);
  }

  /**
   * Drop any pending contributions for an extension — called when the
   * extension is uninstalled before its target point ever registered.
   */
  dropPendingFor(extensionId: string): void {
    for (const [name, queue] of this._pending) {
      const remaining = queue.filter((entry) => entry.description.id !== extensionId);
      if (remaining.length === 0) {
        this._pending.delete(name);
      } else if (remaining.length !== queue.length) {
        this._pending.set(name, remaining);
      }
    }
  }

  override dispose(): void {
    super.dispose();
    for (const state of this._points.values()) {
      for (const disposable of state.bindings.values()) {
        try {
          disposable.dispose();
        } catch (err) {
          this._logService.error('[ContributionPointRegistry]', `Error disposing binding for ${state.point.name}`, err);
        }
      }
      state.bindings.clear();
    }
    this._points.clear();
    this._pending.clear();
  }

  private _unregister(name: string): void {
    const state = this._points.get(name);
    if (!state) {
      return;
    }
    this._points.delete(name);

    for (const disposable of state.bindings.values()) {
      try {
        disposable.dispose();
      } catch (err) {
        this._logService.error('[ContributionPointRegistry]', `Error disposing binding for ${name}`, err);
      }
    }
    state.bindings.clear();
  }

  private _applySafe(
    state: IPointState,
    description: IExtensionDescription,
    value: unknown,
    onApplied: (disposable: IDisposable) => void
  ): void {
    // Validate with the point's own schema — late-arriving contributions
    // may have raw values that were only loosely typed up to this point.
    const parsed = state.point.schema.safeParse(value);
    if (!parsed.success) {
      this._logService.warn(
        '[ContributionPointRegistry]',
        `Invalid contribution for "${state.point.name}" from ${description.id}`,
        parsed.error.issues
      );
      return;
    }

    let disposable: IDisposable;
    try {
      disposable = state.point.apply(description, parsed.data);
    } catch (err) {
      this._logService.error(
        '[ContributionPointRegistry]',
        `point.apply threw for "${state.point.name}" on ${description.id}`,
        err
      );
      return;
    }

    // If the extension re-contributes the same point, dispose the previous
    // binding first so we never leak stale registrations.
    const previous = state.bindings.get(description.id);
    if (previous) {
      try {
        previous.dispose();
      } catch {
        // swallow
      }
    }
    state.bindings.set(description.id, disposable);

    const wrapped = toDisposable(() => {
      const current = state.bindings.get(description.id);
      if (current === disposable) {
        state.bindings.delete(description.id);
      }
      disposable.dispose();
    });
    onApplied(wrapped);
  }
}
