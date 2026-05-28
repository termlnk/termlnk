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

import type { ISkillRepository } from '@termlnk/agent';
import { ISkillService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Badge, Button, cn, useDependency } from '@termlnk/design';
import { Pencil, Trash2 } from 'lucide-react';
import { useCallback } from 'react';

interface ISkillRepositoriesProps {
  repositories: ISkillRepository[];
  repositorySkillCounts: Record<string, number>;
  activeRepositoryId: string;
  onRepositorySelect: (repositoryId: string) => void;
  onRepositoryEdit: (repository: ISkillRepository) => void;
  onRepositoriesChanged: () => void | Promise<void>;
}

export function SkillRepositories(props: ISkillRepositoriesProps) {
  const { repositories, repositorySkillCounts, activeRepositoryId, onRepositorySelect, onRepositoryEdit, onRepositoriesChanged } = props;
  const localeService = useDependency(LocaleService);
  const skillService = useDependency(ISkillService);

  const handleRemoveRepository = useCallback(async (repositoryId: string) => {
    await skillService.removeRepository(repositoryId);

    if (activeRepositoryId === repositoryId) {
      onRepositorySelect('all');
    }

    await onRepositoriesChanged();
  }, [activeRepositoryId, onRepositoriesChanged, onRepositorySelect, skillService]);

  if (repositories.length === 0) {
    return (
      <section className={cn('tm:rounded-2xl tm:p-4 tm:transition-all')}>
        <div className="tm:flex tm:items-center tm:justify-between tm:gap-3">
          <div className="tm:min-w-0">
            <p className="tm:text-sm tm:font-medium tm:text-white">
              {localeService.t('settings-ui.skill.repository-empty')}
            </p>
            <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">
              {localeService.t('settings-ui.skill.repository-empty-hint')}
            </p>
          </div>
          <Badge variant="secondary" className="tm:bg-one-bg2/85">
            GitHub
          </Badge>
        </div>
      </section>
    );
  }

  return (
    <div className="tm:flex tm:flex-col tm:gap-3">
      <div
        className="
          tm:grid tm:grid-cols-1 tm:gap-3
          tm:xl:grid-cols-2
        "
      >
        {repositories.map((repository) => {
          const isActive = activeRepositoryId === repository.id;

          return (
            <section
              key={repository.id}
              className={cn('tm:rounded-2xl tm:p-4 tm:transition-all')}
            >
              <div className="tm:flex tm:items-start tm:justify-between tm:gap-2">
                <div
                  className="tm:flex tm:min-w-0 tm:flex-1 tm:items-start tm:gap-3 tm:text-left"
                  onClick={() => onRepositorySelect(isActive ? 'all' : repository.id)}
                >
                  <div className="tm:min-w-0 tm:flex-1">
                    <div className="tm:flex tm:items-center tm:gap-1">
                      <span className="tm:text-sm tm:font-semibold tm:text-white">
                        {repository.displayName}
                      </span>
                      <Badge variant="secondary" className="tm:bg-purple/10 tm:text-[10px] tm:text-purple">
                        GitHub
                      </Badge>
                      <Badge variant="secondary" className="tm:bg-one-bg2/85 tm:text-[10px]">
                        {localeService.t('settings-ui.skill.repository-skill-count', String(repositorySkillCounts[repository.id] ?? 0))}
                      </Badge>
                    </div>

                    <p className="tm:mt-1 tm:text-[11px] tm:text-light-grey">
                      {repository.url}
                    </p>
                    <div
                      className="tm:mt-2 tm:flex tm:flex-wrap tm:items-center tm:gap-2 tm:text-[11px] tm:text-grey-fg"
                    >
                      <span>
                        {localeService.t('settings-ui.skill.repository-branch')}
                        :
                        {' '}
                        {repository.branch || localeService.t('settings-ui.skill.repository-default-branch')}
                      </span>
                      {repository.subdirectory && (
                        <span>
                          {localeService.t('settings-ui.skill.repository-subdirectory')}
                          :
                          {' '}
                          {repository.subdirectory}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="tm:flex tm:items-center tm:gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="
                      tm:text-white
                      tm:hover:bg-blue/10 tm:hover:text-blue
                    "
                    onClick={(event) => {
                      event.stopPropagation();
                      onRepositoryEdit(repository);
                    }}
                    title={localeService.t('settings-ui.skill.repository-edit')}
                    aria-label={localeService.t('settings-ui.skill.repository-edit')}
                  >
                    <Pencil className="tm:size-3" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="
                      tm:text-white
                      tm:hover:bg-red/10 tm:hover:text-red
                    "
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRemoveRepository(repository.id);
                    }}
                    title={localeService.t('settings-ui.skill.repository-remove')}
                    aria-label={localeService.t('settings-ui.skill.repository-remove')}
                  >
                    <Trash2 className="tm:size-3" />
                  </Button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
