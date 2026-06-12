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

import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { PortForwardingTunnelStatus } from '@termlnk/rpc';

export interface IStatusBadgeProps {
  status: PortForwardingTunnelStatus;
}

const COLOR_BY_STATUS: Record<PortForwardingTunnelStatus, string> = {
  [PortForwardingTunnelStatus.IDLE]: 'tm:bg-grey',
  [PortForwardingTunnelStatus.STARTING]: 'tm:bg-yellow',
  [PortForwardingTunnelStatus.AUTHENTICATING]: 'tm:bg-yellow',
  [PortForwardingTunnelStatus.ACTIVE]: 'tm:bg-green',
  [PortForwardingTunnelStatus.FAILED]: 'tm:bg-red',
  [PortForwardingTunnelStatus.STOPPING]: 'tm:bg-yellow',
  [PortForwardingTunnelStatus.CLOSED]: 'tm:bg-grey',
};

const I18N_KEY_BY_STATUS: Record<PortForwardingTunnelStatus, string> = {
  [PortForwardingTunnelStatus.IDLE]: 'port-forwarding-ui.status.idle',
  [PortForwardingTunnelStatus.STARTING]: 'port-forwarding-ui.status.starting',
  [PortForwardingTunnelStatus.AUTHENTICATING]: 'port-forwarding-ui.status.authenticating',
  [PortForwardingTunnelStatus.ACTIVE]: 'port-forwarding-ui.status.active',
  [PortForwardingTunnelStatus.FAILED]: 'port-forwarding-ui.status.failed',
  [PortForwardingTunnelStatus.STOPPING]: 'port-forwarding-ui.status.stopping',
  [PortForwardingTunnelStatus.CLOSED]: 'port-forwarding-ui.status.closed',
};

export function StatusBadge({ status }: IStatusBadgeProps) {
  const localeService = useDependency(LocaleService);
  return (
    <span
      className={cn(
        `
          tm:inline-flex tm:min-w-0 tm:items-center tm:gap-1.5 tm:rounded-sm tm:bg-black2/55 tm:px-1.5 tm:py-0.5
          tm:text-[11px]/4 tm:text-grey-fg2
        `
      )}
    >
      <span className={cn('tm:inline-block tm:size-1.5 tm:shrink-0 tm:rounded-full', COLOR_BY_STATUS[status])} />
      {localeService.t(I18N_KEY_BY_STATUS[status])}
    </span>
  );
}
