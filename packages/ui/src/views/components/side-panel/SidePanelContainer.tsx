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

import type { LucideIcon } from 'lucide-react';
import type { ISidePanelDescriptor } from '../../../services/side-panel/side-panel.service';
import { ICommandService, LocaleService } from '@termlnk/core';
import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { Bot, FileDiff, FolderTree, GitBranch, Globe, X } from 'lucide-react';
import { useRef } from 'react';
import { ToggleRightSidebarCommand } from '../../../commands/toggle-right-sidebar.command';
import { ISidePanelService } from '../../../services/side-panel/side-panel.service';

const ICON_MAP: Record<string, LucideIcon> = {
  bot: Bot,
  diff: FileDiff,
  folder: FolderTree,
  git: GitBranch,
  globe: Globe,
};

/**
 * Sole occupant of BuiltInUIPart.RIGHT_SIDEBAR. Renders one tab row for all
 * registered panels plus the active panel's body. Visited panels stay mounted
 * (hidden) so scroll position / webview state survive switches.
 */
export function SidePanelContainer() {
  const sidePanelService = useDependency(ISidePanelService);
  const localeService = useDependency(LocaleService);
  const commandService = useDependency(ICommandService);
  const panels = useObservable(sidePanelService.panels$, []);
  const selectedId = useObservable(sidePanelService.activePanelId$, null);

  // Render fallback, not a state write: the sidebar can be revealed by the
  // generic toggle-right-sidebar command while no panel has been picked yet, and
  // an empty body would look broken. The service stays the owner of selection.
  const activeId = selectedId ?? panels[0]?.id ?? null;

  // Panels mount lazily (each one starts fetching on mount) but stay mounted
  // afterwards so scroll position / webview state survive switches. Recorded
  // during render because `activeId` already comes from an observable: its
  // change is what re-renders us, so no extra state or effect is needed.
  const visitedRef = useRef<Set<string>>(new Set());
  if (activeId) {
    visitedRef.current.add(activeId);
  }
  const mounted = panels.filter((p) => visitedRef.current.has(p.id));

  if (panels.length === 0) {
    return null;
  }

  const active = panels.find((p) => p.id === activeId);
  const Actions = active?.actions;

  return (
    <div className="tm:flex tm:h-full tm:min-w-0 tm:flex-col tm:bg-black">
      <div
        className={cn(`
          tm:flex tm:h-9 tm:shrink-0 tm:items-center tm:gap-1 tm:border-b tm:border-line tm:bg-black tm:px-1.5
        `)}
      >
        {/* Tabs scroll rather than shrink: a squeezed sidebar would otherwise compress every label into an unreadable stub. */}
        <nav
          className="tm:flex tm:min-w-0 tm:flex-1 tm:items-center tm:gap-0.5 tm:overflow-x-auto"
          aria-label={localeService.t('ui.side-panel.tabs')}
        >
          {panels.map((panel) => (
            <PanelTab
              key={panel.id}
              panel={panel}
              active={panel.id === activeId}
              title={localeService.t(panel.titleKey)}
              onClick={() => sidePanelService.setActivePanel(panel.id)}
            />
          ))}
        </nav>
        <div className="tm:flex tm:shrink-0 tm:items-center tm:gap-0.5 tm:select-none">
          {Actions && <Actions />}
          <Button
            variant="ghost"
            size="icon-xs"
            title={localeService.t('ui.right-sidebar-toggle.close-title')}
            onClick={() => commandService.executeCommand(ToggleRightSidebarCommand.id)}
          >
            <X size={14} />
          </Button>
        </div>
      </div>
      <div className="tm:relative tm:min-h-0 tm:min-w-0 tm:flex-1">
        {mounted.map((panel) => {
          const Component = panel.component;
          const isActive = panel.id === activeId;
          return (
            <div
              key={panel.id}
              className={cn(
                'tm:absolute tm:inset-0 tm:overflow-hidden',
                {
                  'tm:pointer-events-none tm:invisible': !isActive,
                }
              )}
              aria-hidden={!isActive}
            >
              <Component />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PanelTab({
  panel,
  active,
  title,
  onClick,
}: {
  panel: ISidePanelDescriptor;
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  const Icon = ICON_MAP[panel.icon] ?? FolderTree;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'tm:flex tm:h-7 tm:shrink-0 tm:items-center tm:gap-1.5 tm:rounded-md tm:px-2 tm:text-xs tm:transition-colors',
        {
          'tm:bg-one-bg3 tm:text-light-grey': active,
          'tm:text-grey tm:hover:bg-one-bg2 tm:hover:text-light-grey': !active,
        }
      )}
    >
      <Icon size={14} strokeWidth={1.5} className="tm:shrink-0" />
      <span className="tm:truncate">{title}</span>
    </button>
  );
}
