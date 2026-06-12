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

import type { IPortForwardingRuleEntity } from '@termlnk/database-mobile';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { IMobilePortForwardingRuleRepository } from '@termlnk/database-mobile';
import { BehaviorSubject } from 'rxjs';

export type PortForwardingTunnelStatus = 'idle' | 'starting' | 'active' | 'failed' | 'stopped';

export interface IPortForwardingTunnelState {
  readonly ruleId: string;
  readonly status: PortForwardingTunnelStatus;
  readonly error?: string;
  readonly effectiveBindPort?: number;
  readonly activeConnections: number;
  readonly totalConnections: number;
  readonly bytesIn: number;
  readonly bytesOut: number;
}

export interface IMobilePortForwardingService {
  readonly rules$: Observable<readonly IPortForwardingRuleEntity[]>;
  readonly tunnelStates$: Observable<ReadonlyMap<string, IPortForwardingTunnelState>>;

  saveRule(
    entity: Omit<IPortForwardingRuleEntity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    opts?: { isNew?: boolean }
  ): Promise<IPortForwardingRuleEntity>;
  removeRule(id: string): Promise<void>;
  getRule(id: string): Promise<IPortForwardingRuleEntity | null>;

  startRule(ruleId: string): Promise<void>;
  stopRule(ruleId: string): Promise<void>;
  getTunnelState(ruleId: string): IPortForwardingTunnelState | undefined;
}

export const IMobilePortForwardingService = createIdentifier<IMobilePortForwardingService>(
  'mobile.port-forwarding.service'
);

export class MobilePortForwardingService extends Disposable implements IMobilePortForwardingService {
  readonly rules$: Observable<readonly IPortForwardingRuleEntity[]>;

  private readonly _tunnelStates$ = new BehaviorSubject<ReadonlyMap<string, IPortForwardingTunnelState>>(new Map());
  readonly tunnelStates$: Observable<ReadonlyMap<string, IPortForwardingTunnelState>> = this._tunnelStates$.asObservable();

  private readonly _repo: IMobilePortForwardingRuleRepository;
  private readonly _logService: ILogService;

  // Active tunnel handles keyed by ruleId.
  // TODO: populate when FFI layer is extended (Task #6/#7).
  // private readonly _tunnels = new Map<string, IForwardHandle>();
  // SSH connections shared by tunnels targeting the same host.
  // private readonly _connections = new Map<string, IMobileSshSession>();

  constructor(
    @Inject(IMobilePortForwardingRuleRepository) repo: IMobilePortForwardingRuleRepository,
    @Inject(ILogService) logService: ILogService
  ) {
    super();
    this._repo = repo;
    this._logService = logService;
    this.rules$ = repo.rules$;

    void repo.ready().catch((err) => {
      this._logService.warn('[MobilePortForwardingService] repo ready failed:', err);
    });
  }

  override dispose(): void {
    super.dispose();
    this._tunnelStates$.complete();
  }

  async saveRule(
    entity: Omit<IPortForwardingRuleEntity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    opts?: { isNew?: boolean }
  ): Promise<IPortForwardingRuleEntity> {
    return this._repo.saveRule(entity, opts);
  }

  async removeRule(id: string): Promise<void> {
    await this.stopRule(id);
    await this._repo.removeRule(id);
  }

  async getRule(id: string): Promise<IPortForwardingRuleEntity | null> {
    return this._repo.getById(id);
  }

  // --- Tunnel lifecycle (stubbed until FFI layer is extended) ---

  async startRule(ruleId: string): Promise<void> {
    const rule = await this._repo.getById(ruleId);
    if (!rule) {
      throw new Error(`Port forwarding rule ${ruleId} not found`);
    }

    this._logService.log(`[MobilePortForwardingService] startRule ${ruleId} (${rule.type})`);

    // TODO: implement tunnel execution after Rust FFI extension (Task #6/#7):
    // 1. Resolve host credentials via IMobileHostRepository + resolveHostConnectArgs
    // 2. Get or create SSH connection for rule.hostId
    // 3. Call connection.startLocalForward / startRemoteForward / startDynamicForward
    // 4. Track ForwardHandle + status callbacks
    // 5. Update _tunnelStates$

    this._patchTunnelState(ruleId, {
      ruleId,
      status: 'starting',
      activeConnections: 0,
      totalConnections: 0,
      bytesIn: 0,
      bytesOut: 0,
    });
  }

  async stopRule(ruleId: string): Promise<void> {
    const state = this.getTunnelState(ruleId);
    if (!state || state.status === 'idle' || state.status === 'stopped') {
      return;
    }

    this._logService.log(`[MobilePortForwardingService] stopRule ${ruleId}`);

    // TODO: call ForwardHandle.stop() and release connection if no more tunnels

    this._removeTunnelState(ruleId);
  }

  getTunnelState(ruleId: string): IPortForwardingTunnelState | undefined {
    return this._tunnelStates$.getValue().get(ruleId);
  }

  private _patchTunnelState(ruleId: string, state: IPortForwardingTunnelState): void {
    const next = new Map(this._tunnelStates$.getValue());
    next.set(ruleId, state);
    this._tunnelStates$.next(next);
  }

  private _removeTunnelState(ruleId: string): void {
    const current = this._tunnelStates$.getValue();
    if (!current.has(ruleId)) {
      return;
    }
    const next = new Map(current);
    next.delete(ruleId);
    this._tunnelStates$.next(next);
  }
}
