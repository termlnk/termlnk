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

import type { IImageAttachment } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export type IPendingDeliveryMode = 'steer' | 'followUp';

export interface IPendingMessageEntry {
  readonly content: string;
  readonly images?: IImageAttachment[];
  readonly mode: IPendingDeliveryMode;
}

/**
 * Bookkeeping for user messages queued via `agent.steer()` / `agent.followUp()`
 * while an agent run is in flight.
 *
 * The internal Map is the single source of truth; `ids$` is a derived stream
 * consumed by the UI to render and individually cancel pending entries.
 * This class owns state only — dispatching entries to pi-agent-core's own
 * queue is the caller's responsibility.
 */
export class PendingMessageQueue extends Disposable {
  private readonly _entries = new Map<string, IPendingMessageEntry>();
  private readonly _ids$ = new BehaviorSubject<string[]>([]);

  readonly ids$: Observable<string[]> = this._ids$.asObservable();

  get size(): number {
    return this._entries.size;
  }

  has(id: string): boolean {
    return this._entries.has(id);
  }

  get(id: string): IPendingMessageEntry | undefined {
    return this._entries.get(id);
  }

  values(): IterableIterator<IPendingMessageEntry> {
    return this._entries.values();
  }

  enqueue(id: string, entry: IPendingMessageEntry): void {
    this._entries.set(id, entry);
    this._ids$.next([...this._ids$.getValue(), id]);
  }

  remove(id: string): boolean {
    if (!this._entries.delete(id)) {
      return false;
    }
    this._ids$.next(this._ids$.getValue().filter((x) => x !== id));
    return true;
  }

  clear(): void {
    if (this._entries.size === 0) {
      return;
    }
    this._entries.clear();
    this._ids$.next([]);
  }

  /**
   * Remove the first entry whose content matches `text` exactly. Used to drop
   * a pending entry once we observe it has been drained into the transcript
   * (via the next `message_start` user event).
   */
  removeMatchingContent(text: string): void {
    if (!text) {
      return;
    }
    for (const [id, entry] of this._entries) {
      if (entry.content === text) {
        this.remove(id);
        return;
      }
    }
  }

  override dispose(): void {
    super.dispose();
    this._entries.clear();
    this._ids$.complete();
  }
}
