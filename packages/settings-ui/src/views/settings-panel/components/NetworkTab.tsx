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

import type { IProxyTestResult } from '@termlnk/rpc-client';
import type { IProxy } from '@termlnk/terminal';
import { LocaleService } from '@termlnk/core';
import { Button, Card, CardContent, CardDescription, CardHeader, cn, Field, FieldContent, FieldGroup, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, useDependency } from '@termlnk/design';
import { IConfigManagerService, IProxyClientService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useMemo, useState } from 'react';

const NETWORK_CONFIG_KEY = 'network.config';

const DEFAULT_PROXY_TEST_TIMEOUT = 10_000;

interface IProxyTestState {
  status: 'idle' | 'testing' | 'success' | 'error';
  latency?: number;
  ip?: string;
  message?: string;
}

function createDefaultProxy(): IProxy {
  return {
    enabled: false,
    type: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    username: '',
    password: '',
  };
}

function createDefaultProxyTestState(): IProxyTestState {
  return {
    status: 'idle',
  };
}

function normalizeProxyConfig(value: Partial<IProxy> | null): IProxy {
  const defaults = createDefaultProxy();
  if (!value) {
    return defaults;
  }

  const port = Number.parseInt(String(value.port), 10);

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
    type: value.type === 'http' ? 'http' : defaults.type,
    host: typeof value.host === 'string' ? value.host : defaults.host,
    port: Number.isNaN(port) ? 0 : Math.max(0, Math.min(65535, port)),
    username: typeof value.username === 'string' ? value.username : defaults.username,
    password: typeof value.password === 'string' ? value.password : defaults.password,
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toConciseErrorMessage(message?: string): string {
  if (!message) {
    return '';
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.replace(/^All proxy test targets failed\.?/i, '').trim();
  const lower = normalized.toLowerCase();

  if (lower.includes('fetch failed')) {
    return 'fetch failed';
  }
  if (lower.includes('econnrefused')) {
    return 'connect ECONNREFUSED';
  }
  if (lower.includes('etimedout') || lower.includes('timed out') || lower.includes('timeout')) {
    return 'timed out';
  }
  if (lower.includes('enotfound') || lower.includes('eai_again')) {
    return 'dns lookup failed';
  }

  const firstPart = normalized.split('|')[0]?.trim() ?? normalized;
  if (firstPart.length <= 48) {
    return firstPart;
  }
  return `${firstPart.slice(0, 45)}...`;
}

function mapTestResult(result: IProxyTestResult): IProxyTestState {
  if (result.ok) {
    return {
      status: 'success',
      latency: result.latency,
      ip: result.ip,
    };
  }

  return {
    status: 'error',
    latency: result.latency,
    message: result.message,
  };
}

export function NetworkTab() {
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);
  const proxyClientService = useDependency(IProxyClientService);

  const [proxy, setProxy] = useState<IProxy>(createDefaultProxy);
  const [hostText, setHostText] = useState(() => createDefaultProxy().host);
  const [portText, setPortText] = useState(() => String(createDefaultProxy().port));
  const [testState, setTestState] = useState<IProxyTestState>(createDefaultProxyTestState);

  const canTestProxy = useMemo(() => {
    return (
      proxy.enabled
      && proxy.host.trim().length > 0
      && Number.isInteger(proxy.port)
      && proxy.port >= 1
      && proxy.port <= 65535
    );
  }, [proxy.enabled, proxy.host, proxy.port]);

  const persistProxy = useCallback((next: IProxy) => {
    void configManagerService.setField(NETWORK_CONFIG_KEY, 'proxy', next).catch(() => { });
  }, [configManagerService]);

  const updateProxy = useCallback((updates: Partial<IProxy>) => {
    setProxy((prev) => {
      const next = normalizeProxyConfig({ ...prev, ...updates });
      persistProxy(next);
      return next;
    });
    setTestState(createDefaultProxyTestState());
  }, [persistProxy]);

  const handleTestProxy = useCallback(async () => {
    if (!canTestProxy) {
      setTestState({
        status: 'error',
        message: localeService.t('settings-ui.network.proxy-test-missing'),
      });
      return;
    }

    setTestState({ status: 'testing' });

    try {
      const result = await proxyClientService.testProxy({
        enabled: true,
        type: proxy.type,
        host: proxy.host.trim(),
        port: proxy.port,
        username: normalizeOptionalText(proxy.username),
        password: normalizeOptionalText(proxy.password),
        timeout: DEFAULT_PROXY_TEST_TIMEOUT,
      });
      setTestState(mapTestResult(result));
    } catch (err) {
      setTestState({
        status: 'error',
        message: err instanceof Error ? err.message : localeService.t('settings-ui.network.proxy-test-error'),
      });
    }
  }, [canTestProxy, localeService, proxy.type, proxy.host, proxy.port, proxy.username, proxy.password, proxyClientService]);

  useEffect(() => {
    let active = true;

    const loadProxySettings = async () => {
      try {
        const stored = await configManagerService.getField<IProxy>(NETWORK_CONFIG_KEY, 'proxy');
        if (!active) {
          return;
        }
        const normalized = normalizeProxyConfig(stored);
        setProxy(normalized);
        setHostText(normalized.host);
        setPortText(normalized.port ? String(normalized.port) : '');
      } catch {
        if (active) {
          const defaults = createDefaultProxy();
          setProxy(defaults);
          setHostText(defaults.host);
          setPortText(defaults.port ? String(defaults.port) : '');
        }
      }
    };

    loadProxySettings();

    return () => {
      active = false;
    };
  }, [configManagerService]);

  const proxyStatusText = useMemo(() => {
    if (testState.status === 'idle') {
      return '';
    }
    if (testState.status === 'testing') {
      return localeService.t('settings-ui.network.proxy-testing');
    }
    if (testState.status === 'success') {
      const latencyText = typeof testState.latency === 'number' ? ` · ${testState.latency} ms` : '';
      const ipText = testState.ip ? ` ${testState.ip}` : '';
      return `${localeService.t('settings-ui.network.proxy-test-success')}${latencyText}${ipText}`;
    }

    const conciseMessage = toConciseErrorMessage(testState.message);
    const messageText = conciseMessage ? `：${conciseMessage}` : '';
    return `${localeService.t('settings-ui.network.proxy-test-failed')}${messageText}`;
  }, [localeService, testState]);

  return (
    <FieldGroup className="tm:gap-5">
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader
          className={cn('tm:bg-black/10 tm:py-3', {
            'tm:border-b tm:border-line tm:pb-3': proxy.enabled,
          })}
        >
          <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1.5">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <FieldLabel htmlFor="settings-network-proxy-enabled" className="tm:text-sm tm:font-semibold tm:text-white">
                {localeService.t('settings-ui.network.proxy-enable')}
              </FieldLabel>
              <Switch
                id="settings-network-proxy-enabled"
                checked={proxy.enabled}
                onCheckedChange={(checked) => updateProxy({ enabled: checked })}
              />
            </div>

            <CardDescription className="tm:text-xs">
              {localeService.t('settings-ui.network.proxy-description')}
            </CardDescription>
          </div>
        </CardHeader>

        {proxy.enabled && (
          <CardContent>
            <FieldGroup className="tm:my-4 tm:gap-4">
              <Field orientation="horizontal">
                <FieldLabel
                  htmlFor="proxy-type"
                  className={cn('tm:h-8 tm:w-28 tm:flex-none tm:shrink-0 tm:text-xs/8')}
                >
                  {localeService.t('settings-ui.network.proxy-type')}
                </FieldLabel>
                <FieldContent className="tm:items-end">
                  <Select
                    value={proxy.type}
                    onValueChange={(v) => updateProxy({ type: v as 'http' | 'socks5' })}
                  >
                    <SelectTrigger id="proxy-type" className={cn('tm:h-8 tm:w-40 tm:px-2 tm:text-xs')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="socks5">SOCKS5</SelectItem>
                      <SelectItem value="http">HTTP</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <div
                className="
                  tm:grid tm:grid-cols-1 tm:gap-4
                  tm:sm:grid-cols-2
                "
              >
                <Field>
                  <FieldLabel htmlFor="settings-proxy-host" className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                    {localeService.t('settings-ui.network.proxy-host')}
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="settings-proxy-host"
                      className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                      value={hostText}
                      onChange={(e) => {
                        setHostText(e.target.value);
                        updateProxy({ host: e.target.value });
                      }}
                      placeholder="127.0.0.1"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-proxy-port" className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                    {localeService.t('settings-ui.network.proxy-port')}
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="settings-proxy-port"
                      className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                      type="number"
                      value={portText}
                      onChange={(e) => {
                        setPortText(e.target.value);
                        const parsed = Number.parseInt(e.target.value, 10);
                        updateProxy({ port: Number.isNaN(parsed) ? 0 : parsed });
                      }}
                      placeholder="1080"
                    />
                  </FieldContent>
                </Field>
              </div>

              <div
                className="
                  tm:grid tm:grid-cols-1 tm:gap-4
                  tm:sm:grid-cols-2
                "
              >
                <Field>
                  <FieldLabel htmlFor="settings-proxy-username" className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                    {localeService.t('settings-ui.network.proxy-username')}
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="settings-proxy-username"
                      className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                      value={proxy.username}
                      onChange={(e) => updateProxy({ username: e.target.value })}
                      placeholder={localeService.t('settings-ui.network.proxy-username')}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-proxy-password" className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                    {localeService.t('settings-ui.network.proxy-password')}
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="settings-proxy-password"
                      className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                      type="password"
                      value={proxy.password}
                      onChange={(e) => updateProxy({ password: e.target.value })}
                      placeholder={localeService.t('settings-ui.network.proxy-password')}
                    />
                  </FieldContent>
                </Field>
              </div>

              <div
                className="
                  tm:flex tm:flex-col tm:items-start tm:gap-3
                  tm:sm:flex-row tm:sm:items-center
                "
              >
                <Button
                  variant="outline"
                  className="tm:h-8 tm:px-3 tm:text-xs"
                  disabled={!canTestProxy || testState.status === 'testing'}
                  onClick={() => void handleTestProxy()}
                >
                  {testState.status === 'testing'
                    ? localeService.t('settings-ui.network.proxy-testing')
                    : localeService.t('settings-ui.network.proxy-test')}
                </Button>
                {proxyStatusText && testState.status !== 'testing' && (
                  <span
                    className={cn(
                      'tm:text-xs',
                      {
                        'tm:text-green': testState.status === 'success',
                        'tm:text-red': testState.status === 'error',
                        'tm:text-grey-fg': testState.status !== 'success' && testState.status !== 'error',
                      }
                    )}
                  >
                    {proxyStatusText}
                  </span>
                )}
              </div>
            </FieldGroup>
          </CardContent>
        )}
      </Card>
    </FieldGroup>
  );
}
