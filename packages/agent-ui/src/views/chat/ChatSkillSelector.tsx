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

import { ISkillService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, Checkbox, cn, HoverPanel, HoverPanelBody, HoverPanelContent, HoverPanelFooter, HoverPanelHeader, HoverPanelTrigger, useDependency } from '@termlnk/design';
import { IChatSessionService } from '@termlnk/rpc-client';
import { Loader2, UserRound, Wand2 } from 'lucide-react';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ChatSkillSource = 'builtin' | 'project' | 'user' | 'extension' | 'marketplace';

interface IChatSelectableSkill {
  id: string;
  name: string;
  description: string;
  source: ChatSkillSource;
}

const SOURCE_ORDER: Record<ChatSkillSource, number> = {
  builtin: 0,
  project: 1,
  user: 2,
  extension: 3,
  marketplace: 4,
};

function sortSkills(skills: IChatSelectableSkill[]): IChatSelectableSkill[] {
  return [...skills].sort((a, b) => {
    const sourceDelta = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
    if (sourceDelta !== 0) {
      return sourceDelta;
    }
    return a.name.localeCompare(b.name);
  });
}

function readSelectedSkillIds(session: any): string[] | null {
  if (!session || !Array.isArray(session.selectedSkillIds)) {
    return null;
  }

  return session.selectedSkillIds.filter((id: unknown): id is string => typeof id === 'string');
}

