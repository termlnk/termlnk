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

import type { ReactNode } from 'react';
import { LocaleService } from '@termlnk/core';
import { Badge, Button, cn, useDependency } from '@termlnk/design';
import { IRPCClientService } from '@termlnk/rpc-client';
import { ArrowUpRight, Copy, Download, RefreshCw, ScrollText, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type UpdateState = 'idle' | 'checking' | 'available' | 'latest' | 'error';
type CopyState = 'idle' | 'success' | 'error';

interface IUpdateInfo {
  version?: string;
}

interface IUpdaterClient {
  getCurrentVersion?: {
    query: () => Promise<string>;
  };
  checkForUpdates?: {
    mutate: () => Promise<IUpdateInfo | null>;
  };
}

interface IRuntimeInfo {
  electron: string;
  node: string;
  chrome: string;
  platform: string;
}

const GITHUB_URL = 'https://github.com/termlnk/termlnk';
const RELEASES_URL = `${GITHUB_URL}/releases`;
const APP_LOGO_URL = new URL('../../../../../../apps/desktop/resources/logo.svg', import.meta.url).href;

export function AboutTab() {
  const localeService = useDependency(LocaleService);
  const rpcClientService = useDependency(IRPCClientService);

  const [currentVersion, setCurrentVersion] = useState('-');
  const [latestVersion, setLatestVersion] = useState('-');
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const runtimeInfo = useMemo<IRuntimeInfo>(() => {
    const win = window as Window & {
      electron?: {
        process?: {
          versions?: Record<string, string>;
        };
      };
      electronVersion?: string;
      nodeVersion?: string;
      chromeVersion?: string;
    };

    const versions = win.electron?.process?.versions ?? {};

    const navigatorWithUAData = navigator as Navigator & {
      userAgentData?: {
        platform?: string;
      };
    };

    return {
      electron: versions.electron ?? win.electronVersion ?? '-',
      node: versions.node ?? win.nodeVersion ?? '-',
      chrome: versions.chrome ?? win.chromeVersion ?? '-',
      platform: navigatorWithUAData.userAgentData?.platform ?? navigator.platform ?? '-',
    };
  }, []);

  const getUpdaterClient = useCallback((): IUpdaterClient | null => {
    const client = rpcClientService.getClient() as { updater?: IUpdaterClient };
    return client.updater ?? null;
  }, [rpcClientService]);

  useEffect(() => {
    let active = true;

    const loadVersion = async () => {
      try {
        const updater = getUpdaterClient();
        if (!updater?.getCurrentVersion?.query) {
          return;
        }
        const version = await updater.getCurrentVersion.query();
        if (active && version) {
          setCurrentVersion(version);
        }
      } catch {
        if (active) {
          setCurrentVersion('-');
        }
      }
    };

    void loadVersion();

    return () => {
      active = false;
    };
  }, [getUpdaterClient]);

  const openExternal = useCallback((url: string) => {
    const win = window as Window & {
      nativeShell?: {
        openExternal?: (target: string) => Promise<void> | void;
      };
    };

    if (win.nativeShell?.openExternal) {
      void win.nativeShell.openExternal(url);
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    if (updateState === 'checking') {
      return;
    }

    setUpdateState('checking');

    try {
      const updater = getUpdaterClient();
      if (!updater?.checkForUpdates?.mutate) {
        throw new Error('updater unavailable');
      }

      const info = await updater.checkForUpdates.mutate();
      setLastCheckedAt(new Date());

      if (info?.version) {
        setLatestVersion(info.version);
        setUpdateState('available');
        return;
      }

      setLatestVersion(currentVersion);
      setUpdateState('latest');
    } catch {
      setLastCheckedAt(new Date());
      setUpdateState('error');
    }
  }, [currentVersion, getUpdaterClient, updateState]);

  const statusText = useMemo(() => {
    switch (updateState) {
      case 'checking':
        return localeService.t('settings-ui.about.status-checking');
      case 'available':
        return localeService.t('settings-ui.about.status-available');
      case 'latest':
        return localeService.t('settings-ui.about.status-latest');
      case 'error':
        return localeService.t('settings-ui.about.status-error');
      case 'idle':
      default:
        return localeService.t('settings-ui.about.status-idle');
    }
  }, [localeService, updateState]);

  const statusClassName = useMemo(() => {
    switch (updateState) {
      case 'available':
        return 'tm:text-green';
      case 'error':
        return 'tm:text-red';
      default:
        return 'tm:text-light-grey';
    }
  }, [updateState]);

  const lastCheckedText = useMemo(() => {
    if (!lastCheckedAt) {
      return localeService.t('settings-ui.about.last-check-never');
    }
    return lastCheckedAt.toLocaleString();
  }, [lastCheckedAt, localeService]);

  const environmentText = useMemo(() => {
    return [
      `App: ${currentVersion}`,
      `Electron: ${runtimeInfo.electron}`,
      `Node.js: ${runtimeInfo.node}`,
      `Chrome: ${runtimeInfo.chrome}`,
      `Platform: ${runtimeInfo.platform}`,
      `Update Status: ${statusText}`,
      `Latest Version: ${latestVersion}`,
      `Last Check: ${lastCheckedText}`,
    ].join('\n');
  }, [currentVersion, latestVersion, runtimeInfo, statusText, lastCheckedText]);

  const handleCopyEnvironment = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard unavailable');
      }
      await navigator.clipboard.writeText(environmentText);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }, [environmentText]);

  useEffect(() => {
    if (copyState === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopyState('idle');
    }, 1600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copyState]);

  const copyLabel = useMemo(() => {
    switch (copyState) {
      case 'success':
        return localeService.t('settings-ui.about.copy-success');
      case 'error':
        return localeService.t('settings-ui.about.copy-failed');
      default:
        return localeService.t('settings-ui.about.copy-environment');
    }
  }, [copyState, localeService]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-4 tm:pb-1">
      <section
        className={`
          tm:relative tm:overflow-hidden tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg/80 tm:px-5 tm:py-6
          tm:sm:px-6
        `}
      >
        <div
          className={`
            tm:pointer-events-none tm:absolute tm:-top-24 tm:left-1/2 tm:size-56 tm:-translate-x-1/2 tm:rounded-full
            tm:bg-orange/15 tm:blur-3xl
          `}
        />

        <div className="tm:relative tm:flex tm:flex-col tm:items-center tm:gap-3 tm:text-center">
          <div className="tm:flex tm:items-center tm:justify-center tm:gap-3">
            <img
              src={APP_LOGO_URL}
              alt="Termlnk logo"
              className="tm:size-14 tm:rounded-2xl tm:shadow-lg"
            />
            <div className="tm:text-2xl tm:font-bold tm:tracking-tight tm:text-white">Termlnk</div>
          </div>
          <p className="tm:max-w-xl tm:text-sm tm:text-grey-fg">
            {localeService.t('settings-ui.about.description')}
          </p>
          <p className="tm:text-xs tm:text-grey-fg">
            {localeService.t('settings-ui.about.copyright')}
            {' '}
            {new Date().getFullYear()}
            .
          </p>

          <div className="tm:flex tm:flex-wrap tm:items-center tm:justify-center tm:gap-2">
            <Badge variant="secondary">
              {localeService.t('settings-ui.about.version-app')}
              {' '}
              {currentVersion}
            </Badge>
            <Badge variant="secondary">
              {localeService.t('settings-ui.about.version-electron')}
              {' '}
              {runtimeInfo.electron}
            </Badge>
            <Badge variant="outline">
              {localeService.t('settings-ui.about.version-node')}
              {' '}
              {runtimeInfo.node}
            </Badge>
            <Button variant="ghost" size="xs" onClick={handleCopyEnvironment}>
              <Copy className="tm:size-3.5" />
              {copyLabel}
            </Button>
          </div>
        </div>
      </section>

      <section
        className="
          tm:grid tm:grid-cols-1 tm:gap-3
          tm:sm:grid-cols-2
        "
      >
        <article className="tm:rounded-xl tm:border tm:border-line tm:bg-one-bg/60 tm:p-4">
          <p className="tm:text-xs tm:text-grey-fg">{localeService.t('settings-ui.about.current-version')}</p>
          <p className="tm:mt-1 tm:text-3xl tm:leading-none tm:font-semibold tm:text-white">{currentVersion}</p>
        </article>

        <article className="tm:rounded-xl tm:border tm:border-line tm:bg-one-bg/60 tm:p-4">
          <p className="tm:text-xs tm:text-grey-fg">{localeService.t('settings-ui.about.latest-version')}</p>
          <p className="tm:mt-1 tm:text-3xl tm:leading-none tm:font-semibold tm:text-light-grey">{latestVersion}</p>
        </article>

        <article className="tm:rounded-xl tm:border tm:border-line tm:bg-one-bg/60 tm:p-4">
          <p className="tm:text-xs tm:text-grey-fg">{localeService.t('settings-ui.about.update-status')}</p>
          <p
            className={`
              tm:mt-1 tm:text-xl/tight tm:font-semibold
              ${statusClassName}
            `}
          >
            {statusText}
          </p>
        </article>

        <article className="tm:rounded-xl tm:border tm:border-line tm:bg-one-bg/60 tm:p-4">
          <p className="tm:text-xs tm:text-grey-fg">{localeService.t('settings-ui.about.last-check')}</p>
          <p className="tm:mt-1 tm:text-xl/tight tm:font-semibold tm:text-light-grey">{lastCheckedText}</p>
        </article>
      </section>

      <section className="tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg/40 tm:p-2">
        <ActionButton
          icon={<RefreshCw className={cn('tm:size-4', { 'tm:animate-spin': updateState === 'checking' })} />}
          iconClassName="tm:bg-blue/15 tm:text-blue"
          title={localeService.t('settings-ui.about.action-check-update')}
          description={localeService.t('settings-ui.about.action-check-update-desc')}
          onClick={() => void handleCheckForUpdates()}
          disabled={updateState === 'checking'}
        />
        <ActionButton
          icon={<ScrollText className="tm:size-4" />}
          iconClassName="tm:bg-orange/15 tm:text-orange"
          title={localeService.t('settings-ui.about.action-release-notes')}
          description={localeService.t('settings-ui.about.action-release-notes-desc')}
          onClick={() => openExternal(RELEASES_URL)}
        />
        <ActionButton
          icon={<Star className="tm:size-4" />}
          iconClassName="tm:bg-one-bg2 tm:text-light-grey"
          title={localeService.t('settings-ui.about.action-github')}
          description={localeService.t('settings-ui.about.action-github-desc')}
          onClick={() => openExternal(GITHUB_URL)}
        />
      </section>

      <div className="tm:flex tm:justify-end tm:gap-2">
        <Button variant="secondary" size="sm" onClick={() => void handleCheckForUpdates()} disabled={updateState === 'checking'}>
          <RefreshCw className={cn('tm:size-3.5', { 'tm:animate-spin': updateState === 'checking' })} />
          {localeService.t('settings-ui.about.action-check-update')}
        </Button>
        <Button variant="default" size="sm" onClick={() => openExternal(RELEASES_URL)}>
          <Download className="tm:size-3.5" />
          {localeService.t('settings-ui.about.download-now')}
        </Button>
      </div>
    </div>
  );
}

interface IActionButtonProps {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, iconClassName, title, description, onClick, disabled }: IActionButtonProps): ReactNode {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={`
        tm:h-auto tm:w-full tm:justify-between tm:rounded-xl tm:px-3 tm:py-2.5 tm:text-left tm:transition-colors
        tm:hover:bg-one-bg2/60
        tm:disabled:cursor-not-allowed tm:disabled:opacity-70
      `}
    >
      <span className="tm:flex tm:items-center tm:gap-3">
        <span className={cn('tm:grid tm:size-8 tm:place-items-center tm:rounded-lg', iconClassName)}>
          {icon}
        </span>
        <span>
          <span className="tm:block tm:text-sm tm:font-medium tm:text-white">{title}</span>
          <span className="tm:block tm:text-xs tm:text-grey-fg">{description}</span>
        </span>
      </span>
      <ArrowUpRight
        className="
          tm:size-4 tm:text-grey-fg tm:transition-colors
          tm:group-hover/button:text-light-grey
        "
      />
    </Button>
  );
}
