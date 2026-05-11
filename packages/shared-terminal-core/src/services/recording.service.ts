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

import type { IRecordingHandle, IRecordingMetadata, ISharedSessionRecordingService } from '@termlnk/shared-terminal';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

interface IActiveRecording {
  handle: IRecordingHandle;
  readonly title: string;
  bytes: number;
}

interface IRecordingStore {
  readonly metadata: IRecordingMetadata[];
}

export interface IRecordingServiceConfig {
  readonly recordingsDir?: string;
  readonly now?: () => number;
}

const STORE_FILE = 'recordings.json';

export class SharedSessionRecordingService extends Disposable implements ISharedSessionRecordingService {
  private readonly _activeRecordings$ = new BehaviorSubject<readonly IRecordingHandle[]>([]);
  readonly activeRecordings$ = this._activeRecordings$.asObservable();

  private readonly _active = new Map<string, IActiveRecording>();
  private readonly _recordingsDir: string;
  private readonly _now: () => number;

  constructor(config: IRecordingServiceConfig = {}) {
    super();
    this._recordingsDir = config.recordingsDir ?? join(homedir(), '.termlnk', 'recordings');
    this._now = config.now ?? Date.now;
  }

  override dispose(): void {
    this._activeRecordings$.complete();
    super.dispose();
  }

  async start(options: { sessionId: string; title: string; mandatory: boolean }): Promise<IRecordingHandle> {
    const existing = [...this._active.values()].find((recording) => recording.handle.sessionId === options.sessionId);
    if (existing) {
      if (options.mandatory && !existing.handle.mandatory) {
        existing.handle = {
          ...existing.handle,
          mandatory: true,
        };
        this._publishActive();
        await this.appendAuditEvent(existing.handle, {
          type: 'recording_mandatory',
          sessionId: options.sessionId,
          at: this._now(),
        });
      }
      return existing.handle;
    }

    await mkdir(this._recordingsDir, { recursive: true });
    const startedAt = this._now();
    const id = `${options.sessionId}-${startedAt}`;
    const path = join(this._recordingsDir, `${id}.cast`);
    const auditLogPath = join(this._recordingsDir, `${id}.audit.jsonl`);
    const handle: IRecordingHandle = {
      id,
      sessionId: options.sessionId,
      startedAt,
      path,
      mandatory: options.mandatory,
    };
    const header = {
      version: 2,
      width: 80,
      height: 24,
      timestamp: Math.floor(startedAt / 1000),
      title: options.title,
    };
    await writeFile(path, `${JSON.stringify(header)}\n`, 'utf-8');
    await writeFile(auditLogPath, `${JSON.stringify({
      type: 'recording_started',
      sessionId: options.sessionId,
      at: startedAt,
      mandatory: options.mandatory,
    })}\n`, 'utf-8');

    const active: IActiveRecording = { handle, title: options.title, bytes: Buffer.byteLength(`${JSON.stringify(header)}\n`) };
    this._active.set(handle.id, active);
    this._publishActive();
    await this._upsertMetadata({
      id: handle.id,
      sessionId: handle.sessionId,
      title: options.title,
      startedAt,
      endedAt: null,
      path,
      bytes: active.bytes,
      auditLogPath,
    });
    return handle;
  }

  async stop(handle: IRecordingHandle, force = false): Promise<void> {
    const active = this._active.get(handle.id);
    if (!active) {
      return;
    }
    if (handle.mandatory && !force) {
      throw new Error('[SharedSessionRecordingService] cannot stop mandatory recording without force');
    }
    const endedAt = this._now();
    await this.appendAuditEvent(handle, {
      type: 'recording_stopped',
      sessionId: handle.sessionId,
      at: endedAt,
    });
    this._active.delete(handle.id);
    this._publishActive();
    await this._updateMetadata(handle.id, {
      endedAt,
      bytes: await this._fileSize(handle.path),
    });
  }

  async appendOutput(handle: IRecordingHandle, chunk: Uint8Array): Promise<void> {
    const active = this._active.get(handle.id);
    if (!active) {
      return;
    }
    const elapsed = Math.max(0, (this._now() - handle.startedAt) / 1000);
    const text = new TextDecoder().decode(chunk);
    const line = `${JSON.stringify([elapsed, 'o', text])}\n`;
    await writeFile(handle.path, line, { encoding: 'utf-8', flag: 'a' });
    active.bytes += Buffer.byteLength(line);
  }

  async appendAuditEvent(handle: IRecordingHandle, event: Record<string, unknown>): Promise<void> {
    const active = this._active.get(handle.id);
    if (!active) {
      return;
    }
    const line = `${JSON.stringify({ ...event, sessionId: handle.sessionId })}\n`;
    await writeFile(this._auditPath(handle), line, { encoding: 'utf-8', flag: 'a' });
  }

  async list(): Promise<readonly IRecordingMetadata[]> {
    const store = await this._loadStore();
    const existing = new Set(await this._existingRecordingIds());
    return store.metadata
      .filter((item) => existing.has(item.id))
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  async delete(id: string): Promise<boolean> {
    const store = await this._loadStore();
    const found = store.metadata.find((item) => item.id === id);
    if (!found) {
      return false;
    }
    await Promise.allSettled([
      rm(found.path, { force: true }),
      found.auditLogPath ? rm(found.auditLogPath, { force: true }) : Promise.resolve(),
    ]);
    await this._saveStore({
      metadata: store.metadata.filter((item) => item.id !== id),
    });
    return true;
  }

  private _publishActive(): void {
    this._activeRecordings$.next([...this._active.values()].map((item) => item.handle));
  }

  private async _upsertMetadata(metadata: IRecordingMetadata): Promise<void> {
    const store = await this._loadStore();
    const next = store.metadata.filter((item) => item.id !== metadata.id);
    next.push(metadata);
    await this._saveStore({ metadata: next });
  }

  private async _updateMetadata(id: string, patch: Partial<IRecordingMetadata>): Promise<void> {
    const store = await this._loadStore();
    await this._saveStore({
      metadata: store.metadata.map((item) => item.id === id ? { ...item, ...patch } : item),
    });
  }

  private async _loadStore(): Promise<IRecordingStore> {
    try {
      const raw = await readFile(join(this._recordingsDir, STORE_FILE), 'utf-8');
      const parsed = JSON.parse(raw) as IRecordingStore;
      return { metadata: Array.isArray(parsed.metadata) ? parsed.metadata : [] };
    } catch {
      return { metadata: [] };
    }
  }

  private async _saveStore(store: IRecordingStore): Promise<void> {
    await mkdir(this._recordingsDir, { recursive: true });
    await writeFile(join(this._recordingsDir, STORE_FILE), `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
  }

  private async _existingRecordingIds(): Promise<Set<string>> {
    try {
      const names = await readdir(this._recordingsDir);
      return new Set(names.filter((name) => name.endsWith('.cast')).map((name) => name.slice(0, -'.cast'.length)));
    } catch {
      return new Set();
    }
  }

  private async _fileSize(path: string): Promise<number> {
    try {
      return (await stat(path)).size;
    } catch {
      return 0;
    }
  }

  private _auditPath(handle: IRecordingHandle): string {
    return join(this._recordingsDir, `${handle.id}.audit.jsonl`);
  }
}