export function ChatSkillSelector() {
  const chatSessionService = useDependency(IChatSessionService);
  const skillService = useDependency(ISkillService);
  const localeService = useDependency(LocaleService);
  const currentSessionIdRef = useRef<string | null>(null);
  const pendingSelectedSkillIdsRef = useRef<string[] | null>(null);
  const sessionLoadVersionRef = useRef(0);

  const [skills, setSkills] = useState<IChatSelectableSkill[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionSelectedSkillIds, setSessionSelectedSkillIds] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadSkills = useCallback(async () => {
    const enabled = await skillService.getEnabled();
    const withDescriptions = await Promise.all(
      enabled.map(async (skill) => {
        let description = '';
        try {
          const content = await skillService.getContent(skill.id);
          const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
          if (fm) {
            const desc = fm[1].match(/^description:\s*(.+)$/m);
            if (desc) description = desc[1].trim();
          }
        } catch {
          // ignore
        }
        return { ...skill, description };
      })
    );
    startTransition(() => {
      setSkills(sortSkills(withDescriptions));
    });
  }, [skillService]);

  const loadSessionSelection = useCallback(async (sessionId: string | null) => {
    const loadVersion = sessionLoadVersionRef.current + 1;
    sessionLoadVersionRef.current = loadVersion;

    if (!sessionId) {
      pendingSelectedSkillIdsRef.current = null;
      startTransition(() => {
        setSessionSelectedSkillIds(null);
      });
      return;
    }

    try {
      const session = await chatSessionService.getSession(sessionId);
      if (sessionLoadVersionRef.current !== loadVersion) {
        return;
      }

      const nextSelectedSkillIds = readSelectedSkillIds(session);
      if (pendingSelectedSkillIdsRef.current && nextSelectedSkillIds === null) {
        return;
      }

      pendingSelectedSkillIdsRef.current = null;

      startTransition(() => {
        setSessionSelectedSkillIds(nextSelectedSkillIds);
      });
    } catch {
      if (sessionLoadVersionRef.current !== loadVersion) {
        return;
      }

      if (pendingSelectedSkillIdsRef.current) {
        return;
      }

      startTransition(() => {
        setSessionSelectedSkillIds(null);
      });
    }
  }, [chatSessionService]);

  useEffect(() => {
    let active = true;

    void loadSkills();

    const sub = skillService.onChanged$().subscribe(() => {
      if (!active) {
        return;
      }
      void loadSkills();
    });

    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [loadSkills, skillService]);

  useEffect(() => {
    const currentSessionSub = chatSessionService.currentSessionId$.subscribe((sessionId) => {
      currentSessionIdRef.current = sessionId;
      startTransition(() => {
        setCurrentSessionId(sessionId);
      });
      void loadSessionSelection(sessionId);
    });

    const sessionSub = chatSessionService.sessions$.subscribe((event) => {
      if (event.sessionId !== currentSessionIdRef.current) {
        return;
      }

      if (event.type === 'delete') {
        currentSessionIdRef.current = null;
        pendingSelectedSkillIdsRef.current = null;
        startTransition(() => {
          setCurrentSessionId(null);
          setSessionSelectedSkillIds(null);
        });
        return;
      }

      void loadSessionSelection(currentSessionIdRef.current);
    });

    return () => {
      currentSessionSub.unsubscribe();
      sessionSub.unsubscribe();
    };
  }, [chatSessionService, loadSessionSelection]);

  const availableSkillIds = useMemo(() => skills.map((skill) => skill.id), [skills]);
  const availableSkillIdSet = useMemo(() => new Set(availableSkillIds), [availableSkillIds]);

  const selectedSkillIds = useMemo(() => {
    if (sessionSelectedSkillIds === null) {
      return availableSkillIds;
    }

    return sessionSelectedSkillIds.filter((id) => availableSkillIdSet.has(id));
  }, [availableSkillIdSet, availableSkillIds, sessionSelectedSkillIds]);

  const selectedSkillIdSet = useMemo(() => new Set(selectedSkillIds), [selectedSkillIds]);
  const selectedCount = selectedSkillIds.length;
  const triggerCountLabel = selectedCount > 99 ? '99+' : String(selectedCount);

  const persistSelectedSkills = useCallback(async (nextSkillIds: string[]) => {
    const previous = sessionSelectedSkillIds;

    pendingSelectedSkillIdsRef.current = nextSkillIds;
    startTransition(() => {
      setSessionSelectedSkillIds(nextSkillIds);
    });
    setIsSaving(true);

    try {
      let sessionId = currentSessionIdRef.current;
      if (!sessionId) {
        sessionId = await chatSessionService.newSession();
        currentSessionIdRef.current = sessionId;
        startTransition(() => {
          setCurrentSessionId(sessionId);
        });
      }

      await chatSessionService.setSelectedSkills(sessionId, nextSkillIds);
    } catch (error) {
      console.error('[ChatSkillSelector] Failed to persist selected skills:', error);
      pendingSelectedSkillIdsRef.current = null;
      startTransition(() => {
        setSessionSelectedSkillIds(previous);
      });
    } finally {
      setIsSaving(false);
    }
  }, [chatSessionService, sessionSelectedSkillIds]);

  const handleSkillToggle = useCallback((skillId: string, checked: boolean) => {
    const nextSelectedIdSet = new Set(selectedSkillIdSet);
    if (checked) {
      nextSelectedIdSet.add(skillId);
    } else {
      nextSelectedIdSet.delete(skillId);
    }

    void persistSelectedSkills(availableSkillIds.filter((id) => nextSelectedIdSet.has(id)));
  }, [availableSkillIds, persistSelectedSkills, selectedSkillIdSet]);

  const handleSelectAll = useCallback(() => {
    void persistSelectedSkills(availableSkillIds);
  }, [availableSkillIds, persistSelectedSkills]);

  const handleClearAll = useCallback(() => {
    void persistSelectedSkills([]);
  }, [persistSelectedSkills]);

  return (
    <HoverPanel>
      <HoverPanelTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            'tm:relative tm:flex tm:size-7 tm:text-light-grey tm:transition-colors'
          )}
          title={localeService.t('agent-ui.chat.skills')}
          aria-label={localeService.t('agent-ui.chat.skills')}
        >
          <Wand2 size={12} />
          {selectedCount > 0 && (
            <span
              className="
                tm:absolute tm:-top-1 tm:-right-1.5 tm:flex tm:h-3 tm:min-w-3 tm:items-center tm:justify-center
                tm:rounded-full tm:bg-blue tm:px-0.5 tm:text-[6px] tm:leading-none tm:font-bold tm:text-[#fff]
              "
            >
              {triggerCountLabel}
            </span>
          )}
        </Button>
      </HoverPanelTrigger>

      <HoverPanelContent
        side="top"
        align="start"
        className={`
          tm:min-h-87 tm:w-62 tm:min-w-62 tm:border-line tm:bg-black tm:p-0 tm:shadow-none tm:[box-shadow:none]
        `}
      >
        <HoverPanelHeader
          className={`
            tm:grid tm:max-h-70 tm:min-h-10 tm:grid-cols-[minmax(0,1fr)_auto] tm:items-center tm:gap-x-1 tm:gap-y-1.5
            tm:px-3 tm:py-1.5 tm:select-none
          `}
        >
          <div className="tm:flex tm:min-w-0 tm:items-center tm:gap-1">
            <div
              className="tm:flex tm:size-4 tm:shrink-0 tm:items-center tm:justify-center tm:text-light-grey"
            >
              <Wand2 className="tm:size-3" />
            </div>
            <div className="tm:min-w-0">
              <div className="tm:text-[12px] tm:font-semibold tm:text-white">
                {localeService.t('agent-ui.chat.skills')}
              </div>
            </div>
          </div>

          <div className="tm:flex tm:items-center tm:gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              className="
                tm:h-auto tm:px-0 tm:text-[10px] tm:font-normal tm:text-light-grey
                tm:hover:bg-transparent tm:hover:text-white
              "
              onClick={handleSelectAll}
              disabled={skills.length === 0 || selectedCount === skills.length}
            >
              {localeService.t('agent-ui.chat.skills-select-all')}
            </Button>
            <span className="tm:text-[10px] tm:text-line">|</span>
            <Button
              variant="ghost"
              size="xs"
              className="
                tm:h-auto tm:px-0 tm:text-[10px] tm:font-normal tm:text-light-grey
                tm:hover:bg-transparent tm:hover:text-white
              "
              onClick={handleClearAll}
              disabled={skills.length === 0 || selectedCount === 0}
            >
              {localeService.t('agent-ui.chat.skills-clear-all')}
            </Button>
          </div>
          <div className="tm:col-span-2 tm:text-[9px]/3.5 tm:text-light-grey">
            {localeService.t('agent-ui.chat.skills-hint')}
          </div>
        </HoverPanelHeader>

        <HoverPanelBody className="tm:max-h-88 tm:min-h-55 tm:bg-black">
          {skills.length === 0
            ? (
              <div
                className="
                  tm:flex tm:flex-col tm:items-center tm:justify-center tm:gap-2 tm:px-3.5 tm:py-8 tm:text-center
                  tm:select-none
                "
              >
                <div className="tm:text-[0.76rem] tm:font-medium tm:text-white">
                  {localeService.t('agent-ui.chat.skills-empty')}
                </div>
                <div className="tm:max-w-52 tm:text-[0.62rem]/4 tm:text-light-grey">
                  {localeService.t('agent-ui.chat.skills-empty-hint')}
                </div>
              </div>
            )
            : (
              <div className="tm:flex tm:flex-col">
                <div
                  className="
                    tm:flex tm:items-center tm:gap-1 tm:px-3.5 tm:py-1.5 tm:text-[0.64rem] tm:font-medium
                    tm:text-light-grey tm:select-none
                  "
                >
                  <UserRound className="tm:size-3" />
                  <span>{localeService.t('agent-ui.chat.skills-personal')}</span>
                </div>
                {skills.map((skill, index) => {
                  const checkboxId = `chat-skill-selector-${skill.id}`;
                  const isChecked = selectedSkillIdSet.has(skill.id);

                  return (
                    <label
                      key={skill.id}
                      htmlFor={checkboxId}
                      className={cn(
                        `
                          tm:flex tm:items-start tm:gap-2 tm:px-3.5 tm:py-1.5 tm:transition-colors
                          tm:hover:bg-one-bg/60
                        `,
                        {
                          'tm:border-t tm:border-line': index > 0,
                        }
                      )}
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={isChecked}
                        onCheckedChange={(checked) => handleSkillToggle(skill.id, checked === true)}
                        className={cn(`
                          tm:mt-0.5 tm:size-3.5 tm:rounded-sm tm:border-one-bg
                          tm:[&_svg]:size-2.5
                        `, {
                          'tm:data-[state=checked]:border-blue tm:data-[state=checked]:bg-blue': isChecked,
                        })}
                      />
                      <div className="tm:min-w-0 tm:flex-1">
                        <div className="tm:flex tm:items-center tm:gap-2">
                          <span
                            className="
                              tm:min-w-0 tm:flex-1 tm:truncate tm:text-[0.74rem] tm:font-semibold tm:text-white
                            "
                          >
                            {skill.name}
                          </span>
                        </div>
                        <div className="tm:mt-0.5 tm:truncate tm:text-[0.62rem] tm:text-light-grey">
                          {skill.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
        </HoverPanelBody>

        <HoverPanelFooter
          className="tm:justify-start tm:border-t tm:border-line tm:bg-black tm:px-3.5 tm:py-1.5"
        >
          <div className="tm:flex tm:items-center tm:gap-1.5 tm:text-[0.6rem] tm:text-light-grey">
            {isSaving && <Loader2 className="tm:size-2.5 tm:animate-spin" />}
            <span>
              {isSaving
                ? localeService.t('agent-ui.chat.skills-saving')
                : localeService.t(
                  currentSessionId
                    ? 'agent-ui.chat.skills-session-hint'
                    : 'agent-ui.chat.skills-session-hint-new'
                )}
            </span>
          </div>
        </HoverPanelFooter>
      </HoverPanelContent>
    </HoverPanel>
  );
}
