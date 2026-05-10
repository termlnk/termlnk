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

import { LocaleService, LocaleType } from '@termlnk/core';
import { Card, CardContent, CardHeader, cn, Field, FieldContent, FieldGroup, FieldLabel, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useDependency } from '@termlnk/design';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { UI_PLUGIN_CONFIG_KEY } from '@termlnk/ui';
import { useCallback, useState } from 'react';

export function AppearanceTab() {
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);

  const [currentLocale, setCurrentLocale] = useState<string>(localeService.getCurrentLocale());

  const handleLocaleChange = useCallback(
    (value: string) => {
      setCurrentLocale(value);
      localeService.setLocale(value as LocaleType);
      void configManagerService.setField(UI_PLUGIN_CONFIG_KEY, 'locale', value);
    },
    [localeService, configManagerService]
  );

  return (
    <FieldGroup className="tm:gap-5">
      {/* Language Settings — host-agnostic, lives in the shared appearance tab. */}
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">
            {localeService.t('settings-ui.appearance.language-settings-title')}
          </h3>
        </CardHeader>
        <CardContent>
          <FieldGroup className="tm:my-4">
            <Field orientation="horizontal">
              <FieldLabel className={cn('tm:h-8 tm:w-28 tm:flex-none tm:shrink-0 tm:text-sm/8 tm:font-normal')}>
                {localeService.t('settings-ui.appearance.language')}
              </FieldLabel>
              <FieldContent className="tm:items-end">
                <Select value={currentLocale} onValueChange={handleLocaleChange}>
                  <SelectTrigger className={cn('tm:h-8 tm:w-40 tm:px-2 tm:text-xs')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LocaleType.ZH_CN}>中文（简体）</SelectItem>
                    <SelectItem value={LocaleType.ZH_TW}>中文（繁體）</SelectItem>
                    <SelectItem value={LocaleType.EN_US}>English</SelectItem>
                    <SelectItem value={LocaleType.JA_JP}>日本語</SelectItem>
                    <SelectItem value={LocaleType.KO_KR}>한국어</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </FieldGroup>
  );
}
