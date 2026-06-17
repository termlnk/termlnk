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

import type { IPortForwardingRule } from '@termlnk/rpc';
import { ICommandService, LocaleService } from '@termlnk/core';
import { Button, cn, useDependency } from '@termlnk/design';
import { PortForwardingTunnelStatus, PortForwardingType } from '@termlnk/rpc';
import { IContextMenuService } from '@termlnk/ui';
import { Play, Square } from 'lucide-react';
import { StartRuleCommand } from '../../commands/start-rule.command';
import { StopRuleCommand } from '../../commands/stop-rule.command';
import { PORT_FORWARDING_RULE_CONTEXT_MENU } from '../../controllers/rule-context.menu';
import { IRuleContextService } from '../../services/rule-context/rule-context.service';
import { isRunning, useRuleState } from '../hooks/use-rule-list';
import { StatusBadge } from '../status/StatusBadge';
import { TrafficStats } from '../status/TrafficStats';

export interface IRuleListItemProps {
  rule: IPortForwardingRule;
  selected: boolean;
  onSelect: (ruleId: string) => void;
}

const LETTER_BY_TYPE: Record<PortForwardingType, string> = {
  [PortForwardingType.LOCAL]: 'L',
  [PortForwardingType.REMOTE]: 'R',
  [PortForwardingType.DYNAMIC]: 'D',
};

const FALLBACK_LABEL_BY_TYPE: Record<PortForwardingType, string> = {
  [PortForwardingType.LOCAL]: 'port-forwarding-ui.editor.typeLocal',
  [PortForwardingType.REMOTE]: 'port-forwarding-ui.editor.typeRemote',
  [PortForwardingType.DYNAMIC]: 'port-forwarding-ui.editor.typeDynamic',
};

function formatRuleFlow(rule: IPortForwardingRule): string {
  if (rule.type === PortForwardingType.DYNAMIC) {
    return `socks5://${rule.bindAddress}:${rule.bindPort}`;
  }
  const bind = `${rule.bindAddress}:${rule.bindPort}`;
  const dst = `${rule.destinationAddress ?? ''}:${rule.destinationPort ?? ''}`;
  return `${bind} → ${dst}`;
}

export function RuleListItem({ rule, selected, onSelect }: IRuleListItemProps) {
  const commandService = useDependency(ICommandService);
  const localeService = useDependency(LocaleService);
  const contextMenuService = useDependency(IContextMenuService);
  const ruleContextService = useDependency(IRuleContextService);
  const state = useRuleState(rule.id);
  const status = state?.status ?? PortForwardingTunnelStatus.IDLE;
  const running = isRunning(status);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    void commandService.executeCommand(running ? StopRuleCommand.id : StartRuleCommand.id, { ruleId: rule.id });
  };

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    ruleContextService.setTarget({ rule, status });
    contextMenuService.triggerContextMenu(e.nativeEvent, PORT_FORWARDING_RULE_CONTEXT_MENU);
  };

  return (
    <div
      onClick={() => onSelect(rule.id)}
      onContextMenu={handleContextMenu}
      className={cn(`
        tm:group
        tm:flex tm:flex-col tm:gap-2 tm:rounded-md tm:border tm:border-line/70 tm:bg-black tm:px-2.5
        tm:py-2 tm:transition-[background-color,border-color,box-shadow]
        tm:hover:border-one-bg3 tm:hover:bg-one-bg2 tm:hover:shadow-xs
      `, {
        'tm:border-blue/45 tm:bg-one-bg2 tm:shadow-xs': selected,
      })}
    >
      <div className={cn('tm:flex tm:items-start tm:gap-2')}>
        <div
          className={cn(`
            tm:flex tm:size-8 tm:shrink-0 tm:items-center tm:justify-center tm:rounded-md tm:bg-blue tm:text-sm
            tm:font-semibold tm:text-[#fff]
          `)}
        >
          {LETTER_BY_TYPE[rule.type]}
        </div>
        <div className={cn('tm:flex tm:min-w-0 tm:flex-1 tm:flex-col tm:gap-0.5')}>
          <span className={cn('tm:truncate tm:text-sm/5 tm:font-medium tm:text-white')}>
            {rule.label || localeService.t(FALLBACK_LABEL_BY_TYPE[rule.type])}
          </span>
          <span className={cn('tm:truncate tm:text-[11px]/4 tm:text-grey-fg2')}>
            {formatRuleFlow(rule)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={toggle}
          className={cn(`
            tm:-mr-1 tm:shrink-0 tm:text-grey-fg tm:opacity-65
            tm:group-hover:opacity-100
            tm:hover:bg-one-bg3 tm:hover:text-white tm:hover:opacity-100
          `, {
            'tm:text-green': running,
            'tm:opacity-100': selected,
          })}
          title={localeService.t(running ? 'port-forwarding-ui.action.stop' : 'port-forwarding-ui.action.start')}
        >
          {running ? <Square className="tm:size-3.5" /> : <Play className="tm:size-3.5" />}
        </Button>
      </div>
      <div className={cn('tm:flex tm:min-w-0 tm:items-center tm:justify-between tm:gap-2 tm:pl-10')}>
        <StatusBadge status={status} />
        {state && status === PortForwardingTunnelStatus.ACTIVE && (
          <TrafficStats
            bytesIn={state.bytesIn}
            bytesOut={state.bytesOut}
            bytesInRate={state.bytesInRate}
            bytesOutRate={state.bytesOutRate}
            activeConnections={state.activeConnections}
          />
        )}
        {state?.error && status === PortForwardingTunnelStatus.FAILED && (
          <span className={cn('tm:truncate tm:text-[11px] tm:text-red')}>{state.error}</span>
        )}
      </div>
    </div>
  );
}
