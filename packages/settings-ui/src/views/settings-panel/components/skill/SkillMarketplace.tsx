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

import type { ISkill, ISkillRepository, ISkillRepositoryMarketplaceItem } from '@termlnk/agent';
import { ISkillService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Badge, Button, cn, useDependency } from '@termlnk/design';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ISkillMarketplaceProps {
  installedSkills: ISkill[];
  repositories: ISkillRepository[];
  searchQuery: string;
  repositoryFilterId: string;
  onCountChange?: (count: number) => void;
  onInstalled: () => void | Promise<void>;
}

export function SkillMarketplace(props: ISkillMarketplaceProps) {
  const { installedSkills, repositories, searchQuery, repositoryFilterId, onCountChange, onInstalled } = props;
  const localeService = useDependency(LocaleService);
  const skillService = useDependency(ISkillService);
  const [marketplaceItems, setMarketplaceItems] = useState<ISkillRepositoryMarketplaceItem[]>([]);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    skillService.getRepositoryMarketplaceItems(
      repositoryFilterId === 'all' ? undefined : repositoryFilterId
    ).then(setMarketplaceItems).catch(() => {
      setMarketplaceItems([]);
    });
  }, [repositories, repositoryFilterId, skillService]);

  const installedNames = useMemo(
    () => new Set(installedSkills.map((skill) => skill.name.toLowerCase())),
    [installedSkills]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMarketplaceItems = useMemo(() => {
    if (!normalizedQuery) {
      return marketplaceItems;
    }

    return marketplaceItems.filter((item) => {
      const haystack = [
        item.name,
        item.description,
        item.author ?? '',
        item.repositoryName,
        item.repositoryUrl,
        ...item.tags,
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [marketplaceItems, normalizedQuery]);

  useEffect(() => {
    onCountChange?.(marketplaceItems.length);
  }, [marketplaceItems.length, onCountChange]);

  const handleInstallRepositorySkill = useCallback(async (item: ISkillRepositoryMarketplaceItem) => {
    setInstallingIds((prev) => new Set(prev).add(item.id));

    try {
      await skillService.installRepositorySkill(item.id);
      await onInstalled();
    } finally {
      setInstallingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [onInstalled, skillService]);

  if (filteredMarketplaceItems.length === 0) {
    return (
      <section
        className={cn('tm:p-5 tm:transition-all')}
      >
        <div className="tm:flex tm:flex-col tm:items-center tm:gap-3 tm:py-4 tm:text-center">
          <div className="tm:flex tm:flex-col tm:gap-1">
            <p className="tm:text-sm tm:font-medium tm:text-white">
              {localeService.t('settings-ui.skill.marketplace-empty')}
            </p>
            <p className="tm:text-xs tm:text-grey-fg">
              {localeService.t('settings-ui.skill.marketplace-empty-hint')}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="tm:flex tm:flex-col tm:gap-2">
      {filteredMarketplaceItems.map((item) => {
        const isInstalled = installedNames.has(item.name.toLowerCase());
        const isInstalling = installingIds.has(item.id);

        return (
          <section
            key={item.id}
            className={cn(`
              tm:rounded-2xl tm:border tm:border-line tm:p-5 tm:transition-all
              tm:hover:border-blue tm:hover:bg-one-bg
            `)}
          >
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <div className="tm:min-w-0 tm:flex-1">
                <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-1.5">
                  <span className="tm:text-sm tm:font-semibold tm:text-white">
                    {item.name}
                  </span>
                  <Badge variant="secondary" className="tm:border-transparent tm:bg-purple/10 tm:text-purple">
                    {item.repositoryName}
                  </Badge>
                  {item.version && (
                    <span className="tm:text-[10px] tm:text-grey-fg">
                      v
                      {item.version}
                    </span>
                  )}
                </div>

                <p className="tm:mt-1 tm:text-[11px]/relaxed tm:text-light-grey">
                  {item.description}
                </p>

                <div className="tm:mt-3 tm:flex tm:flex-wrap tm:items-center tm:gap-2">
                  {item.author && (
                    <span className="tm:text-[10px] tm:text-white">
                      {item.author}
                    </span>
                  )}
                  {item.author && <span className="tm:text-[10px] tm:text-grey">·</span>}
                  <span className="tm:text-[10px] tm:text-white">
                    {item.repositoryUrl}
                  </span>
                  {(item.repositoryBranch || item.repositorySubdirectory) && (
                    <span className="tm:text-[10px] tm:text-white">·</span>
                  )}
                  {item.repositoryBranch && (
                    <span className="tm:text-[10px] tm:text-white">
                      {localeService.t('settings-ui.skill.repository-branch')}
                      :
                      {' '}
                      {item.repositoryBranch}
                    </span>
                  )}
                  {item.repositorySubdirectory && (
                    <span className="tm:text-[10px] tm:text-white">
                      {localeService.t('settings-ui.skill.repository-subdirectory')}
                      :
                      {' '}
                      {item.repositorySubdirectory}
                    </span>
                  )}
                  {item.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="tm:rounded-full tm:bg-one-bg2 tm:px-2 tm:py-0.5 tm:text-[9px] tm:text-white"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant={isInstalled ? 'secondary' : 'primary'}
                size="sm"
                className={cn('tm:shrink-0', { 'tm:cursor-wait': isInstalling })}
                onClick={() => !isInstalled && !isInstalling && void handleInstallRepositorySkill(item)}
                disabled={isInstalled || isInstalling}
              >
                {isInstalled
                  ? localeService.t('settings-ui.skill.marketplace-installed')
                  : isInstalling
                    ? localeService.t('settings-ui.skill.marketplace-installing')
                    : localeService.t('settings-ui.skill.marketplace-install')}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
