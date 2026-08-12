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
import { LocaleService } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { Bot, FolderTree, GitBranch, Globe } from 'lucide-react';
import { useRef } from 'react';
import { ISidePanelService } from '../../../services/side-panel/side-panel.service';

const ICON_MAP: Record<string, LucideIcon> = {
  bot: Bot,
  folder: FolderTree,
  git: GitBranch,
  globe: Globe,
};

/**
 * Sole occupant of BuiltInUIPart.RIGHT_SIDEBAR. Renders a vertical icon rail
 * plus the active panel body. Visited panels stay mounted (hidden) so scroll
 * position / webview state survive switches.
 */
export function SidePanelContainer() {
  const sidePanelService = useDependency(ISidePanelService);
  const localeService = useDependency(LocaleService);
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

  return (
    <div className="tm:flex tm:h-full tm:min-w-0">
      <nav
        className={cn(`
          tm:flex tm:w-9 tm:shrink-0 tm:flex-col tm:items-center tm:gap-0.5 tm:border-r tm:border-line tm:bg-black
          tm:py-1.5
        `)}
        aria-label="Side panels"
      >
        {panels.map((panel) => (
          <RailButton
            key={panel.id}
            panel={panel}
            active={panel.id === activeId}
            title={localeService.t(panel.titleKey)}
            onClick={() => sidePanelService.setActivePanel(panel.id)}
          />
        ))}
      </nav>
      <div className="tm:relative tm:min-w-0 tm:flex-1">
        {mounted.map((panel) => {
          const Component = panel.component;
          const active = panel.id === activeId;
          return (
            <div
              key={panel.id}
              className={cn(
                'tm:absolute tm:inset-0 tm:overflow-hidden',
                {
                  'tm:pointer-events-none tm:invisible': !active,
                }
              )}
              aria-hidden={!active}
            >
              <Component />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RailButton({
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
        'tm:flex tm:size-7 tm:items-center tm:justify-center tm:rounded-md tm:transition-colors',
        {
          'tm:bg-one-bg3 tm:text-light-grey': active,
          'tm:text-grey tm:hover:bg-one-bg2 tm:hover:text-light-grey': !active,
        }
      )}
    >
      <Icon size={14} strokeWidth={1.5} />
    </button>
  );
}
