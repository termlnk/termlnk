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
import type { ITerminalAppearanceConfig } from '@termlnk/terminal';
import type { IIconPickerValue } from '@termlnk/ui';
import type { IWorkspaceLayoutNode } from '../../models/workspace.model';
import type { ISerializeResult } from '../../views/hooks';
import { createIdentifier, Disposable, ILogService } from '@termlnk/core';
import { IConfigManagerService, ITerminalSessionBackupService } from '@termlnk/rpc-client';
import { DEFAULT_PERSISTENCE_SCROLLBACK, TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/terminal';
import { IWorkspaceService } from '../workspace/workspace.service';
import { ITerminalUIService } from './terminal-ui.service';

export interface IPersistedTerminalSession {
  id: string;
  type: string;
  hostId: string;
  hostName: string;
  title?: string;
  serializedBuffer: string;
  cols: number;
  rows: number;
  cwd?: string;
  savedAt: number;
}

export interface IPersistedTerminalState {
  version: 1;
  sessions: IPersistedTerminalSession[];
  activeSessionId: string | null;
  sessionOrder: string[];
}

export interface IPersistedWorkspace {
  id: string;
  name: string;
  layout: IWorkspaceLayoutNode;
  activeSessionId: string | null;
  icon?: IIconPickerValue;
  pinned?: boolean;
}

export interface IPersistedTerminalStateV2 {
  version: 2;
  sessions: IPersistedTerminalSession[];
  activeTabItemId: string | null;
  tabItemOrder: string[];
  workspaces: IPersistedWorkspace[];
}

type PersistedState = IPersistedTerminalState | IPersistedTerminalStateV2;

type SerializerFn = () => ISerializeResult | null;

export interface ITerminalPersistenceService {
  registerSerializer(sessionId: string, serializer: SerializerFn): IDisposable;
  unregisterSerializer(sessionId: string): void;
  saveState(): Promise<void>;
  loadState(): Promise<IPersistedTerminalStateV2 | null>;
  clearState(): Promise<void>;
  getRestoreData(sessionId: string): IPersistedTerminalSession | null;
  consumeRestoreData(sessionId: string): void;
}

export const ITerminalPersistenceService = createIdentifier<ITerminalPersistenceService>('terminal-ui.terminal-persistence-service');

export class TerminalPersistenceService extends Disposable implements ITerminalPersistenceService {
  private readonly _serializers = new Map<string, SerializerFn>();
  private readonly _restoreDataMap = new Map<string, IPersistedTerminalSession>();

  constructor(
    @ITerminalSessionBackupService private readonly _backupService: ITerminalSessionBackupService,
    @IConfigManagerService private readonly _configManagerService: IConfigManagerService,
    @IWorkspaceService private readonly _workspaceService: IWorkspaceService,
    @ILogService private readonly _logService: ILogService,
    @ITerminalUIService private readonly _terminalUIService: ITerminalUIService
  ) {
    super();
  }

  registerSerializer(sessionId: string, serializer: SerializerFn): IDisposable {
    this._serializers.set(sessionId, serializer);
    return {
      dispose: () => {
        this._serializers.delete(sessionId);
      },
    };
  }

  unregisterSerializer(sessionId: string): void {
    this._serializers.delete(sessionId);
  }

  async saveState(): Promise<void> {
    try {
      const settings = await this._getSettings();
      if (!settings.persistentSession) {
        await this._backupService.clear();
        return;
      }

      const scrollback = settings.persistentSessionScrollback ?? 100;
      const allSessions = this._terminalUIService.getAllSessions();
      const sessions: IPersistedTerminalSession[] = [];

      for (const session of allSessions) {
        const serializer = this._serializers.get(session.id);
        if (!serializer) continue;

        try {
          const result = serializer();
          if (!result) continue;

          sessions.push({
            id: session.id,
            type: session.type,
            hostId: session.hostId,
            hostName: session.hostName,
            title: session.title,
            serializedBuffer: result.serializedBuffer.slice(0, scrollback * 500),
            cols: result.cols,
            rows: result.rows,
            cwd: result.cwd,
            savedAt: Date.now(),
          });
        } catch (err) {
          this._logService.warn('[TerminalPersistenceService]', `Failed to serialize session ${session.id}:`, err);
        }
      }

      if (sessions.length === 0) {
        await this._backupService.clear();
        return;
      }

      const workspaces = this._workspaceService.getAllWorkspaces().map((ws) => ({
        id: ws.id,
        name: ws.name,
        layout: ws.layout,
        activeSessionId: ws.activeSessionId,
        icon: ws.icon,
        pinned: ws.pinned,
      }));
      const tabItemOrder = this._workspaceService.getTabItemOrder();
      const activeTabItemId = this._workspaceService.getActiveTabItemId();

      const state: IPersistedTerminalStateV2 = {
        version: 2,
        sessions,
        activeTabItemId: activeTabItemId ?? this._terminalUIService.getActiveSessionId(),
        tabItemOrder: tabItemOrder.length > 0 ? tabItemOrder : allSessions.map((s) => s.id),
        workspaces,
      };

      await this._backupService.save(state);
      this._logService.debug('[TerminalPersistenceService]', `Saved ${sessions.length} session(s), ${workspaces.length} workspace(s).`);
    } catch (err) {
      this._logService.warn('[TerminalPersistenceService]', 'Failed to save state:', err);
    }
  }

  async loadState(): Promise<IPersistedTerminalStateV2 | null> {
    try {
      const settings = await this._getSettings();
      if (!settings.persistentSession) {
        return null;
      }

      const state = await this._backupService.load<PersistedState>();
      if (!state || !Array.isArray(state.sessions)) {
        return null;
      }

      // Migrate v1 → v2
      const v2State = this._migrateToV2(state);

      for (const session of v2State.sessions) {
        this._restoreDataMap.set(session.id, session);
      }

      this._logService.debug('[TerminalPersistenceService]', `Loaded ${v2State.sessions.length} session(s) for restore.`);
      return v2State;
    } catch (err) {
      this._logService.warn('[TerminalPersistenceService]', 'Failed to load state:', err);
      return null;
    }
  }

  async clearState(): Promise<void> {
    try {
      await this._backupService.clear();
    } catch (err) {
      this._logService.warn('[TerminalPersistenceService]', 'Failed to clear state:', err);
    }
  }

  getRestoreData(sessionId: string): IPersistedTerminalSession | null {
    return this._restoreDataMap.get(sessionId) ?? null;
  }

  consumeRestoreData(sessionId: string): void {
    this._restoreDataMap.delete(sessionId);
  }

  private _migrateToV2(state: PersistedState): IPersistedTerminalStateV2 {
    if (state.version === 2) {
      return state as IPersistedTerminalStateV2;
    }

    // v1 → v2: all sessions are standalone, no workspaces
    const v1 = state as IPersistedTerminalState;
    return {
      version: 2,
      sessions: v1.sessions,
      activeTabItemId: v1.activeSessionId,
      tabItemOrder: v1.sessionOrder.length > 0 ? v1.sessionOrder : v1.sessions.map((s) => s.id),
      workspaces: [],
    };
  }

  private async _getSettings(): Promise<{ persistentSession: boolean; persistentSessionScrollback: number }> {
    try {
      const config = await this._configManagerService.getField<ITerminalAppearanceConfig>(
        TERMINAL_PLUGIN_CONFIG_KEY,
        'appearance'
      );
      return {
        persistentSession: typeof config?.persistentSession === 'boolean' ? config.persistentSession : true,
        persistentSessionScrollback: typeof config?.persistentSessionScrollback === 'number'
          ? config.persistentSessionScrollback
          : DEFAULT_PERSISTENCE_SCROLLBACK,
      };
    } catch {
      return { persistentSession: true, persistentSessionScrollback: DEFAULT_PERSISTENCE_SCROLLBACK };
    }
  }

  override dispose(): void {
    this._serializers.clear();
    this._restoreDataMap.clear();
    super.dispose();
  }
}
