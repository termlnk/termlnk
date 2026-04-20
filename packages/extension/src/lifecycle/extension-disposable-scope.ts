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
import { Disposable } from '@termlnk/core';

/**
 * A disposable bag owned by a single extension activation.
 *
 * Every side effect produced by an extension (command registrations, UI part
 * injections, hook subscriptions, menu contributions, status-bar items, …)
 * should be handed to `scope.track()` at the point it is created. Upon
 * deactivation the host calls `scope.dispose()` once, and the scope cascades
 * the cleanup to every tracked disposable.
 *
 * The scope is intentionally simple: no priority, no ordering guarantees
 * beyond "reverse registration order is NOT promised". Consumers that need
 * ordering should compose their own disposable wrappers.
 */
export class ExtensionDisposableScope extends Disposable {
  constructor(public readonly extensionId: string) {
    super();
  }

  /**
   * Track a disposable for later cleanup. Returns the same disposable so the
   * call can be inlined (`scope.track(service.register(...))`).
   */
  track<T extends IDisposable>(disposable: T): T {
    this.disposeWithMe(disposable);
    return disposable;
  }
}
