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

import type { IMcpSettingsConfig } from '@termlnk/agent';
import { AGENT_PLUGIN_CONFIG_KEY } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn, Field, FieldContent, FieldGroup, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, useDependency } from '@termlnk/design';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useState } from 'react';
import { McpClientTab } from './McpClientTab';

function createDefaultMCPConfig(): IMcpSettingsConfig {
  return {
    enabled: false,
    transport: 'http',
    port: 23580,
    host: '0.0.0.0',
  };
}

function normalizeMCPConfig(value: Partial<IMcpSettingsConfig> | null): IMcpSettingsConfig {
  const defaults = createDefaultMCPConfig();
  if (!value) {
    return defaults;
  }

  const port = Number.parseInt(String(value.port), 10);

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
    transport: value.transport === 'stdio' ? 'stdio' : defaults.transport,
    port: Number.isNaN(port) ? 0 : Math.max(0, Math.min(65535, port)),
    host: typeof value.host === 'string' ? value.host : defaults.host,
  };
}

export function MCPTab() {
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);

  const [config, setConfig] = useState<IMcpSettingsConfig>(createDefaultMCPConfig);
  const [hostText, setHostText] = useState(() => createDefaultMCPConfig().host);
  const [portText, setPortText] = useState(() => String(createDefaultMCPConfig().port));

  const persistConfig = useCallback((next: IMcpSettingsConfig) => {
    void (async () => {
      try {
        await configManagerService.setField(AGENT_PLUGIN_CONFIG_KEY, 'mcp', next);
      } catch { }
    })();
  }, [configManagerService]);

  const updateConfig = useCallback((updates: Partial<IMcpSettingsConfig>) => {
    setConfig((prev) => {
      const next = normalizeMCPConfig({ ...prev, ...updates });
      persistConfig(next);
      return next;
    });
  }, [persistConfig]);

  useEffect(() => {
    let active = true;

    const loadConfig = async () => {
      try {
        const stored = await configManagerService.getField<IMcpSettingsConfig>(AGENT_PLUGIN_CONFIG_KEY, 'mcp');
        if (!active) {
          return;
        }
        const normalized = normalizeMCPConfig(stored ?? null);
        setConfig(normalized);
        setHostText(normalized.host);
        setPortText(String(normalized.port));
      } catch {
        if (active) {
          const defaults = createDefaultMCPConfig();
          setConfig(defaults);
          setHostText(defaults.host);
          setPortText(String(defaults.port));
        }
      }
    };

    loadConfig();

    return () => {
      active = false;
    };
  }, [configManagerService]);

  return (
    <FieldGroup className="tm:gap-6">
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader
          className={cn('tm:bg-black/10 tm:py-3', {
            'tm:border-b tm:border-line tm:pb-3': config.enabled,
          })}
        >
          <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1.5">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <CardTitle className="tm:text-sm tm:font-semibold tm:text-white">
                {localeService.t('settings-ui.mcp.server-title')}
              </CardTitle>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => updateConfig({ enabled: checked })}
              />
            </div>

            <CardDescription className="tm:text-xs">
              {localeService.t('settings-ui.mcp.server-description')}
            </CardDescription>
          </div>
        </CardHeader>

        {config.enabled && (
          <CardContent>
            <FieldGroup className="tm:gap-4 tm:py-5">
              <Field orientation="horizontal" className="tm:group/mcp-transport">
                <FieldLabel
                  htmlFor="settings-mcp-transport"
                  className={cn('tm:h-8 tm:w-28 tm:flex-none tm:shrink-0 tm:cursor-pointer tm:text-xs/8')}
                >
                  {localeService.t('settings-ui.mcp.transport')}
                </FieldLabel>
                <FieldContent className="tm:items-end">
                  <Select
                    value={config.transport}
                    onValueChange={(v) => updateConfig({ transport: v as 'stdio' | 'http' })}
                  >
                    <SelectTrigger
                      id="settings-mcp-transport"
                      className={cn(`
                        tm:h-8 tm:w-40 tm:px-2 tm:text-xs
                        tm:group-hover/mcp-transport:border-blue
                      `)}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="stdio">Stdio</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              {config.transport === 'http' && (
                <div
                  className="
                    tm:grid tm:grid-cols-1 tm:gap-4
                    tm:sm:grid-cols-2
                  "
                >
                  <Field>
                    <FieldLabel htmlFor="settings-mcp-host" className={cn('tm:text-xs tm:font-medium')}>
                      {localeService.t('settings-ui.mcp.host')}
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="settings-mcp-host"
                        className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                        value={hostText}
                        onChange={(e) => {
                          setHostText(e.target.value);
                          updateConfig({ host: e.target.value });
                        }}
                        placeholder="0.0.0.0"
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="settings-mcp-port" className={cn('tm:text-xs tm:font-medium')}>
                      {localeService.t('settings-ui.mcp.port')}
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="settings-mcp-port"
                        className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                        inputMode="numeric"
                        value={portText}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, '');
                          setPortText(raw);
                          updateConfig({ port: raw ? Number.parseInt(raw, 10) : 0 });
                        }}
                        onBlur={() => {
                          const normalized = normalizeMCPConfig({ ...config, port: portText ? Number.parseInt(portText, 10) : 0 });
                          setPortText(String(normalized.port));
                          updateConfig({ port: normalized.port });
                        }}
                        placeholder="23580"
                      />
                    </FieldContent>
                  </Field>
                </div>
              )}
            </FieldGroup>
          </CardContent>
        )}
      </Card>

      <McpClientTab />
    </FieldGroup>
  );
}
