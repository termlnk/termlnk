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
import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { IContextMenuService } from '@termlnk/ui';
import { ArrowRightLeft, CirclePlus } from 'lucide-react';
import { useCallback } from 'react';
import { PORT_FORWARDING_NEW_RULE_MENU } from '../controllers/new-rule.menu';
import { IRuleDialogService } from '../services/rule-dialog/rule-dialog.service';
import { useRuleList } from './hooks/use-rule-list';
import { RuleListItem } from './rule-list/RuleListItem';

export function PortForwardingExplorer() {
  const localeService = useDependency(LocaleService);
  const contextMenuService = useDependency(IContextMenuService);
  const ruleDialog = useDependency(IRuleDialogService);
  const dialogState = useObservable(ruleDialog.state$, ruleDialog.getState());
  const rules = useRuleList();
  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  const openAddMenu = (e: React.MouseEvent): void => {
    contextMenuService.triggerContextMenu(e.nativeEvent, PORT_FORWARDING_NEW_RULE_MENU);
  };

  const handleSelect = (ruleId: string): void => {
    ruleDialog.openEdit(ruleId);
  };

  const highlightedId = dialogState.open && dialogState.mode === 'edit' ? dialogState.ruleId : null;

  return (
    <div className="tm:flex tm:size-full tm:flex-col tm:bg-black2 tm:text-light-grey">
      <div
        className={cn(`
          tm:box-border tm:flex tm:h-10 tm:w-full tm:flex-row tm:items-center tm:px-2 tm:text-[12px] tm:font-normal
          tm:select-none
        `)}
      >
        <div className="tm:flex tm:size-full tm:items-center tm:truncate tm:overflow-hidden tm:text-white">
          {t('port-forwarding-ui.menu.title')}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={openAddMenu}
        >
          <CirclePlus strokeWidth={1.5} size={14} />
        </Button>
      </div>

      {rules.length === 0
        ? (
          <div
            className={cn(`
              tm:flex tm:flex-1 tm:flex-col tm:items-center tm:justify-center tm:gap-2 tm:p-6 tm:text-center
              tm:text-grey-fg
            `)}
          >
            <ArrowRightLeft className="tm:size-10 tm:opacity-40" />
            <span className="tm:text-sm">{t('port-forwarding-ui.list.empty')}</span>
          </div>
        )
        : (
          <div className={cn('tm:flex tm:min-h-0 tm:flex-1 tm:flex-col tm:gap-1.5 tm:overflow-y-auto tm:px-2 tm:pb-2')}>
            {rules.map((rule) => (
              <RuleListItem
                key={rule.id}
                rule={rule}
                selected={rule.id === highlightedId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
    </div>
  );
}
