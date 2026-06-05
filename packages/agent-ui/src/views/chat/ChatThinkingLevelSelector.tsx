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

import type { ThinkingLevel } from '@termlnk/agent';
import type { LucideIcon } from 'lucide-react';
import { DEFAULT_THINKING_LEVEL } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, cn, HoverPanel, HoverPanelBody, HoverPanelContent, HoverPanelHeader, HoverPanelTrigger, useDependency, useObservable } from '@termlnk/design';
import { IAIAgentClientService, IProviderConfigService } from '@termlnk/rpc-client';
import { Ban, Check, Lightbulb } from 'lucide-react';
import { useCallback, useState } from 'react';

interface IThinkingLevelOption {
  value: ThinkingLevel;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  badge: string;
}

const THINKING_LEVEL_OPTIONS: IThinkingLevelOption[] = [
  { value: 'off', labelKey: 'agent-ui.chat.thinking-level-off', descriptionKey: 'agent-ui.chat.thinking-level-off-desc', icon: Ban, badge: '' },
  { value: 'minimal', labelKey: 'agent-ui.chat.thinking-level-minimal', descriptionKey: 'agent-ui.chat.thinking-level-minimal-desc', icon: Lightbulb, badge: 'MI' },
  { value: 'low', labelKey: 'agent-ui.chat.thinking-level-low', descriptionKey: 'agent-ui.chat.thinking-level-low-desc', icon: Lightbulb, badge: 'L' },
  { value: 'medium', labelKey: 'agent-ui.chat.thinking-level-medium', descriptionKey: 'agent-ui.chat.thinking-level-medium-desc', icon: Lightbulb, badge: 'M' },
  { value: 'high', labelKey: 'agent-ui.chat.thinking-level-high', descriptionKey: 'agent-ui.chat.thinking-level-high-desc', icon: Lightbulb, badge: 'H' },
  { value: 'xhigh', labelKey: 'agent-ui.chat.thinking-level-xhigh', descriptionKey: 'agent-ui.chat.thinking-level-xhigh-desc', icon: Lightbulb, badge: 'XH' },
];

export function ChatThinkingLevelSelector() {
  const aiAgentService = useDependency(IAIAgentClientService);
  const providerConfigService = useDependency(IProviderConfigService);
  const localeService = useDependency(LocaleService);
  const activeModel = useObservable(providerConfigService.activeModel$, null);

  const [selectedLevel, setSelectedLevel] = useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL as ThinkingLevel);

  const supportsReasoning = activeModel?.reasoning === true;
  const activeBadge = THINKING_LEVEL_OPTIONS.find((o) => o.value === selectedLevel)?.badge ?? '';

  const handleLevelChange = useCallback((level: ThinkingLevel) => {
    if (!supportsReasoning) {
      return;
    }
    setSelectedLevel(level);
    void aiAgentService.setThinkingLevel(level);
  }, [aiAgentService, supportsReasoning]);

  return (
    <HoverPanel>
      <HoverPanelTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            'tm:relative tm:flex tm:size-7 tm:text-light-grey tm:transition-colors',
            { 'tm:opacity-50': !supportsReasoning }
          )}
          title={localeService.t('agent-ui.chat.thinking-level')}
          aria-label={localeService.t('agent-ui.chat.thinking-level')}
        >
          <Lightbulb size={12} />
          {activeBadge && supportsReasoning && (
            <span
              className="
                tm:absolute tm:-top-1 tm:-right-1.5 tm:flex tm:h-3 tm:min-w-3 tm:items-center tm:justify-center
                tm:rounded-full tm:bg-blue tm:px-0.5 tm:text-[6px] tm:leading-none tm:font-bold tm:text-[#fff]
              "
            >
              {activeBadge}
            </span>
          )}
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
            <div
              className="tm:flex tm:size-4 tm:shrink-0 tm:items-center tm:justify-center tm:text-light-grey"
            >
              <Lightbulb className="tm:size-3" />
            </div>
            <div className="tm:min-w-0">
              <div className="tm:text-[12px] tm:font-semibold tm:text-white">
                {localeService.t('agent-ui.chat.thinking-level')}
              </div>
            </div>
          </div>
          <div className="tm:col-span-2 tm:text-[9px]/3.5 tm:text-light-grey">
            {localeService.t('agent-ui.chat.thinking-level-hint')}
          </div>
        </HoverPanelHeader>

        <HoverPanelBody className="tm:max-h-88 tm:bg-black">
          {!supportsReasoning
            ? (
              <div
                className="
                  tm:flex tm:flex-col tm:items-center tm:justify-center tm:gap-1.5 tm:px-3 tm:py-12 tm:text-center
                "
              >
                <div className="tm:max-w-full tm:text-[10px]/4.5 tm:text-light-grey">
                  {localeService.t('agent-ui.chat.thinking-level-unsupported')}
                </div>
              </div>
            )
            : (
              <div className="tm:flex tm:flex-col tm:py-1" role="radiogroup">
                {THINKING_LEVEL_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedLevel === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleLevelChange(option.value)}
                      className={cn(
                        `
                          tm:flex tm:w-full tm:items-center tm:gap-2.5 tm:px-3 tm:py-2 tm:text-left tm:transition-colors
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
            )}
        </HoverPanelBody>
      </HoverPanelContent>
    </HoverPanel>
  );
}
