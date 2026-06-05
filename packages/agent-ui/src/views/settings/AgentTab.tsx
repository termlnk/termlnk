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

import type { ICompactConfig } from '@termlnk/agent';
import { AGENT_COMPACT_CONFIG_SUB_KEY, AGENT_CORE_CONFIG_KEY, COMPACT_CONFIG_MAX_KEEP_RECENT, COMPACT_CONFIG_MAX_THRESHOLD_PERCENT, COMPACT_CONFIG_MIN_KEEP_RECENT, COMPACT_CONFIG_MIN_THRESHOLD_PERCENT, DEFAULT_COMPACT_CONFIG, normalizeCompactConfig } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Card, CardContent, CardHeader, Checkbox, cn, Input, Slider, useDependency } from '@termlnk/design';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PermissionSection } from './permission/PermissionSection';

export function AgentTab() {
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);

  const [config, setConfig] = useState<ICompactConfig>(DEFAULT_COMPACT_CONFIG);
  const [keepRecentInput, setKeepRecentInput] = useState<string>(String(DEFAULT_COMPACT_CONFIG.keepRecentMessages));

  useEffect(() => {
    let active = true;
    configManagerService
      .getField<ICompactConfig>(AGENT_CORE_CONFIG_KEY, AGENT_COMPACT_CONFIG_SUB_KEY)
      .then((stored) => {
        if (!active) {
          return;
        }
        const normalized = normalizeCompactConfig(stored);
        setConfig(normalized);
        setKeepRecentInput(String(normalized.keepRecentMessages));
      })
      .catch((err) => {
        console.error('[AgentTab] Failed to load compact config:', err);
      });
    return () => {
      active = false;
    };
  }, [configManagerService]);

  const persist = useCallback(
    (next: ICompactConfig) => {
      const normalized = normalizeCompactConfig(next);
      setConfig(normalized);
      setKeepRecentInput(String(normalized.keepRecentMessages));
      void configManagerService.setField(AGENT_CORE_CONFIG_KEY, AGENT_COMPACT_CONFIG_SUB_KEY, normalized);
    },
    [configManagerService]
  );

  const handleEnabledChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      persist({ ...config, enabled: checked === true });
    },
    [config, persist]
  );

  const handleThresholdChange = useCallback(
    (values: number[]) => {
      const next = values[0] ?? config.thresholdPercent;
      persist({ ...config, thresholdPercent: next });
    },
    [config, persist]
  );

  const handleKeepRecentInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setKeepRecentInput(event.target.value);
  }, []);

  const handleKeepRecentBlur = useCallback(() => {
    const parsed = Number.parseInt(keepRecentInput, 10);
    if (Number.isFinite(parsed)) {
      persist({ ...config, keepRecentMessages: parsed });
    } else {
      setKeepRecentInput(String(config.keepRecentMessages));
    }
  }, [config, keepRecentInput, persist]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-5">
      <Card className="tm:gap-0 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <div className="tm:flex tm:items-center tm:gap-2">
            <Sparkles className="tm:size-4 tm:text-blue" />
            <h3 className="tm:text-sm tm:font-semibold tm:text-white">
              {localeService.t('agent-ui.compact.title')}
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="tm:flex tm:flex-col tm:gap-5 tm:py-4">
            <div className="tm:flex tm:flex-col tm:gap-1.5">
              <label className="tm:flex tm:items-center tm:gap-2">
                <Checkbox
                  checked={config.enabled}
                  onCheckedChange={handleEnabledChange}
                />
                <span className="tm:text-sm tm:font-medium tm:text-white">
                  {localeService.t('agent-ui.compact.enable')}
                </span>
              </label>
              <p className="tm:pl-7 tm:text-xs tm:text-grey-fg">
                {localeService.t('agent-ui.compact.enable-description')}
              </p>
            </div>

            <div
              className={cn('tm:flex tm:flex-col tm:gap-2', {
                'tm:pointer-events-none tm:opacity-55': !config.enabled,
              })}
            >
              <div className="tm:flex tm:items-center tm:justify-between">
                <span className="tm:text-sm tm:font-medium tm:text-white">
                  {localeService.t('agent-ui.compact.threshold')}
                </span>
                <span className="tm:text-sm tm:font-semibold tm:text-blue">
                  {config.thresholdPercent}
                  %
                </span>
              </div>
              <Slider
                value={[config.thresholdPercent]}
                min={COMPACT_CONFIG_MIN_THRESHOLD_PERCENT}
                max={COMPACT_CONFIG_MAX_THRESHOLD_PERCENT}
                step={1}
                onValueChange={handleThresholdChange}
                disabled={!config.enabled}
              />
              <div className="tm:flex tm:justify-between tm:text-[10px] tm:text-grey">
                <span>
                  {localeService.t('agent-ui.compact.threshold-early')}
                  {' '}
                  (
                  {COMPACT_CONFIG_MIN_THRESHOLD_PERCENT}
                  %)
                </span>
                <span>
                  {localeService.t('agent-ui.compact.threshold-late')}
                  {' '}
                  (
                  {COMPACT_CONFIG_MAX_THRESHOLD_PERCENT}
                  %)
                </span>
              </div>
              <p className="tm:text-xs tm:text-grey-fg">
                {localeService.t('agent-ui.compact.threshold-description')}
              </p>
            </div>

            <div
              className={cn('tm:flex tm:flex-col tm:gap-1.5', {
                'tm:pointer-events-none tm:opacity-55': !config.enabled,
              })}
            >
              <label className="tm:text-sm tm:font-medium tm:text-white" htmlFor="agent-compact-keep-recent">
                {localeService.t('agent-ui.compact.keep-recent')}
              </label>
              <Input
                id="agent-compact-keep-recent"
                type="number"
                min={COMPACT_CONFIG_MIN_KEEP_RECENT}
                max={COMPACT_CONFIG_MAX_KEEP_RECENT}
                step={1}
                value={keepRecentInput}
                onChange={handleKeepRecentInputChange}
                onBlur={handleKeepRecentBlur}
                disabled={!config.enabled}
                className="tm:h-8 tm:w-24 tm:text-xs"
              />
              <p className="tm:text-xs tm:text-grey-fg">
                {localeService.t(
                  'agent-ui.compact.keep-recent-description',
                  String(COMPACT_CONFIG_MIN_KEEP_RECENT),
                  String(COMPACT_CONFIG_MAX_KEEP_RECENT)
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <PermissionSection />
    </div>
  );
}
