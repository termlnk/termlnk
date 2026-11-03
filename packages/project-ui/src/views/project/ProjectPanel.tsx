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
import { useDependency, useObservable } from '@termlnk/design';
import { IProjectPanelService } from '../../services/project-panel.service';
import { ChangesView } from './ChangesView';
import { FilesView } from './FilesView';

export type ProjectPanelView = 'changes' | 'files';

export interface IProjectPanelProps {
  view: ProjectPanelView;
}

/**
 * Shared shell for the two project tabs. Both need the same project context and
 * the same "nothing to show yet" answers, so the guards live here once instead
 * of in each view.
 */
export function ProjectPanel({ view }: IProjectPanelProps) {
  const localeService = useDependency(LocaleService);
  const panel = useDependency(IProjectPanelService);
  const ctx = useObservable(panel.context$, null);

  if (!ctx) {
    return <Empty>{localeService.t('project-ui.explorer.empty')}</Empty>;
  }

  if (view === 'changes' && !ctx.isGitRepository) {
    return <Empty>{localeService.t('project-ui.git.not-a-repo')}</Empty>;
  }

  return view === 'changes' ? <ChangesView /> : <FilesView />;
}

export function ProjectChangesPanel() {
  return <ProjectPanel view="changes" />;
}

export function ProjectFilesPanel() {
  return <ProjectPanel view="files" />;
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div
      className="tm:flex tm:h-full tm:items-center tm:justify-center tm:px-3 tm:text-center tm:text-xs tm:text-grey"
    >
      {children}
    </div>
  );
}
