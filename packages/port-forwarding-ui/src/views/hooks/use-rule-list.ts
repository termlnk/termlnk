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

import type { IPortForwardingRule, IPortForwardingRuntimeState } from '@termlnk/rpc';
import { useDependency, useObservable } from '@termlnk/design';
import { IPortForwardingService, PortForwardingTunnelStatus } from '@termlnk/rpc';
import { useMemo } from 'react';
import { distinctUntilChanged } from 'rxjs';

// The service's rules$ is a BehaviorSubject that bootstraps from the DB before
// emitting; subscribing alone is sufficient (no parallel listRules() race).
export function useRuleList(): IPortForwardingRule[] {
  const service = useDependency(IPortForwardingService);
  return useObservable(service.rules$, []);
}

export function useRule(ruleId: string | null): IPortForwardingRule | null {
  const rules = useRuleList();
  return useMemo(() => {
    if (!ruleId) {
      return null;
    }
    return rules.find((r) => r.id === ruleId) ?? null;
  }, [rules, ruleId]);
}

export function useRuleState(ruleId: string): IPortForwardingRuntimeState | null {
  const service = useDependency(IPortForwardingService);
  const state$ = useMemo(() => service.state$(ruleId).pipe(distinctUntilChanged((a, b) => (
    a.status === b.status
    && a.activeConnections === b.activeConnections
    && a.bytesIn === b.bytesIn
    && a.bytesOut === b.bytesOut
    && a.bytesInRate === b.bytesInRate
    && a.bytesOutRate === b.bytesOutRate
    && a.error === b.error
  ))), [service, ruleId]);
  return useObservable(state$) ?? null;
}

export function isRunning(status: PortForwardingTunnelStatus | undefined): boolean {
  return status === PortForwardingTunnelStatus.ACTIVE
    || status === PortForwardingTunnelStatus.STARTING
    || status === PortForwardingTunnelStatus.AUTHENTICATING;
}
