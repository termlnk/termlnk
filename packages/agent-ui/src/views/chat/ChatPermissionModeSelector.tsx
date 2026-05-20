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

import type { ToolPermissionMode } from '@termlnk/agent';
import type { LucideIcon } from 'lucide-react';
import { LocaleService } from '@termlnk/core';
import { Button, cn, HoverPanel, HoverPanelBody, HoverPanelContent, HoverPanelHeader, HoverPanelTrigger, useDependency, useObservable } from '@termlnk/design';
import { IAgentToolPermissionService } from '@termlnk/rpc-client';
import { Check, Eye, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import { useCallback } from 'react';

interface IPermissionModeOption {
  value: ToolPermissionMode;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
}

const PERMISSION_MODE_OPTIONS: IPermissionModeOption[] = [
  { value: 'default', labelKey: 'agent-ui.permission.mode-default', descriptionKey: 'agent-ui.permission.mode-default-desc', icon: ShieldCheck },
  { value: 'auto', labelKey: 'agent-ui.permission.mode-auto', descriptionKey: 'agent-ui.permission.mode-auto-desc', icon: Zap },
  { value: 'strict', labelKey: 'agent-ui.permission.mode-strict', descriptionKey: 'agent-ui.permission.mode-strict-desc', icon: ShieldAlert },
  { value: 'plan', labelKey: 'agent-ui.permission.mode-plan', descriptionKey: 'agent-ui.permission.mode-plan-desc', icon: Eye },
];

export function ChatPermissionModeSelector() {
  const permissionService = useDependency(IAgentToolPermissionService);
  const localeService = useDependency(LocaleService);

  const mode = useObservable(permissionService.mode$, 'default' as ToolPermissionMode);
  const activeOption = PERMISSION_MODE_OPTIONS.find((o) => o.value === mode) ?? PERMISSION_MODE_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  const handleModeChange = useCallback((next: ToolPermissionMode) => {
    if (next === mode) {
      return;
    }
    void permissionService.setMode(next);
  }, [mode, permissionService]);

  return (
    <HoverPanel>
      <HoverPanelTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="tm:relative tm:flex tm:size-7 tm:text-light-grey tm:transition-colors"
          title={localeService.t('agent-ui.permission.mode')}
          aria-label={localeService.t('agent-ui.permission.mode')}
        >
          <ActiveIcon size={12} />
        </Button>
      </HoverPanelTrigger>

      <HoverPanelContent
        side="top"
        align="start"
        className="tm:w-62 tm:min-w-62 tm:border-line tm:bg-black tm:p-0 tm:shadow-none tm:[box-shadow:none]"
      >
        <HoverPanelHeader
          className="
            tm:grid tm:min-h-10 tm:grid-cols-[minmax(0,1fr)_auto] tm:items-center tm:gap-x-1 tm:gap-y-1.5 tm:px-3
            tm:py-1.5 tm:select-none
          "
        >
          <div className="tm:flex tm:min-w-0 tm:items-center tm:gap-1">
            <div className="tm:flex tm:size-4 tm:shrink-0 tm:items-center tm:justify-center tm:text-light-grey">
              <ShieldCheck className="tm:size-3" />
            </div>
            <div className="tm:min-w-0">
              <div className="tm:text-[12px] tm:font-semibold tm:text-white">
                {localeService.t('agent-ui.permission.mode')}
              </div>
            </div>
          </div>
          <div className="tm:col-span-2 tm:text-[9px]/3.5 tm:text-light-grey">
            {localeService.t('agent-ui.permission.mode-hint')}
          </div>
        </HoverPanelHeader>

        <HoverPanelBody className="tm:max-h-88 tm:bg-black">
          <div className="tm:flex tm:flex-col tm:py-1" role="radiogroup">
            {PERMISSION_MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleModeChange(option.value)}
                  className={cn(
                    `
                      tm:flex tm:w-full tm:cursor-pointer tm:items-center tm:gap-2.5 tm:px-3 tm:py-2 tm:text-left
                      tm:transition-colors
                      tm:hover:bg-one-bg
                    `,
                    { 'tm:bg-one-bg': isSelected }
                  )}
                >
                  <div
                    className={cn(
                      'tm:flex tm:size-4 tm:shrink-0 tm:items-center tm:justify-center',
                      { 'tm:text-blue': isSelected, 'tm:text-light-grey': !isSelected }
                    )}
                  >
                    <Icon className="tm:size-3.5" />
                  </div>
                  <div className="tm:min-w-0 tm:flex-1">
                    <div className="tm:text-[12px] tm:font-semibold tm:text-white">
                      {localeService.t(option.labelKey)}
                    </div>
                    <div className="tm:text-[9px]/3.5 tm:text-grey-fg">
                      {localeService.t(option.descriptionKey)}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="tm:size-3.5 tm:shrink-0 tm:text-blue" />
                  )}
                </button>
              );
            })}
          </div>
        </HoverPanelBody>
      </HoverPanelContent>
    </HoverPanel>
  );
}
