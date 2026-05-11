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

import type { ISharedTerminalPluginConfig } from '@termlnk/shared-terminal';
import { IConfigService, LocaleService } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn, Switch, useDependency } from '@termlnk/design';
import { SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/shared-terminal';
import { VideoIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Default recording-on-collab-start policy (P5.5.7).
 *
 * Persists to ISharedTerminalPluginConfig.defaultRecording. Note that auditor-role
 * attaches still force-enable recording regardless of this setting — that's the
 * mandatory-recording invariant from §5.7.6.
 */
export function RecordingPolicyCard(): React.JSX.Element {
  const localeService = useDependency(LocaleService);
  const configService = useDependency(IConfigService);
  const initial = configService.getConfig<ISharedTerminalPluginConfig>(SHARED_TERMINAL_PLUGIN_CONFIG_KEY);
  const [enabled, setEnabled] = useState<boolean>(initial?.defaultRecording === 'on');

  // Keep local state aligned with the live config so external mutations (e.g. the
  // cloud-sync engine pulling a settings change from another device) reflect here.
  useEffect(() => {
    const current = configService.getConfig<ISharedTerminalPluginConfig>(SHARED_TERMINAL_PLUGIN_CONFIG_KEY);
    setEnabled(current?.defaultRecording === 'on');
  }, [configService]);

  const handleToggle = (next: boolean): void => {
    setEnabled(next);
    const current = configService.getConfig<ISharedTerminalPluginConfig>(SHARED_TERMINAL_PLUGIN_CONFIG_KEY) ?? {};
    configService.setConfig(SHARED_TERMINAL_PLUGIN_CONFIG_KEY, {
      ...current,
      defaultRecording: next ? 'on' : 'off',
    });
  };

  return (
    <Card className={cn('tm:bg-one-bg')}>
      <CardHeader>
        <CardTitle className={cn('tm:flex tm:items-center tm:gap-2')}>
          <VideoIcon className={cn('tm:size-4 tm:text-red')} />
          {localeService.t('shared-terminal-ui.recording-policy.title')}
        </CardTitle>
        <CardDescription>
          {localeService.t('shared-terminal-ui.recording-policy.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn('tm:flex tm:items-center tm:justify-between tm:gap-3')}>
        <div className={cn('tm:flex tm:min-w-0 tm:flex-col tm:gap-0.5')}>
          <span className={cn('tm:text-sm tm:text-light-grey')}>
            {localeService.t('shared-terminal-ui.recording-policy.default-on')}
          </span>
          <span className={cn('tm:text-xs tm:text-grey-fg')}>
            {localeService.t('shared-terminal-ui.recording-policy.default-on-hint')}
          </span>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </CardContent>
    </Card>
  );
}
