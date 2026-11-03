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

import type {
  IACPDiscoveryService,
  IACPPluginConfig,
  IACPPromptBlock,
  IACPSessionInfo,
  IACPSessionService,
  IACPStreamEvent,
  ICreateACPSessionParams,
} from '@termlnk/acp';
import type { Observable } from 'rxjs';
import { homedir } from 'node:os';
import {
  ACP_PLUGIN_CONFIG_KEY,
  IACPDiscoveryService as IACPDiscoveryServiceId,
} from '@termlnk/acp';
import { Disposable, generateRandomId, IConfigService, ILogService, Inject } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { filter, map, share } from 'rxjs/operators';
import { resolveLoginShellEnv } from '../discovery/login-shell-env';
import { ACPSessionStore } from '../persistence/acp-session-store';
import { ACPConnection } from './acp-connection';

interface ISessionEntry {
  connection: ACPConnection;
  events$: Observable<IACPStreamEvent>;
}

export class ACPSessionService extends Disposable implements IACPSessionService {
  private readonly _sessions$ = new BehaviorSubject<IACPSessionInfo[]>([]);
  readonly sessions$: Observable<IACPSessionInfo[]> = this._sessions$.asObservable();

  private readonly _entries = new Map<string, ISessionEntry>();
  private readonly _bus$ = new Subject<{ sessionId: string; event: IACPStreamEvent }>();

  constructor(
    @IACPDiscoveryServiceId private readonly _discovery: IACPDiscoveryService,
    @Inject(ACPSessionStore) private readonly _store: ACPSessionStore,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  get sessions(): IACPSessionInfo[] {
    return this._sessions$.getValue();
  }

  getSession(sessionId: string): IACPSessionInfo | undefined {
    return this._sessions$.getValue().find((s) => s.id === sessionId);
  }

  events$(sessionId: string): Observable<IACPStreamEvent> {
    const entry = this._entries.get(sessionId);
    if (entry) {
      return entry.events$;
    }
    // Allow subscribers to attach before createSession finishes starting.
    return this._bus$.pipe(
      filter((e) => e.sessionId === sessionId),
      map((e) => e.event),
      share()
    );
  }

  async createSession(params: ICreateACPSessionParams): Promise<IACPSessionInfo> {
    await this._discovery.refresh();
    const status = this._discovery.getProvider(params.providerId);
    if (!status) {
      throw new Error(`Unknown ACP provider: ${params.providerId}`);
    }
    if (status.availability.state === 'missing') {
      throw new Error(
        `Provider "${status.descriptor.title}" is not installed. ${
          status.descriptor.installLink
            ? `Install from ${status.descriptor.installLink}`
            : 'Install the CLI and ensure it is on PATH.'}`
      );
    }

    const sessionId = params.sessionId ?? `acp_${generateRandomId()}`;
    if (this._entries.has(sessionId)) {
      throw new Error(`ACP session already exists: ${sessionId}`);
    }

    const cfg = this._configService.getConfig<IACPPluginConfig>(ACP_PLUGIN_CONFIG_KEY);
    const env = await resolveLoginShellEnv();

    const cwd = params.cwd?.trim() || homedir();

    const connection = new ACPConnection(
      {
        sessionId,
        descriptor: status.descriptor,
        cwd,
        env,
        nativeSessionId: params.nativeSessionId,
        autoAccept: cfg?.autoAcceptByDefault ?? false,
        hostId: params.hostId,
        providerTitle: status.descriptor.title,
        handshakeTimeoutMs: cfg?.handshakeTimeoutMs,
      },
      this._logService
    );

    const events$ = connection.events$.pipe(share());
    const sub = events$.subscribe((event) => {
      this._bus$.next({ sessionId, event });
      if (event.type === 'session_status' || event.type === 'title_update' || event.type === 'mode_update') {
        this._publishInfo(connection.info);
        void this._store.upsert(connection.info).catch((err) => {
          this._logService.warn('[ACPSession] persist failed', err);
        });
      }
    });
    this.disposeWithMe(sub);

    this._entries.set(sessionId, { connection, events$ });
    this._publishInfo(connection.info);

    try {
      await connection.start();
      this._publishInfo(connection.info);
      await this._store.upsert(connection.info);
      return connection.info;
    } catch (err) {
      this._entries.delete(sessionId);
      connection.dispose();
      this._removeFromList(sessionId);
      throw err;
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const entry = this._entries.get(sessionId);
    if (!entry) {
      return;
    }
    this._entries.delete(sessionId);
    entry.connection.dispose();
    this._removeFromList(sessionId);
    await this._store.remove(sessionId);
  }

  async prompt(sessionId: string, blocks: IACPPromptBlock[]): Promise<void> {
    const { connection } = this._require(sessionId);
    await connection.prompt(blocks);
    this._publishInfo(connection.info);
  }

  async cancel(sessionId: string): Promise<void> {
    await this._require(sessionId).connection.cancel();
  }

  async respondPermission(sessionId: string, requestId: string, optionId: string): Promise<void> {
    await this._require(sessionId).connection.respondPermission(requestId, optionId);
  }

  async setMode(sessionId: string, modeId: string): Promise<void> {
    const { connection } = this._require(sessionId);
    await connection.setMode(modeId);
    this._publishInfo(connection.info);
  }

  async setModel(sessionId: string, modelId: string): Promise<void> {
    const { connection } = this._require(sessionId);
    await connection.setModel(modelId);
    this._publishInfo(connection.info);
  }

  async diagnose(providerId: string): Promise<string> {
    await this._discovery.refresh();
    const status = this._discovery.getProvider(providerId);
    if (!status) {
      return `Unknown provider id: ${providerId}`;
    }
    const env = await resolveLoginShellEnv();
    const lines = [
      `Provider: ${status.descriptor.title} (${status.descriptor.id})`,
      `Command: ${status.descriptor.command.join(' ')}`,
      `Availability: ${status.availability.state}`,
    ];
    if (status.availability.state === 'installed') {
      lines.push(`Resolved path: ${status.availability.resolvedPath}`);
      if (status.availability.version) {
        lines.push(`Version: ${status.availability.version}`);
      }
    }
    lines.push(`PATH: ${env.PATH ?? '(empty)'}`);
    if (status.descriptor.installLink) {
      lines.push(`Install: ${status.descriptor.installLink}`);
    }
    return lines.join('\n');
  }

  override dispose(): void {
    super.dispose();
    for (const entry of this._entries.values()) {
      entry.connection.dispose();
    }
    this._entries.clear();
    this._sessions$.complete();
    this._bus$.complete();
  }

  private _require(sessionId: string): ISessionEntry {
    const entry = this._entries.get(sessionId);
    if (!entry) {
      throw new Error(`Unknown ACP session: ${sessionId}`);
    }
    return entry;
  }

  private _publishInfo(info: IACPSessionInfo): void {
    const list = this._sessions$.getValue().slice();
    const idx = list.findIndex((s) => s.id === info.id);
    if (idx === -1) {
      list.push(info);
    } else {
      list[idx] = info;
    }
    this._sessions$.next(list);
  }

  private _removeFromList(sessionId: string): void {
    this._sessions$.next(this._sessions$.getValue().filter((s) => s.id !== sessionId));
  }
}
