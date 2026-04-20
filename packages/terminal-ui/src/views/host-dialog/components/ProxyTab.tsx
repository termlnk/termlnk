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

import type { IProxy } from '@termlnk/terminal';
import type { HostFormItem } from '../../../models/host-dialog.state';
import { LocaleService } from '@termlnk/core';
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, useDependency } from '@termlnk/design';

export interface IProxyTabProps {
  data: HostFormItem;
  onChange: (data: Partial<HostFormItem>) => void;
  getError: (path: string) => string | undefined;
}

const horizontalLabelCls = 'tm:w-28 tm:shrink-0 tm:flex-none tm:text-xs tm:h-8 tm:leading-8';
const compactInputCls = 'tm:h-8 tm:px-2 tm:py-1 tm:text-xs';
const compactSelectCls = 'tm:h-8 tm:w-40 tm:px-2 tm:text-xs';
const inputLabelCls = 'tm:text-xs tm:font-medium tm:text-white';

export function ProxyTab(props: IProxyTabProps) {
  const { data, onChange, getError } = props;
  const localeService = useDependency(LocaleService);

  const updateProxy = (updates: Partial<IProxy>) => {
    onChange({
      proxy: { ...(data.proxy ?? {}), ...updates } as Partial<IProxy>,
    });
  };

  return (
    <FieldGroup className="tm:gap-3">
      <Field orientation="horizontal">
        <FieldLabel className={horizontalLabelCls}>
          {localeService.t('terminal-ui.host-dialog.proxy.enable')}
        </FieldLabel>
        <Switch
          checked={data.proxy?.enabled ?? false}
          onCheckedChange={(checked) => updateProxy({ enabled: checked })}
        />
      </Field>

      {data.proxy?.enabled && (
        <FieldGroup className="tm:mt-1 tm:gap-4">
          <Field orientation="horizontal">
            <FieldLabel className={horizontalLabelCls}>
              {localeService.t('terminal-ui.host-dialog.proxy.type')}
            </FieldLabel>
            <FieldContent className="tm:items-end">
              <Select
                value={data.proxy?.type ?? 'socks5'}
                onValueChange={(v) => updateProxy({ type: v as 'socks5' | 'http' })}
              >
                <SelectTrigger className={compactSelectCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="socks5">SOCKS5</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <div className="tm:grid tm:grid-cols-2 tm:gap-4">
            <Field data-invalid={!!getError('proxy.host')}>
              <FieldLabel htmlFor="proxy-host" className={inputLabelCls}>
                {localeService.t('terminal-ui.host-dialog.proxy.host')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="proxy-host"
                  className={compactInputCls}
                  value={data.proxy?.host ?? ''}
                  onChange={(e) => updateProxy({ host: e.target.value })}
                  placeholder="127.0.0.1"
                />
                <FieldError>{getError('proxy.host')}</FieldError>
              </FieldContent>
            </Field>

            <Field data-invalid={!!getError('proxy.port')}>
              <FieldLabel htmlFor="proxy-port" className={inputLabelCls}>
                {localeService.t('terminal-ui.host-dialog.proxy.port')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="proxy-port"
                  className={compactInputCls}
                  type="number"
                  value={typeof data.proxy?.port === 'number' ? data.proxy.port : ''}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    updateProxy({ port: Number.isNaN(parsed) ? undefined : parsed });
                  }}
                  placeholder="1080"
                />
                <FieldError>{getError('proxy.port')}</FieldError>
              </FieldContent>
            </Field>
          </div>

          <div className="tm:grid tm:grid-cols-2 tm:gap-4">
            <Field>
              <FieldLabel htmlFor="proxy-username" className={inputLabelCls}>
                {localeService.t('terminal-ui.host-dialog.field.username')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="proxy-username"
                  className={compactInputCls}
                  value={data.proxy?.username ?? ''}
                  onChange={(e) => updateProxy({ username: e.target.value })}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="proxy-password" className={inputLabelCls}>
                {localeService.t('terminal-ui.host-dialog.field.password')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="proxy-password"
                  className={compactInputCls}
                  type="password"
                  value={data.proxy?.password ?? ''}
                  onChange={(e) => updateProxy({ password: e.target.value })}
                />
              </FieldContent>
            </Field>
          </div>
        </FieldGroup>
      )}
    </FieldGroup>
  );
}
