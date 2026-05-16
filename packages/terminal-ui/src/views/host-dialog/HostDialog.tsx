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

import type { z } from 'zod';
import type { HostFormItem, IHostDialogState } from '../../models/host-dialog.state';
import { LocaleService } from '@termlnk/core';
import { Button, cn, Tabs, TabsContent, TabsList, TabsTrigger, useDependency, useObservable } from '@termlnk/design';
import { ISSHService } from '@termlnk/rpc-client';
import { Loader2Icon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { getFieldError, hostSchema } from '../../models/host-dialog.schema';
import { HostDialogMode } from '../../models/host-dialog.state';
import { HostDialogService } from '../../services/host-dialog/host-dialog.service';
import { AdvancedTab, BasicInfoTab, HostChainTab, ProxyTab } from './components';

export const HOST_DIALOG_COMPONENT_NAME = 'terminal-ui.component.host-dialog';

type TabKey = 'basic' | 'proxy' | 'hostChain' | 'advanced';

function useHostValidation(data: HostFormItem | null) {
  const errors = useMemo<z.ZodError | null>(() => {
    if (!data) return null;
    const result = hostSchema.safeParse(data);
    return result.success ? null : result.error;
  }, [data]);

  const getError = useCallback(
    (path: string) => getFieldError(errors, path),
    [errors]
  );

  return { errors, getError, isValid: !errors };
}

export function HostDialog() {
  const localeService = useDependency(LocaleService);
  const hostDialogService = useDependency(HostDialogService);
  const sshService = useDependency(ISSHService);

  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const testResultTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const state = useObservable<IHostDialogState | null>(hostDialogService.state$, null);
  const formData = state?.item ?? null;
  const mode: HostDialogMode = state?.mode ?? HostDialogMode.CREATE;

  const { errors, getError, isValid } = useHostValidation(formData);

  const translateError = useCallback(
    (path: string) => {
      const error = getError(path);
      if (!error) return undefined;
      if (error.startsWith('validation.')) {
        return localeService.t(`terminal-ui.host-dialog.${error}`);
      }
      return error;
    },
    [getError, localeService]
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'basic', label: 'terminal-ui.host-dialog.tab.basic' },
    { key: 'proxy', label: 'terminal-ui.host-dialog.tab.proxy' },
    { key: 'hostChain', label: 'terminal-ui.host-dialog.tab.hostChain' },
    { key: 'advanced', label: 'terminal-ui.host-dialog.tab.advanced' },
  ];

  const handleChange = useCallback(
    (updates: Partial<HostFormItem>) => {
      if (!formData) return;
      hostDialogService.changeState({
        item: { ...formData, ...updates },
      });
    },
    [formData, hostDialogService]
  );

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await hostDialogService.confirm();
      hostDialogService.terminate();
    } catch (error) {
      console.error('Failed to save host:', error);
    } finally {
      setLoading(false);
    }
  }, [isValid, hostDialogService]);

  const showTestResult = useCallback((result: { ok: boolean; message: string }) => {
    clearTimeout(testResultTimer.current);
    setTestResult(result);
    testResultTimer.current = setTimeout(setTestResult, 5000, null);
  }, []);

  const handleTestConnection = useCallback(async () => {
    if (!formData) return;

    const { addr, port, credential } = formData;
    const failMsg = localeService.t('terminal-ui.host-dialog.test.validationFailed');

    if (!addr || !port || !credential?.username) {
      showTestResult({ ok: false, message: failMsg });
      return;
    }

    let testCredential: { type: 'password'; username: string; password: string } | { type: 'rsa'; username: string; privateKey: string };
    if (credential.type === 'password') {
      if (!credential.password) { showTestResult({ ok: false, message: failMsg }); return; }
      testCredential = { type: 'password', username: credential.username, password: credential.password };
    } else if (credential.type === 'rsa') {
      if (!credential.privateKey) { showTestResult({ ok: false, message: failMsg }); return; }
      testCredential = { type: 'rsa', username: credential.username, privateKey: credential.privateKey };
    } else {
      showTestResult({ ok: false, message: failMsg });
      return;
    }

    setTestResult(null);
    setTestLoading(true);
    try {
      const result = await sshService.testConnection({
        addr,
        port,
        credential: testCredential,
        proxy: formData.proxy?.enabled
          ? {
            enabled: true,
            type: formData.proxy.type ?? 'socks5',
            host: formData.proxy.host ?? '',
            port: formData.proxy.port ?? 0,
            username: formData.proxy.username,
            password: formData.proxy.password,
          }
          : undefined,
        settings: {
          connectTimeout: formData.settings?.connectTimeout,
        },
        hostChainIds: formData.hostChainIds && formData.hostChainIds.length > 0
          ? formData.hostChainIds
          : undefined,
      });

      if (result.ok) {
        showTestResult({ ok: true, message: localeService.t('terminal-ui.host-dialog.test.success', String(result.latency)) });
      } else {
        showTestResult({ ok: false, message: localeService.t('terminal-ui.host-dialog.test.failed', result.message ?? 'Unknown error') });
      }
    } catch (error) {
      showTestResult({ ok: false, message: localeService.t('terminal-ui.host-dialog.test.failed', error instanceof Error ? error.message : 'Unknown error') });
    } finally {
      setTestLoading(false);
    }
  }, [formData, sshService, localeService, showTestResult]);

  const tabErrors = useMemo((): Record<TabKey, boolean> => {
    const tabErrorMap: Record<TabKey, boolean> = {
      basic: false,
      proxy: false,
      hostChain: false,
      advanced: false,
    };

    if (!errors) return tabErrorMap;

    errors.issues.forEach((issue) => {
      const path = issue.path[0];
      if (path === 'label' || path === 'addr' || path === 'port' || path === 'credential') {
        tabErrorMap.basic = true;
      } else if (path === 'proxy') {
        tabErrorMap.proxy = true;
      } else if (path === 'hostChainIds') {
        tabErrorMap.hostChain = true;
      } else if (path === 'settings') {
        tabErrorMap.advanced = true;
      }
    });

    return tabErrorMap;
  }, [errors]);

  if (!formData) return null;

  return (
    <div className="tm:flex tm:min-h-[300px] tm:w-full tm:flex-col tm:overflow-hidden">
      <Tabs
        orientation="vertical"
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
        className="tm:flex-1 tm:gap-0 tm:overflow-hidden"
      >
        {/* Left side tab navigation */}
        <TabsList
          orientation="vertical"
          className={cn(
            'tm:w-[120px] tm:shrink-0 tm:border-r tm:border-line tm:py-3'
          )}
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              orientation="vertical"
              className={cn(
                `
                  tm:relative tm:w-full tm:justify-start tm:border-0 tm:bg-transparent tm:px-3 tm:py-1.5 tm:text-xs
                  tm:font-normal tm:text-white
                  tm:hover:bg-transparent tm:hover:text-blue
                  tm:data-[state=active]:bg-transparent tm:data-[state=active]:text-blue
                  tm:data-[state=active]:shadow-none
                  tm:data-[state=active]:before:absolute tm:data-[state=active]:before:top-1/2
                  tm:data-[state=active]:before:left-0 tm:data-[state=active]:before:h-4
                  tm:data-[state=active]:before:w-0.5 tm:data-[state=active]:before:-translate-y-1/2
                  tm:data-[state=active]:before:rounded-full tm:data-[state=active]:before:bg-blue
                  tm:data-[state=active]:before:content-[""]
                `,
                {
                  'tm:text-red tm:data-[state=active]:text-red': tabErrors[tab.key],
                }
              )}
            >
              {localeService.t(tab.label)}
              {tabErrors[tab.key] && (
                <span className="tm:ml-1 tm:inline-block tm:size-1.5 tm:rounded-full tm:bg-red" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Right side content area */}
        <div className="tm:flex tm:min-w-0 tm:flex-1 tm:flex-col tm:overflow-hidden">
          <div className="tm:flex-1 tm:overflow-y-auto tm:px-4 tm:py-3">
            <TabsContent value="basic" className="tm:m-0">
              <BasicInfoTab data={formData} mode={mode} onChange={handleChange} getError={translateError} />
            </TabsContent>
            <TabsContent value="proxy" className="tm:m-0">
              <ProxyTab data={formData} onChange={handleChange} getError={translateError} />
            </TabsContent>
            <TabsContent value="hostChain" className="tm:m-0">
              <HostChainTab data={formData} onChange={handleChange} getError={translateError} />
            </TabsContent>
            <TabsContent value="advanced" className="tm:m-0">
              <AdvancedTab data={formData} onChange={handleChange} getError={translateError} />
            </TabsContent>
          </div>
        </div>
      </Tabs>

      <div
        className="tm:flex tm:shrink-0 tm:items-center tm:justify-between tm:border-t tm:border-line tm:px-4 tm:py-2"
      >
        <div className="tm:flex tm:items-center tm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="
              tm:border-one-bg3 tm:text-white
              tm:hover:border-blue tm:hover:bg-transparent tm:hover:text-blue
            "
            disabled={testLoading}
            onClick={handleTestConnection}
          >
            {testLoading && <Loader2Icon className="tm:size-3 tm:animate-spin" />}
            {localeService.t('terminal-ui.host-dialog.btn.test')}
          </Button>
          {testResult && (
            <span
              className={cn('tm:text-xs', {
                'tm:text-green': testResult.ok,
                'tm:text-red': !testResult.ok,
              })}
            >
              {testResult.message}
            </span>
          )}
        </div>
        <div className="tm:flex tm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="
              tm:border-one-bg3 tm:text-white
              tm:hover:border-blue tm:hover:bg-transparent tm:hover:text-blue
            "
            onClick={() => hostDialogService.terminate()}
          >
            {localeService.t('terminal-ui.host-dialog.btn.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={loading || !isValid}
          >
            {localeService.t(`terminal-ui.host-dialog.btn.${mode}`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
