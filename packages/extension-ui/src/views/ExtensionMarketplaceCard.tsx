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

import type { IRegistryExtensionMetadata } from '@termlnk/extension';
import { LocaleService } from '@termlnk/core';
import { Badge, Button, cn, Spinner, useDependency } from '@termlnk/design';
import { BadgeCheck, Download, TriangleAlert } from 'lucide-react';

interface IExtensionMarketplaceCardProps {
  item: IRegistryExtensionMetadata;
  installed: boolean;
  installing: boolean;
  error?: string;
  onInstall: (item: IRegistryExtensionMetadata) => void;
}

function formatInstalls(count: number, t: (k: string, ...args: string[]) => string): string | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  if (count >= 1000) {
    return t('extension-ui.marketplace.installs', `${(count / 1000).toFixed(1)}k`);
  }
  return t('extension-ui.marketplace.installs', String(count));
}

export function ExtensionMarketplaceCard({ item, installed, installing, error, onInstall }: IExtensionMarketplaceCardProps) {
  const localeService = useDependency(LocaleService);
  const installsLabel = formatInstalls(item.stats?.installs ?? 0, localeService.t.bind(localeService));

  return (
    <section
      className={cn(`
        tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg/65 tm:p-3 tm:transition-all
        tm:hover:border-blue/30 tm:hover:bg-one-bg/80
      `)}
    >
      <div className="tm:flex tm:items-start tm:justify-between tm:gap-3">
        <div className="tm:min-w-0 tm:flex-1">
          <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-1.5">
            <span className="tm:truncate tm:text-sm tm:font-semibold tm:text-white">
              {item.displayName}
            </span>
            <span className="tm:shrink-0 tm:text-[10px] tm:text-grey">
              v
              {item.latestVersion}
            </span>
            <Badge
              variant="secondary"
              className="tm:gap-1 tm:border-blue/25 tm:bg-blue/10 tm:text-[10px] tm:text-blue"
            >
              <BadgeCheck className="tm:size-2" />
              {item.publisher.name}
            </Badge>
          </div>

          {item.description && (
            <p className="tm:mt-0.5 tm:line-clamp-2 tm:text-[11px]/relaxed tm:text-light-grey">
              {item.description}
            </p>
          )}

          <div className="tm:mt-2 tm:flex tm:flex-wrap tm:items-center tm:gap-2 tm:text-white">
            {item.categories?.slice(0, 2).map((cat) => (
              <Badge
                key={cat}
                variant="secondary"
                className="tm:bg-blue/8 tm:px-1.5 tm:py-0.5 tm:text-[9px] tm:text-blue"
              >
                {cat}
              </Badge>
            ))}
            {item.keywords?.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="tm:bg-one-bg2 tm:px-1.5 tm:py-0.5 tm:text-[9px]"
              >
                {tag}
              </Badge>
            ))}
            {installsLabel && (
              <span className="tm:text-[10px] tm:text-grey-fg">{installsLabel}</span>
            )}
          </div>

          {error && (
            <div className="tm:mt-2 tm:flex tm:items-center tm:gap-1 tm:text-[10px] tm:text-red">
              <TriangleAlert className="tm:size-3" />
              <span className="tm:truncate">{error}</span>
            </div>
          )}
        </div>

        <Button
          variant={installed ? 'secondary' : 'primary'}
          size="sm"
          className="tm:shrink-0 tm:gap-1"
          disabled={installed || installing}
          onClick={() => !installed && !installing && onInstall(item)}
        >
          {installing
            ? (
              <>
                <Spinner className="tm:size-3" />
                {localeService.t('extension-ui.marketplace.installing')}
              </>
            )
            : installed
              ? localeService.t('extension-ui.marketplace.installed')
              : (
                <>
                  <Download className="tm:size-3" />
                  {localeService.t('extension-ui.marketplace.install')}
                </>
              )}
        </Button>
      </div>
    </section>
  );
}
