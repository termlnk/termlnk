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
import type { IForwardHandle, IForwardTunnelCallback, IForwardTunnelStats } from '@termlnk/react-native-russh';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { IMobilePortForwardingRuleRepository } from '@termlnk/database-mobile';
import { IMobileConnectionService } from '@termlnk/terminal-mobile';
import { auditTime, BehaviorSubject, Subject } from 'rxjs';

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

const STATS_FLUSH_MS = 500;

export class MobilePortForwardingService extends Disposable implements IMobilePortForwardingService {
  readonly rules$: Observable<readonly IPortForwardingRuleEntity[]>;

  private readonly _tunnelStates$ = new BehaviorSubject<ReadonlyMap<string, IPortForwardingTunnelState>>(new Map());
  readonly tunnelStates$: Observable<ReadonlyMap<string, IPortForwardingTunnelState>> = this._tunnelStates$.asObservable();

  private readonly _repo: IMobilePortForwardingRuleRepository;
  private readonly _connectionService: IMobileConnectionService;
  private readonly _logService: ILogService;
  private readonly _tunnels = new Map<string, IForwardHandle>();
  // Re-entrancy guard: while a start awaits the FFI round-trip, `_tunnels` is
  // still empty so a second startRule(same id) would otherwise pass `_tunnels.has`
  // and launch a duplicate forward. Tracking the in-flight promise here gives every
  // concurrent caller the same resolution.
  private readonly _pendingStarts = new Map<string, Promise<void>>();
  // Byte-counter callbacks from the FFI fire per-packet; batch them so subscribers
  // re-render at most every STATS_FLUSH_MS regardless of native cadence.
  private readonly _statsBuffer = new Map<string, IForwardTunnelStats>();
  private readonly _statsTick$ = new Subject<void>();

  constructor(
    @Inject(IMobilePortForwardingRuleRepository) repo: IMobilePortForwardingRuleRepository,
    @Inject(IMobileConnectionService) connectionService: IMobileConnectionService,
    @Inject(ILogService) logService: ILogService
  ) {
    super();
    this._repo = repo;
    this._connectionService = connectionService;
    this._logService = logService;
    this.rules$ = repo.rules$;

    this.disposeWithMe(
      this._statsTick$.pipe(auditTime(STATS_FLUSH_MS)).subscribe(() => this._flushStats())
    );

    void repo.ready().catch((err) => {
      this._logService.warn('[MobilePortForwardingService] repo ready failed:', err);
    });
  }

