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

import type { IPortForwardingRuleEntity } from '@termlnk/database';
import type { IPortForwardingRule, IPortForwardingRuleCreateInput, IPortForwardingRuleUpdateInput, IPortForwardingRuntimeState, PortForwardingAuthEvent, PortForwardingHostKeyAction } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import type { IPortForwardingTunnel, IPortForwardingTunnelDeps } from './port-forwarding-tunnel';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository, HostRepository, PortForwardingRuleRepository } from '@termlnk/database';
import { IPortForwardingService, PortForwardingTunnelStatus, PortForwardingType } from '@termlnk/rpc';
import { BehaviorSubject, EMPTY, of, Subject } from 'rxjs';
import { filter, startWith, switchMap } from 'rxjs/operators';
import { ISSHHostChainService } from '../ssh/ssh-host-chain.service';
import { ISSHSocketService } from '../ssh/ssh-socket.service';
import { DynamicForwardingTunnel } from './dynamic-forwarding-tunnel';
import { LocalForwardingTunnel } from './local-forwarding-tunnel';
import { RemoteForwardingTunnel } from './remote-forwarding-tunnel';

const TUNNEL_CTOR_BY_TYPE: Record<PortForwardingType, new (deps: IPortForwardingTunnelDeps) => IPortForwardingTunnel> = {
  [PortForwardingType.LOCAL]: LocalForwardingTunnel,
  [PortForwardingType.REMOTE]: RemoteForwardingTunnel,
  [PortForwardingType.DYNAMIC]: DynamicForwardingTunnel,
};

