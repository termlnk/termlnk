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

import type { KeyboardEvent, RefObject } from 'react';
import type { ISlashCommandState } from './use-slash-command';
import { ISkillService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, cn, useDependency } from '@termlnk/design';
import { TerminalSquare, Wand2 } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

type SlashItemType = 'command' | 'skill';

interface ISlashCommandItem {
  id: string;
  name: string;
  description: string;
  type: SlashItemType;
}

export interface IChatSlashCommandPanelHandle {
  handleKeyDown: (e: KeyboardEvent) => boolean;
}

interface IChatSlashCommandPanelProps {
  slashState: ISlashCommandState;
  onSelect: (item: ISlashCommandItem) => void;
  onClose: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

const BUILTIN_COMMANDS: ISlashCommandItem[] = [
  { id: 'cmd:compact', name: '/compact', description: '压缩对话历史以节省 token', type: 'command' },
];

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---/;
const DESCRIPTION_RE = /^description:\s*(.+)$/m;

function extractDescription(content: string): string {
  const fm = content.match(FRONTMATTER_RE);
  if (!fm) return '';
  const desc = fm[1].match(DESCRIPTION_RE);
  return desc ? desc[1].trim() : '';
}

export const ChatSlashCommandPanel = forwardRef<IChatSlashCommandPanelHandle, IChatSlashCommandPanelProps>(
  function ChatSlashCommandPanel({ slashState, onSelect, onClose, textareaRef }, ref) {
    const skillService = useDependency(ISkillService);
    const localeService = useDependency(LocaleService);
    const [skillItems, setSkillItems] = useState<ISlashCommandItem[]>([]);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      let active = true;

      const load = async () => {
        const enabled = await skillService.getEnabled();
        if (!active) {
          return;
        }

        const items = await Promise.all(
          enabled.map(async (skill) => {
            const content = await skillService.getContent(skill.id);
            const description = extractDescription(content);
            return {
              id: `skill:${skill.id}`,
              name: `/skills:${skill.name}`,
              description,
              type: 'skill' as SlashItemType,
            };
          })
        );
        if (!active) {
          return;
        }
        setSkillItems(items);
      };

      void load();

      const sub = skillService.onChanged$().subscribe(() => {
        if (active) {
          void load();
        }
      });

      return () => {
        active = false;
        sub.unsubscribe();
      };
    }, [skillService]);

    const allItems = useMemo<ISlashCommandItem[]>(
      () => [...BUILTIN_COMMANDS, ...skillItems],
      [skillItems]
    );

    const filteredItems = useMemo(() => {
      if (!slashState.active) return [];
      const q = slashState.query.toLowerCase();
      if (!q) return allItems;
      return allItems.filter((item) => item.name.toLowerCase().includes(q));
    }, [allItems, slashState.active, slashState.query]);

    useEffect(() => {
      setHighlightIndex(0);
    }, [filteredItems.length, slashState.query]);

    useEffect(() => {
      if (!listRef.current) {
        return;
      }
      const highlighted = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }, [highlightIndex]);

    useEffect(() => {
      if (!slashState.active) return;

      function handleMouseDown(e: MouseEvent) {
        const target = e.target as Node;
        if (panelRef.current?.contains(target)) return;
        if (textareaRef.current?.contains(target)) return;
        onClose();
      }

      document.addEventListener('mousedown', handleMouseDown);
      return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [slashState.active, onClose, textareaRef]);

    useImperativeHandle(ref, () => ({
      handleKeyDown(e: React.KeyboardEvent): boolean {
        if (!slashState.active || filteredItems.length === 0) return false;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightIndex((prev) => (prev + 1) % filteredItems.length);
          return true;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
          return true;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const item = filteredItems[highlightIndex];
          if (item) {
            onSelect(item);
          }
          return true;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return true;
        }
        return false;
      },
    }), [slashState.active, filteredItems, highlightIndex, onSelect, onClose]);

    if (!slashState.active) return null;

    return (
      <div
        ref={panelRef}
        className={cn(`
          tm:absolute tm:bottom-full tm:left-0 tm:z-20 tm:mb-2 tm:flex tm:max-h-66.25 tm:min-h-22 tm:w-[320px]
          tm:flex-col tm:overflow-hidden tm:rounded-md tm:border tm:border-line tm:bg-black tm:pb-2 tm:shadow-lg
        `)}
      >
        <div
          className="tm:w-full tm:shrink-0 tm:p-2 tm:text-[10px] tm:font-medium tm:text-light-grey tm:select-none"
        >
          {localeService.t('agent-ui.chat.slash-panel-title')}
        </div>

        <div ref={listRef} className="tm:flex-1 tm:overflow-y-auto tm:px-1">
          {filteredItems.length === 0
            ? (
              <div
                className="tm:flex tm:size-full tm:items-center tm:justify-center tm:text-[10px] tm:text-white"
              >
                {localeService.t('agent-ui.chat.slash-panel-empty')}
              </div>
            )
            : (
              filteredItems.map((item, index) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="lg"
                  className={cn(
                    'tm:flex tm:h-10 tm:w-full tm:gap-2 tm:text-left',
                    {
                      'tm:bg-one-bg': index === highlightIndex,
                    }
                  )}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(item);
                  }}
                >
                  <div
                    className={cn(
                      'tm:flex tm:size-3.5 tm:shrink-0 tm:items-center tm:justify-center',
                      {
                        'tm:text-cyan': item.type === 'command',
                        'tm:text-purple': item.type === 'skill',
                      }
                    )}
                  >
                    {item.type === 'command'
                      ? <TerminalSquare size={12} />
                      : <Wand2 size={12} />}
                  </div>
                  <div className="tm:min-w-0 tm:flex-1">
                    <div className={cn('tm:text-[11px]/5 tm:text-blue')}>
                      {item.name}
                    </div>
                    <div className="tm:truncate tm:text-[10px] tm:text-light-grey">
                      {item.description}
                    </div>
                  </div>
                </Button>
              ))
            )}
        </div>
      </div>
    );
  }
);
