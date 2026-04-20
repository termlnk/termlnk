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

export interface ICleanupRemovedSessionHostsOptions {
  previousSessionIds: ReadonlySet<string>;
  nextSessionIds: ReadonlySet<string>;
  restoreSessionHost: (sessionId: string) => void;
  getSessionHostElement: (sessionId: string) => HTMLElement | null;
  deleteSessionHostElement: (sessionId: string) => void;
  deleteSessionHomeContainer: (sessionId: string) => void;
}

export function cleanupRemovedSessionHosts(options: ICleanupRemovedSessionHostsOptions): void {
  const {
    previousSessionIds,
    nextSessionIds,
    restoreSessionHost,
    getSessionHostElement,
    deleteSessionHostElement,
    deleteSessionHomeContainer,
  } = options;

  for (const sessionId of previousSessionIds) {
    if (nextSessionIds.has(sessionId)) {
      continue;
    }

    restoreSessionHost(sessionId);

    const sessionHostElement = getSessionHostElement(sessionId);
    if (sessionHostElement?.isConnected) {
      sessionHostElement.remove();
    }

    deleteSessionHostElement(sessionId);
    deleteSessionHomeContainer(sessionId);
  }
}