function toRule(entity: IPortForwardingRuleEntity): IPortForwardingRule {
  return {
    id: entity.id,
    label: entity.label,
    // drizzle stores `type` as a typed text column whose static type is the
    // string union; coerce to the enum for the public RPC contract.
    type: entity.type as PortForwardingType,
    hostId: entity.hostId,
    bindAddress: entity.bindAddress,
    bindPort: entity.bindPort,
    destinationAddress: entity.destinationAddress,
    destinationPort: entity.destinationPort,
    sort: entity.sort,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export class PortForwardingService extends Disposable implements IPortForwardingService {
  private readonly _tunnels = new Map<string, IPortForwardingTunnel>();
  private readonly _tunnelChange$ = new Subject<string>();
  private readonly _rules$ = new BehaviorSubject<IPortForwardingRule[]>([]);
  readonly rules$ = this._rules$.asObservable();

  constructor(
    @Inject(PortForwardingRuleRepository) private readonly _repository: PortForwardingRuleRepository,
    @Inject(HostRepository) private readonly _hostRepository: HostRepository,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @ISSHSocketService private readonly _sshSocketService: ISSHSocketService,
    @ISSHHostChainService private readonly _sshHostChainService: ISSHHostChainService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    void this._bootstrap();
    this.disposeWithMe(this._repository.changed$.subscribe(() => {
      void this._refresh();
    }));
  }

  override dispose(): void {
    super.dispose();
    for (const tunnel of this._tunnels.values()) {
      tunnel.dispose();
    }
    this._tunnels.clear();
    this._tunnelChange$.complete();
    this._rules$.complete();
  }

  async listRules(): Promise<IPortForwardingRule[]> {
    const rows = await this._repository.getList();
    return rows.map(toRule);
  }

  async createRule(input: IPortForwardingRuleCreateInput): Promise<IPortForwardingRule> {
    const entity = await this._repository.create({
      label: input.label,
      type: input.type,
      hostId: input.hostId,
      bindAddress: input.bindAddress,
      bindPort: input.bindPort,
      destinationAddress: input.destinationAddress ?? null,
      destinationPort: input.destinationPort ?? null,
    });
    return toRule(entity);
  }

  async updateRule(id: string, patch: IPortForwardingRuleUpdateInput): Promise<IPortForwardingRule> {
    const entity = await this._repository.update(id, patch);
    // A live tunnel was built from the now-stale rule (bind/destination baked
    // into the listener / forwardOut call). Stop it so the user explicitly
    // restarts with the new config; auto-restart would lose the stored
    // password and may silently reprompt.
    if (this._tunnels.has(id)) {
      await this.stopRule(id).catch((err) => {
        this._logService.warn(`[PortForwardingService] stop on update failed for ${id}`, err);
      });
    }
    return toRule(entity);
  }

  async deleteRule(id: string): Promise<void> {
    const tunnel = this._tunnels.get(id);
    if (tunnel) {
      await tunnel.stop().catch((err) => this._logService.warn(`[PortForwardingService] stop on delete failed for ${id}`, err));
      tunnel.dispose();
      this._tunnels.delete(id);
      this._tunnelChange$.next(id);
    }
    await this._repository.delete(id);
  }

  async startRule(ruleId: string, options?: { password?: string }): Promise<void> {
    const existing = this._tunnels.get(ruleId);
    if (existing) {
      const status = existing.getState().status;
      if (status === PortForwardingTunnelStatus.FAILED || status === PortForwardingTunnelStatus.CLOSED) {
        existing.dispose();
        this._tunnels.delete(ruleId);
      } else {
        throw new Error(`Rule ${ruleId} is already running`);
      }
    }
    const entity = await this._repository.getById(ruleId);
    if (!entity) {
      throw new Error(`Rule ${ruleId} not found`);
    }
    const rule = toRule(entity);
    const Ctor = TUNNEL_CTOR_BY_TYPE[rule.type];
    if (!Ctor) {
      throw new Error(`Unsupported forwarding type: ${rule.type}`);
    }
    const tunnel = new Ctor({
      rule,
      hostRepository: this._hostRepository,
      configRepository: this._configRepository,
      sshSocketService: this._sshSocketService,
      sshHostChainService: this._sshHostChainService,
      logService: this._logService,
    });
    // Keep the tunnel in the map even when start() throws, so the renderer can
    // still read FAILED state and pending authEvent$ until the user explicitly
    // calls restartRule (which disposes and recreates).
    this._tunnels.set(ruleId, tunnel);
    this._tunnelChange$.next(ruleId);
    await tunnel.start(options);
  }

  async stopRule(ruleId: string): Promise<void> {
    const tunnel = this._tunnels.get(ruleId);
    if (!tunnel) {
      return;
    }
    await tunnel.stop();
    tunnel.dispose();
    this._tunnels.delete(ruleId);
    this._tunnelChange$.next(ruleId);
  }

  async restartRule(ruleId: string, options?: { password?: string }): Promise<void> {
    await this.stopRule(ruleId);
    await this.startRule(ruleId, options);
  }

  async respondKeyboardInteractive(ruleId: string, responses: string[]): Promise<void> {
    this._tunnels.get(ruleId)?.respondKeyboardInteractive(responses);
  }

  async respondChangePassword(ruleId: string, newPassword: string): Promise<void> {
    this._tunnels.get(ruleId)?.respondChangePassword(newPassword);
  }

  async respondHostKeyPrompt(ruleId: string, action: PortForwardingHostKeyAction): Promise<void> {
    this._tunnels.get(ruleId)?.respondHostKeyPrompt(action);
  }

  state$(ruleId: string): Observable<IPortForwardingRuntimeState> {
    const idle: IPortForwardingRuntimeState = {
      ruleId,
      status: PortForwardingTunnelStatus.IDLE,
      activeConnections: 0,
      totalConnections: 0,
      bytesIn: 0,
      bytesOut: 0,
      bytesInRate: 0,
      bytesOutRate: 0,
    };
    return this._tunnelChange$.pipe(
      startWith(ruleId),
      filter((id) => id === ruleId),
      switchMap(() => {
        const tunnel = this._tunnels.get(ruleId);
        return tunnel ? tunnel.state$ : of(idle);
      }),
    );
  }

  authEvent$(ruleId: string): Observable<PortForwardingAuthEvent> {
    return this._tunnelChange$.pipe(
      startWith(ruleId),
      filter((id) => id === ruleId),
      switchMap(() => {
        const tunnel = this._tunnels.get(ruleId);
        return tunnel ? tunnel.authEvent$ : EMPTY;
      }),
    );
  }

  private async _bootstrap(): Promise<void> {
    await this._refresh();
  }

  private async _refresh(): Promise<void> {
    const rules = await this.listRules();
    this._rules$.next(rules);
  }
}