  override dispose(): void {
    // super.dispose() flips the inherited `_disposed` flag, which any in-flight
    // startRule observes via `this._disposed` to skip the post-await `_tunnels.set(...)`
    // and stop the new handle immediately.
    super.dispose();
    for (const [ruleId, handle] of this._tunnels) {
      void handle.stop().catch(() => {});
      this._tunnels.delete(ruleId);
    }
    this._pendingStarts.clear();
    this._statsBuffer.clear();
    this._statsTick$.complete();
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

  async startRule(ruleId: string): Promise<void> {
    if (this._disposed) {
      return;
    }
    if (this._tunnels.has(ruleId)) {
      this._logService.log(`[MobilePortForwardingService] tunnel ${ruleId} already running`);
      return;
    }
    const inFlight = this._pendingStarts.get(ruleId);
    if (inFlight) {
      return inFlight;
    }

    const promise = this._doStartRule(ruleId).finally(() => {
      this._pendingStarts.delete(ruleId);
    });
    this._pendingStarts.set(ruleId, promise);
    return promise;
  }

  private async _doStartRule(ruleId: string): Promise<void> {
    const rule = await this._repo.getById(ruleId);
    if (!rule) {
      throw new Error(`Port forwarding rule ${ruleId} not found`);
    }

    this._logService.log(`[MobilePortForwardingService] startRule ${ruleId} (${rule.type})`);
    this._patchTunnelState(ruleId, {
      ruleId,
      status: 'starting',
      activeConnections: 0,
      totalConnections: 0,
      bytesIn: 0,
      bytesOut: 0,
    });

    let handle: IForwardHandle | null = null;
    try {
      const session = await this._connectionService.connect(rule.hostId);
      if (!session) {
        throw new Error('SSH connection failed — no credential or host not found');
      }

      const callback: IForwardTunnelCallback = {
        onStatusChange: (status) => {
          if (this._disposed) {
            return;
          }
          if (status.kind === 'active') {
            this._patchTunnelState(ruleId, {
              ...this._currentState(ruleId),
              status: 'active',
              effectiveBindPort: status.effectiveBindPort,
            });
          } else if (status.kind === 'failed') {
            this._patchTunnelState(ruleId, {
              ...this._currentState(ruleId),
              status: 'failed',
              error: status.error,
            });
            this._tunnels.delete(ruleId);
          } else if (status.kind === 'stopped') {
            this._removeTunnelState(ruleId);
            this._tunnels.delete(ruleId);
          }
        },
        onStatsUpdate: (stats) => {
          if (this._disposed) {
            return;
          }
          this._statsBuffer.set(ruleId, stats);
          this._statsTick$.next();
        },
      };

      const connection = session.connection;

      if (rule.type !== 'dynamic') {
        if (!rule.destinationAddress || rule.destinationPort == null) {
          throw new Error(`Rule ${ruleId} (${rule.type}) missing destination address/port`);
        }
      }

      switch (rule.type) {
        case 'local':
          handle = await connection.startLocalForward(
            {
              bindAddress: rule.bindAddress,
              bindPort: rule.bindPort,
              destinationAddress: rule.destinationAddress!,
              destinationPort: rule.destinationPort!,
            },
            callback
          );
          break;
        case 'remote':
          handle = await connection.startRemoteForward(
            {
              bindAddress: rule.bindAddress,
              bindPort: rule.bindPort,
              destinationAddress: rule.destinationAddress!,
              destinationPort: rule.destinationPort!,
            },
            callback
          );
          break;
        case 'dynamic':
          handle = await connection.startDynamicForward(
            {
              bindAddress: rule.bindAddress,
              bindPort: rule.bindPort,
            },
            callback
          );
          break;
        default:
          throw new Error(`Unknown port forwarding type: ${rule.type}`);
      }

      // The await above can race with dispose() and with a synchronous 'failed'
      // status callback. In either case the published state is no longer 'starting'
      // and the handle must be stopped instead of being adopted as the live tunnel.
      if (this._disposed) {
        void handle.stop().catch(() => {});
        return;
      }
      const settled = this._tunnelStates$.getValue().get(ruleId);
      if (!settled || settled.status === 'failed' || settled.status === 'stopped') {
        void handle.stop().catch(() => {});
        return;
      }
      this._tunnels.set(ruleId, handle);
    } catch (err) {
      if (handle) {
        void handle.stop().catch(() => {});
      }
      const message = err instanceof Error ? err.message : String(err);
      this._logService.warn(`[MobilePortForwardingService] startRule ${ruleId} failed:`, message);
      if (!this._disposed) {
        this._patchTunnelState(ruleId, {
          ruleId,
          status: 'failed',
          error: message,
          activeConnections: 0,
          totalConnections: 0,
          bytesIn: 0,
          bytesOut: 0,
        });
      }
    }
  }

  async stopRule(ruleId: string): Promise<void> {
    const handle = this._tunnels.get(ruleId);
    if (!handle) {
      this._removeTunnelState(ruleId);
      return;
    }

    this._logService.log(`[MobilePortForwardingService] stopRule ${ruleId}`);

    try {
      await handle.stop();
    } catch (err) {
      this._logService.warn(`[MobilePortForwardingService] stopRule ${ruleId} error:`, err);
    }

    this._tunnels.delete(ruleId);
    this._removeTunnelState(ruleId);
  }

  getTunnelState(ruleId: string): IPortForwardingTunnelState | undefined {
    return this._tunnelStates$.getValue().get(ruleId);
  }

  private _currentState(ruleId: string): IPortForwardingTunnelState {
    return this.getTunnelState(ruleId) ?? {
      ruleId,
      status: 'idle',
      activeConnections: 0,
      totalConnections: 0,
      bytesIn: 0,
      bytesOut: 0,
    };
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

  private _flushStats(): void {
    if (this._statsBuffer.size === 0) {
      return;
    }
    const current = this._tunnelStates$.getValue();
    const next = new Map(current);
    let changed = false;
    for (const [ruleId, stats] of this._statsBuffer) {
      const prev = next.get(ruleId);
      if (!prev || prev.status === 'failed' || prev.status === 'stopped') {
        continue;
      }
      next.set(ruleId, {
        ruleId,
        status: prev.status,
        effectiveBindPort: prev.effectiveBindPort,
        activeConnections: stats.activeConnections,
        totalConnections: stats.totalConnections,
        bytesIn: Number(stats.bytesIn),
        bytesOut: Number(stats.bytesOut),
      });
      changed = true;
    }
    this._statsBuffer.clear();
    if (changed) {
      this._tunnelStates$.next(next);
    }
  }
}
