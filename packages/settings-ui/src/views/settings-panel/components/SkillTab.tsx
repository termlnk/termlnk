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

import type { ISkill, ISkillRepository } from '@termlnk/agent';
import { ISkillService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn, FieldGroup, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, useDependency } from '@termlnk/design';
import { GitBranch, Plus, RefreshCw, Search, Store, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AddSkillRepositoryDialog } from './skill/AddSkillRepositoryDialog';
import { EditSkillRepositoryDialog } from './skill/EditSkillRepositoryDialog';
import { SkillInstalled } from './skill/SkillInstalled';
import { SkillMarketplace } from './skill/SkillMarketplace';
import { SkillRepositories } from './skill/SkillRepositories';

type SkillSubView = 'marketplace' | 'installed' | 'repositories';

export function SkillTab() {
  const localeService = useDependency(LocaleService);
  const skillService = useDependency(ISkillService);

  const [subView, setSubView] = useState<SkillSubView>('marketplace');
  const [skills, setSkills] = useState<ISkill[]>([]);
  const [repositories, setRepositories] = useState<ISkillRepository[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRepositoryId, setActiveRepositoryId] = useState('all');
  const [marketplaceRepositoryId, setMarketplaceRepositoryId] = useState('all');
  const [marketplaceCount, setMarketplaceCount] = useState(0);
  const [repositorySkillCounts, setRepositorySkillCounts] = useState<Record<string, number>>({});
  const [addRepositoryOpen, setAddRepositoryOpen] = useState(false);
  const [editingRepository, setEditingRepository] = useState<ISkillRepository | null>(null);

  const loadSkills = useCallback(async () => {
    try {
      const all = await skillService.getAll();
      setSkills(all);
    } catch {
      setSkills([]);
    }
  }, [skillService]);

  const loadRepositories = useCallback(async () => {
    try {
      const all = await skillService.getRepositories();
      setRepositories(all);
    } catch {
      setRepositories([]);
    }
  }, [skillService]);

  useEffect(() => {
    loadSkills();
    loadRepositories();
  }, [loadRepositories, loadSkills]);

  useEffect(() => {
    let cancelled = false;

    skillService.getRepositoryMarketplaceItems().then((items) => {
      if (cancelled) {
        return;
      }

      const counts = items.reduce<Record<string, number>>((result, item) => {
        result[item.repositoryId] = (result[item.repositoryId] ?? 0) + 1;
        return result;
      }, {});

      setRepositorySkillCounts(counts);
    }).catch(() => {
      if (!cancelled) {
        setRepositorySkillCounts({});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repositories, skillService]);

  useEffect(() => {
    if (activeRepositoryId === 'all' || activeRepositoryId === 'local') {
      return;
    }

    if (!repositories.some((repository) => repository.id === activeRepositoryId)) {
      setActiveRepositoryId('all');
    }
  }, [activeRepositoryId, repositories]);

  useEffect(() => {
    if (marketplaceRepositoryId === 'all') {
      return;
    }

    if (!repositories.some((repository) => repository.id === marketplaceRepositoryId)) {
      setMarketplaceRepositoryId('all');
    }
  }, [marketplaceRepositoryId, repositories]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await skillService.refresh();
      await Promise.all([loadSkills(), loadRepositories()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadRepositories, loadSkills, skillService]);

  const handleRepositoriesChanged = useCallback(async () => {
    await Promise.all([loadSkills(), loadRepositories()]);
  }, [loadRepositories, loadSkills]);

  const handleRepositoryAdded = useCallback(async (repository: ISkillRepository) => {
    setSubView('marketplace');
    setMarketplaceRepositoryId(repository.id);
    await handleRepositoriesChanged();
  }, [handleRepositoriesChanged]);

  const handleRepositoryUpdated = useCallback(async (repository: ISkillRepository, previousRepositoryId: string) => {
    if (activeRepositoryId === previousRepositoryId) {
      setActiveRepositoryId(repository.id);
    }

    if (marketplaceRepositoryId === previousRepositoryId) {
      setMarketplaceRepositoryId(repository.id);
    }

    await handleRepositoriesChanged();
  }, [activeRepositoryId, handleRepositoriesChanged, marketplaceRepositoryId]);

  const marketplaceRepositoryFilterOptions = useMemo(
    () => [
      { value: 'all', label: localeService.t('settings-ui.skill.repository-filter-all') },
      ...repositories.map((repository) => ({
        value: repository.id,
        label: repository.displayName,
      })),
    ],
    [localeService, repositories]
  );

  return (
    <FieldGroup className="tm:gap-4">
      <Card className="tm:gap-0 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:py-3">
          <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1">
            <CardTitle className="tm:text-sm tm:font-semibold tm:text-white">
              {localeService.t('settings-ui.skill.section-title')}
            </CardTitle>
            <CardDescription className="tm:text-[11px]/5 tm:text-light-grey">
              {localeService.t('settings-ui.skill.section-description')}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="tm:flex tm:h-full tm:min-h-0 tm:flex-col tm:p-3">
          <Tabs
            value={subView}
            onValueChange={(value) => value && setSubView(value as SkillSubView)}
            className="tm:flex tm:h-full tm:min-h-0 tm:flex-col tm:gap-4"
          >
            <div className="tm:rounded-2xl tm:border tm:border-line tm:bg-black/10 tm:p-2.5 tm:text-white">
              <div className="tm:flex tm:flex-wrap tm:items-center tm:justify-between tm:gap-3">
                <TabsList className="tm:h-auto tm:rounded-xl tm:border tm:border-line tm:bg-one-bg/50 tm:p-1">
                  <TabsTrigger
                    value="marketplace"
                    className={cn(
                      `
                        tm:min-w-30 tm:items-center tm:justify-center tm:gap-2 tm:rounded-lg tm:px-3 tm:text-xs
                        tm:data-[state=active]:bg-blue/15 tm:data-[state=active]:text-blue
                        tm:data-[state=active]:shadow-none
                      `
                    )}
                  >
                    <Store className="tm:size-3" />
                    {localeService.t('settings-ui.skill.sub-view-marketplace')}
                    <span
                      className="
                        tm:inline-flex tm:min-w-5 tm:items-center tm:justify-center tm:rounded-full tm:bg-blue/15
                        tm:px-1.5 tm:py-0.5 tm:text-[10px] tm:font-medium tm:text-blue
                      "
                    >
                      {marketplaceCount}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="installed"
                    className={cn(
                      `
                        tm:min-w-30 tm:items-center tm:justify-center tm:gap-2 tm:rounded-lg tm:px-3 tm:text-xs
                        tm:data-[state=active]:bg-blue/15 tm:data-[state=active]:text-blue
                        tm:data-[state=active]:shadow-none
                      `
                    )}
                  >
                    <Wand2 className="tm:size-3" />
                    {localeService.t('settings-ui.skill.sub-view-installed')}
                    <span
                      className="
                        tm:inline-flex tm:min-w-5 tm:items-center tm:justify-center tm:rounded-full tm:bg-blue/15
                        tm:px-1.5 tm:py-0.5 tm:text-[10px] tm:font-medium tm:text-blue
                      "
                    >
                      {skills.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="repositories"
                    className={cn(
                      `
                        tm:min-w-33 tm:items-center tm:justify-center tm:gap-2 tm:rounded-lg tm:px-3 tm:text-xs
                        tm:data-[state=active]:bg-blue/15 tm:data-[state=active]:text-blue
                        tm:data-[state=active]:shadow-none
                      `
                    )}
                  >
                    <GitBranch className="tm:size-3" />
                    {localeService.t('settings-ui.skill.sub-view-repositories')}
                    <span
                      className="
                        tm:inline-flex tm:min-w-5 tm:items-center tm:justify-center tm:rounded-full tm:bg-purple/15
                        tm:px-1.5 tm:py-0.5 tm:text-[10px] tm:font-medium tm:text-purple
                      "
                    >
                      {repositories.length}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <div className="tm:flex tm:flex-wrap tm:items-center tm:justify-end tm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn({ 'tm:cursor-wait': isRefreshing })}
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn('tm:size-3', { 'tm:animate-spin': isRefreshing })} />
                    {localeService.t('settings-ui.skill.refresh')}
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setAddRepositoryOpen(true)}
                  >
                    <Plus className="tm:size-3" />
                    {localeService.t('settings-ui.skill.add-repository')}
                  </Button>
                </div>
              </div>

              {subView === 'marketplace' && (
                <div
                  className="tm:mt-3 tm:flex tm:flex-wrap tm:items-center tm:gap-2 tm:border-t tm:border-line tm:pt-3"
                >
                  <div className="tm:relative tm:min-w-60 tm:flex-1">
                    <Search
                      className="
                        tm:pointer-events-none tm:absolute tm:top-1/2 tm:left-2.5 tm:size-3.5 tm:-translate-y-1/2
                        tm:text-grey
                      "
                    />
                    <Input
                      className="tm:h-7 tm:pr-3 tm:pl-8 tm:text-xs"
                      placeholder={localeService.t('settings-ui.skill.marketplace-search-placeholder')}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>

                  <Select value={marketplaceRepositoryId} onValueChange={setMarketplaceRepositoryId}>
                    <SelectTrigger className="tm:w-55 tm:text-xs" size="xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {marketplaceRepositoryFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                </div>
              )}
            </div>

            <TabsContent value="installed" className="tm:w-full tm:flex-1 tm:overflow-hidden">
              <div
                className="
                  tm:h-full tm:overflow-y-auto
                  tm:mask-[linear-gradient(to_bottom,black,black_calc(100%-16px),transparent)] tm:pb-3
                "
              >
                <SkillInstalled
                  skills={skills}
                  repositories={repositories}
                  searchQuery={searchQuery}
                  activeRepositoryId={activeRepositoryId}
                  onSkillsChanged={loadSkills}
                />
              </div>
            </TabsContent>

            <TabsContent value="marketplace" className="tm:w-full tm:flex-1 tm:overflow-hidden">
              <div
                className="
                  tm:size-full tm:overflow-y-auto
                  tm:mask-[linear-gradient(to_bottom,black,black_calc(100%-16px),transparent)] tm:pb-3
                "
              >
                <SkillMarketplace
                  installedSkills={skills}
                  repositories={repositories}
                  searchQuery={searchQuery}
                  repositoryFilterId={marketplaceRepositoryId}
                  onCountChange={setMarketplaceCount}
                  onInstalled={loadSkills}
                />
              </div>
            </TabsContent>

            <TabsContent value="repositories" className="tm:m-0 tm:min-h-0 tm:flex-1 tm:overflow-hidden">
              <div
                className="
                  tm:h-full tm:overflow-y-auto
                  tm:mask-[linear-gradient(to_bottom,black,black_calc(100%-16px),transparent)] tm:pb-3
                "
              >
                <SkillRepositories
                  repositories={repositories}
                  repositorySkillCounts={repositorySkillCounts}
                  activeRepositoryId={activeRepositoryId}
                  onRepositorySelect={setActiveRepositoryId}
                  onRepositoryEdit={setEditingRepository}
                  onRepositoriesChanged={handleRepositoriesChanged}
                />
              </div>
            </TabsContent>
          </Tabs>

          <AddSkillRepositoryDialog
            open={addRepositoryOpen}
            onOpenChange={setAddRepositoryOpen}
            onAdded={handleRepositoryAdded}
          />

          <EditSkillRepositoryDialog
            open={!!editingRepository}
            repository={editingRepository}
            onOpenChange={(open) => !open && setEditingRepository(null)}
            onUpdated={handleRepositoryUpdated}
          />
        </CardContent>
      </Card>
    </FieldGroup>
  );
}
