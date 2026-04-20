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
import type {
  IContributionPoint,
  IContributionPointRegistry,
  IContributionRegistry,
  IExtensionDescription,
} from '@termlnk/extension';
import type { Ctor } from '@wendellhu/redi';
import { Disposable, ILogService, Inject, Injector, toDisposable } from '@termlnk/core';
import {
  ContributionPointRegistry,
  IContributionPointRegistry as IContributionPointRegistryId,
} from '@termlnk/extension';
import {
  CommandsPoint,
  ConfigurationPoint,
  KeybindingsPoint,
  MenusPoint,
  StatusBarPoint,
  ThemesPoint,
} from './points';

/**
 * The set of built-in points that the host installs automatically on the
 * shared `IContributionPointRegistry`. Adding a new contribution type from
 * a business plugin does not require editing this list — third-party code
 * can call `IContributionPointRegistry.register()` at any time and the new
 * point will participate in extension contribution routing, including
 * replay of any extensions that were activated before the point was ready.
 */
type PointCtor = Ctor<IContributionPoint<unknown>>;

const BUILT_IN_POINT_CTORS: ReadonlyArray<PointCtor> = [
  CommandsPoint as unknown as PointCtor,
  MenusPoint as unknown as PointCtor,
  KeybindingsPoint as unknown as PointCtor,
  StatusBarPoint as unknown as PointCtor,
  ThemesPoint as unknown as PointCtor,
  ConfigurationPoint as unknown as PointCtor,
];

export class ContributionRegistry extends Disposable implements IContributionRegistry {
  private readonly _perExtension = new Map<string, IDisposable[]>();
  private _initialized = false;

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IContributionPointRegistryId private readonly _pointRegistry: IContributionPointRegistry,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  registerContributions(description: IExtensionDescription): IDisposable {
    this._ensureInitialized();

    const contributes = description.manifest.contributes ?? {};
    const bindings: IDisposable[] = [];

    for (const [pointName, rawValue] of Object.entries(contributes)) {
      if (!this._pointRegistry.getPoint(pointName)) {
        this._logService.debug(
          '[ContributionRegistry]',
          `Contribution point "${pointName}" is not yet registered; contribution from ${description.id} is queued for replay`
        );
      }
      this._applyContribution(pointName, description, rawValue, bindings);
    }

    if (bindings.length) {
      const existing = this._perExtension.get(description.id);
      if (existing) {
        existing.push(...bindings);
      } else {
        this._perExtension.set(description.id, bindings);
      }
    }

    return toDisposable(() => this.unregisterContributions(description.id));
  }

  unregisterContributions(extensionId: string): void {
    const bindings = this._perExtension.get(extensionId);
    if (bindings) {
      for (const disposable of bindings) {
        try {
          disposable.dispose();
        } catch (err) {
          this._logService.error(
            '[ContributionRegistry]',
            `Error disposing contribution binding for ${extensionId}`,
            err
          );
        }
      }
      this._perExtension.delete(extensionId);
    }

    if (this._pointRegistry instanceof ContributionPointRegistry) {
      this._pointRegistry.dropPendingFor(extensionId);
    }
  }

  override dispose(): void {
    super.dispose();
    for (const bindings of this._perExtension.values()) {
      for (const disposable of bindings) {
        try {
          disposable.dispose();
        } catch {
          // swallow
        }
      }
    }
    this._perExtension.clear();
  }

  private _applyContribution(
    pointName: string,
    description: IExtensionDescription,
    rawValue: unknown,
    bindings: IDisposable[]
  ): void {
    if (this._pointRegistry instanceof ContributionPointRegistry) {
      this._pointRegistry.applyContribution(pointName, description, rawValue, (disposable) => {
        bindings.push(disposable);
      });
      return;
    }

    // Fallback path for alternate registry implementations: apply synchronously
    // when the point is already registered; drop otherwise (no replay support).
    const point = this._pointRegistry.getPoint(pointName);
    if (!point) {
      return;
    }
    const parsed = point.schema.safeParse(rawValue);
    if (!parsed.success) {
      this._logService.warn(
        '[ContributionRegistry]',
        `Invalid "${pointName}" contribution from ${description.id}`,
        parsed.error.issues
      );
      return;
    }
    bindings.push(point.apply(description, parsed.data));
  }

  private _ensureInitialized(): void {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    for (const Ctor of BUILT_IN_POINT_CTORS) {
      const instance = this._injector.createInstance(Ctor) as IContributionPoint<unknown>;
      this.disposeWithMe(this._pointRegistry.register(instance));
    }
  }
}
