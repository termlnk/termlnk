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
import { Badge, Button, cn, Switch, useDependency } from '@termlnk/design';
import { ChevronDown, ChevronRight, Trash2, Wand2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { getSkillRepositoryForPath } from './utils';

const cardCls = `
  tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg/65 tm:p-5 tm:transition-all
  tm:hover:border-blue/30 tm:hover:bg-one-bg/80
`;

const SOURCE_ACCENTS: Record<string, string> = {
  builtin: 'tm:bg-blue/10 tm:text-blue',
  user: 'tm:bg-green/10 tm:text-green',
  project: 'tm:bg-yellow/10 tm:text-yellow',
  marketplace: 'tm:bg-purple/10 tm:text-purple',
  extension: 'tm:bg-cyan/10 tm:text-cyan',
};

const SOURCE_ORDER = ['builtin', 'user', 'project', 'marketplace', 'extension'];

interface ISkillInstalledProps {
  skills: ISkill[];
  repositories: ISkillRepository[];
  searchQuery: string;
  activeRepositoryId: string;
  onSkillsChanged: () => void;
}

export function SkillInstalled(props: ISkillInstalledProps) {
  const { skills, repositories, searchQuery, activeRepositoryId, onSkillsChanged } = props;
  const localeService = useDependency(LocaleService);
  const skillService = useDependency(ISkillService);
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set<string>());
  const [loadingSkillIds, setLoadingSkillIds] = useState<Set<string>>(new Set<string>());
  const [skillContents, setSkillContents] = useState<Record<string, string>>({});

  const filteredSkills = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return skills.filter((skill) => {
      const repository = getSkillRepositoryForPath(skill.path, repositories);

      if (activeRepositoryId === 'local' && repository) {
        return false;
      }

      if (activeRepositoryId !== 'all' && activeRepositoryId !== 'local' && repository?.id !== activeRepositoryId) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [skill.name, skill.path, repository?.displayName ?? '']
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [activeRepositoryId, repositories, searchQuery, skills]);

  const groupedSkills = useMemo(() => {
    const groups: Record<string, ISkill[]> = {};

    for (const skill of filteredSkills) {
      const source = skill.source || 'other';
      if (!groups[source]) {
        groups[source] = [];
      }
      groups[source].push(skill);
    }

    const orderedSources = [
      ...SOURCE_ORDER.filter((source) => groups[source]?.length),
      ...Object.keys(groups).filter((source) => !SOURCE_ORDER.includes(source)),
    ];

    return orderedSources.map((source) => ({ source, skills: groups[source] }));
  }, [filteredSkills]);

  const getSourceLabel = useCallback((source: string) => {
    const key = `settings-ui.skill.section-${source}`;
    const translated = localeService.t(key);
    return translated === key ? source : translated;
  }, [localeService]);

  const handleToggleEnabled = useCallback(async (id: string, enabled: boolean) => {
    await skillService.setEnabled(id, enabled);
    onSkillsChanged();
  }, [skillService, onSkillsChanged]);

  const handleUninstall = useCallback(async (id: string) => {
    await skillService.uninstall(id);
    onSkillsChanged();
  }, [skillService, onSkillsChanged]);

  const handleToggleExpand = useCallback(async (id: string) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    if (!skillContents[id]) {
      setLoadingSkillIds((prev) => new Set(prev).add(id));

      try {
        const content = await skillService.getContent(id);
        setSkillContents((prev) => ({ ...prev, [id]: content }));
      } catch {
        // ignore
      } finally {
        setLoadingSkillIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  }, [skillService, skillContents]);

  if (skills.length === 0) {
    return (
      <section className={cardCls}>
        <div className="tm:flex tm:flex-col tm:items-center tm:gap-3 tm:py-4 tm:text-center">
          <div
            className="
              tm:flex tm:size-12 tm:items-center tm:justify-center tm:rounded-2xl tm:bg-one-bg2/90 tm:text-blue
            "
          >
            <Wand2 className="tm:size-5" />
          </div>
          <div className="tm:flex tm:flex-col tm:gap-1">
            <p className="tm:text-sm tm:font-medium tm:text-white">
              {localeService.t('settings-ui.skill.installed-empty')}
            </p>
            <p className="tm:text-xs tm:text-grey-fg">
              {localeService.t('settings-ui.skill.installed-empty-hint')}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (filteredSkills.length === 0) {
    return (
      <section className={cardCls}>
        <div className="tm:flex tm:flex-col tm:items-center tm:gap-3 tm:py-4 tm:text-center">
          <div
            className="
              tm:flex tm:size-12 tm:items-center tm:justify-center tm:rounded-2xl tm:bg-one-bg2/90 tm:text-blue
            "
          >
            <Wand2 className="tm:size-5" />
          </div>
          <div className="tm:flex tm:flex-col tm:gap-1">
            <p className="tm:text-sm tm:font-medium tm:text-white">
              {localeService.t('settings-ui.skill.filtered-empty')}
            </p>
            <p className="tm:text-xs tm:text-grey-fg">
              {localeService.t('settings-ui.skill.filtered-empty-hint')}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="tm:flex tm:flex-col tm:gap-5">
      {groupedSkills.map(({ source, skills: groupSkills }) => (
        <div key={source} className="tm:flex tm:flex-col tm:gap-3">
          <span className="tm:text-[11px] tm:font-medium tm:tracking-wider tm:text-grey tm:uppercase">
            {getSourceLabel(source)}
            {' '}
            (
            {groupSkills.length}
            )
          </span>

          {groupSkills.map((skill) => {
            const isExpanded = expandedSkills.has(skill.id);
            const isLoadingContent = loadingSkillIds.has(skill.id);
            const repository = getSkillRepositoryForPath(skill.path, repositories);
            const expandLabel = isExpanded
              ? localeService.t('settings-ui.skill.content-collapse')
              : localeService.t('settings-ui.skill.content-expand');

            return (
              <section key={skill.id} className={cardCls}>
                <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
                  <div className="tm:flex tm:min-w-0 tm:flex-1 tm:items-start tm:gap-3">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleToggleExpand(skill.id)}
                      aria-expanded={isExpanded}
                      aria-label={expandLabel}
                      title={expandLabel}
                    >
                      {isExpanded
                        ? <ChevronDown className="tm:size-3" />
                        : <ChevronRight className="tm:size-3" />}
                    </Button>
                    <div className="tm:min-w-0 tm:flex-1">
                      <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-1.5">
                        <span className="tm:text-sm tm:font-semibold tm:text-white">
                          {skill.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn('tm:border-transparent tm:text-[10px]', SOURCE_ACCENTS[skill.source] ?? `
                            tm:text-grey-fg
                          `)}
                        >
                          {getSourceLabel(skill.source)}
                        </Badge>
                        {skill.version && (
                          <span className="tm:text-[10px] tm:text-grey-fg">
                            v
                            {skill.version}
                          </span>
                        )}
                      </div>

                      <p className="tm:mt-1 tm:text-[11px]/relaxed tm:break-all tm:text-light-grey">
                        {skill.path}
                      </p>
                    </div>
                  </div>

                  <div className="tm:flex tm:items-center tm:gap-2">
                    {skill.source !== 'builtin' && !repository && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="tm:hover:bg-red/10 tm:hover:text-red"
                        onClick={() => handleUninstall(skill.id)}
                        title={localeService.t('settings-ui.skill.action-uninstall')}
                        aria-label={localeService.t('settings-ui.skill.action-uninstall')}
                      >
                        <Trash2 className="tm:size-3" />
                      </Button>
                    )}
                    <Switch
                      checked={skill.enabled}
                      onCheckedChange={(checked) => handleToggleEnabled(skill.id, checked)}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="tm:mt-4 tm:rounded-xl tm:border tm:border-line/70 tm:bg-darker-black/70 tm:p-4">
                    <div className="tm:mb-2 tm:flex tm:items-center tm:justify-between tm:gap-3">
                      <span className="tm:text-[10px] tm:font-medium tm:tracking-wider tm:text-grey tm:uppercase">
                        SKILL.md
                      </span>
                      <span className="tm:max-w-80 tm:truncate tm:text-[10px] tm:text-grey-fg" title={skill.path}>
                        {skill.path}
                      </span>
                    </div>
                    <pre
                      className="tm:overflow-x-auto tm:text-[11px]/relaxed tm:whitespace-pre-wrap tm:text-grey-fg"
                    >
                      {isLoadingContent
                        ? localeService.t('settings-ui.skill.content-loading')
                        : (skillContents[skill.id] ?? '')}
                    </pre>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}
