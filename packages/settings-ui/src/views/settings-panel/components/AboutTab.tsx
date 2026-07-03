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
import { IUpdaterService, LocaleService } from '@termlnk/core';
import { Badge, Button, cn, LogoIcon, useDependency } from '@termlnk/design';
import { ArrowUpRight, Download, RefreshCw, ScrollText, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type UpdateState = 'idle' | 'checking' | 'available' | 'latest' | 'error';

/** Status dot color classes keyed by UpdateState */
const STATUS_DOT_CLASS: Record<UpdateState, string> = {
  idle: 'tm:bg-grey-fg',
  checking: 'tm:bg-blue tm:animate-pulse',
  available: 'tm:bg-green',
  latest: 'tm:bg-green',
  error: 'tm:bg-red',
};

/** Status text color classes keyed by UpdateState */
const STATUS_TEXT_CLASS: Record<UpdateState, string> = {
  idle: 'tm:text-white',
  checking: 'tm:text-white',
  available: 'tm:text-green',
  latest: 'tm:text-white',
  error: 'tm:text-red',
};

const AUTHOR_NAME = 'telan';
const AUTHOR_URL = 'https://x.com/telanflow';
const LICENSE_NAME = 'PolyForm Noncommercial 1.0.0';
const GITHUB_URL = 'https://github.com/termlnk/termlnk';
const RELEASES_URL = `${GITHUB_URL}/releases`;

export function AboutTab() {
  const localeService = useDependency(LocaleService);
  const updaterService = useDependency(IUpdaterService);

  const [currentVersion, setCurrentVersion] = useState('-');
  const [latestVersion, setLatestVersion] = useState('-');
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;

    const loadVersion = async () => {
      try {
        const version = await updaterService.getCurrentVersion();
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
  }, [updaterService]);

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
      const info = await updaterService.checkForUpdates();
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
  }, [currentVersion, updaterService, updateState]);

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

  const hasUpdate = updateState === 'available';
  const isChecking = updateState === 'checking';

  const lastCheckedText = useMemo(() => {
    if (!lastCheckedAt) {
      return localeService.t('settings-ui.about.last-check-never');
    }
    return lastCheckedAt.toLocaleString();
  }, [lastCheckedAt, localeService]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-4 tm:pb-1">
      <section
        className={`
          tm:relative tm:overflow-hidden tm:rounded-2xl tm:px-5 tm:py-4
          tm:sm:px-6
        `}
      >

        <div className="tm:relative tm:flex tm:flex-col tm:items-center tm:gap-3 tm:text-center">
          <div className="tm:flex tm:items-center tm:justify-center tm:gap-3">
            <LogoIcon className="tm:size-14 tm:rounded-2xl tm:shadow-lg" />
            <div className="tm:text-2xl tm:font-bold tm:tracking-tight tm:text-white">Termlnk</div>
          </div>
          <p className="tm:max-w-xl tm:text-sm tm:text-light-grey">
            {localeService.t('settings-ui.about.description')}
          </p>
          <p className="tm:text-xs tm:text-light-grey">
            {localeService.t('settings-ui.about.copyright')}
            {' '}
            {new Date().getFullYear()}
            {' · '}
            <a
              href={AUTHOR_URL}
              onClick={(event) => {
                event.preventDefault();
                openExternal(AUTHOR_URL);
              }}
              className="
                tm:text-light-grey
                tm:hover:text-blue tm:hover:underline
              "
            >
              {AUTHOR_NAME}
            </a>
          </p>

          <div className="tm:flex tm:flex-wrap tm:items-center tm:justify-center tm:gap-2 tm:select-text">
            <Badge variant="secondary">
              {localeService.t('settings-ui.about.version-app')}
              {' '}
              {currentVersion}
            </Badge>
            <Badge variant="outline">
              License
              {' '}
              {LICENSE_NAME}
            </Badge>
          </div>
        </div>
      </section>

      <section
        className={`
          tm:flex tm:items-start tm:justify-between tm:gap-4 tm:rounded-xl tm:border tm:border-line tm:px-4 tm:py-3
        `}
      >
        <div className="tm:flex tm:min-w-0 tm:items-start tm:gap-3">
          <span
            aria-hidden
            className={cn('tm:mt-1.5 tm:size-2 tm:shrink-0 tm:rounded-full', STATUS_DOT_CLASS[updateState])}
          />
          <div className="tm:min-w-0">
            <p className={cn('tm:text-sm/tight tm:font-medium', STATUS_TEXT_CLASS[updateState])}>
              {statusText}
            </p>
            <p className="tm:mt-1 tm:truncate tm:text-xs tm:text-grey-fg">
              {hasUpdate && latestVersion !== '-'
                ? (
                  <>
                    v
                    {currentVersion}
                    {' → '}
                    <span className="tm:text-green">
                      v
                      {latestVersion}
                    </span>
                    {' · '}
                    {localeService.t('settings-ui.about.last-check')}
                    {' '}
                    {lastCheckedText}
                  </>
                )
                : (
                  <>
                    v
                    {currentVersion}
                    {' · '}
                    {localeService.t('settings-ui.about.last-check')}
                    {' '}
                    {lastCheckedText}
                  </>
                )}
            </p>
          </div>
        </div>

        <Button
          variant={hasUpdate ? 'default' : 'secondary'}
          size="sm"
          className="tm:shrink-0"
          onClick={hasUpdate ? () => openExternal(RELEASES_URL) : () => void handleCheckForUpdates()}
          disabled={isChecking}
        >
          {hasUpdate
            ? <Download className="tm:size-3.5" />
            : <RefreshCw className={cn('tm:size-3.5', { 'tm:animate-spin': isChecking })} />}
          {hasUpdate
            ? localeService.t('settings-ui.about.download-now')
            : localeService.t('settings-ui.about.action-check-update')}
        </Button>
      </section>

      <section className="tm:rounded-2xl tm:border tm:border-line tm:p-2">
        <ActionButton
          icon={<ScrollText className="tm:size-4" />}
          iconClassName="tm:bg-orange/10 tm:text-orange"
          title={localeService.t('settings-ui.about.action-release-notes')}
          description={localeService.t('settings-ui.about.action-release-notes-desc')}
          onClick={() => openExternal(RELEASES_URL)}
        />
        <ActionButton
          icon={<Star className="tm:size-4" />}
          iconClassName="tm:bg-blue/10 tm:text-blue"
          title={localeService.t('settings-ui.about.action-github')}
          description={localeService.t('settings-ui.about.action-github-desc')}
          onClick={() => openExternal(GITHUB_URL)}
        />
      </section>
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
        tm:hover:bg-one-bg
        tm:disabled:cursor-not-allowed tm:disabled:opacity-70
      `}
    >
      <span className="tm:flex tm:items-center tm:gap-3">
        <span className={cn('tm:grid tm:size-8 tm:place-items-center tm:rounded-lg', iconClassName)}>
          {icon}
        </span>
        <span>
          <span className="tm:block tm:text-sm tm:text-white">{title}</span>
          <span className="tm:block tm:text-xs tm:text-light-grey">{description}</span>
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
