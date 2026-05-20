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

import { IAIAgentService, ISkillPromptService, ISkillStateService, ISystemPromptService, PROMPT_PRIORITY, PROMPT_SECTION } from '@termlnk/agent';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ChatRepository } from '@termlnk/database';
import { debounceTime, merge } from 'rxjs';

export class SkillAgentController extends Disposable {
  private _skillSectionIds: string[] = [];

  constructor(
    @IAIAgentService private readonly _aiAgentService: IAIAgentService,
    @ISkillPromptService private readonly _promptService: ISkillPromptService,
    @ISkillStateService private readonly _stateService: ISkillStateService,
    @ISystemPromptService private readonly _systemPromptService: ISystemPromptService,
    @Inject(ChatRepository) private readonly _chatRepository: ChatRepository,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._initialize();
  }

  private _initialize(): void {
    // Forward assembled prompt$ to AIAgentService
    this.disposeWithMe(
      this._systemPromptService.prompt$.subscribe((prompt) => {
        this._aiAgentService.setSystemPrompt(prompt);
      })
    );

    // Rebuild skill sections when skills or the active chat session changes
    this.disposeWithMe(
      merge(
        this._stateService.skills$,
        this._aiAgentService.currentSessionId$,
        this._chatRepository.changed$
      ).pipe(
        debounceTime(300)
      ).subscribe(() => {
        this._rebuildSkillSections().catch((err) => {
          this._logService.error(`[SkillAgentController] Failed to rebuild skill sections: ${err}`);
        });
      })
    );
  }

  private async _rebuildSkillSections(): Promise<void> {
    for (const id of this._skillSectionIds) {
      this._systemPromptService.removeSection(id);
    }
    this._skillSectionIds = [];

    const selectedSkillIds = await this._getSelectedSkillIds();

    // Register skill index section
    const skillIndex = this._promptService.getSkillIndex(selectedSkillIds);
    if (skillIndex && skillIndex !== '<available_skills />') {
      const indexId = PROMPT_SECTION.SKILL_INDEX;
      this._systemPromptService.registerSection({
        id: indexId,
        priority: PROMPT_PRIORITY.SKILLS,
        cacheable: false,
        getContent: () => `# Available Skills\n\n${skillIndex}`,
      });
      this._skillSectionIds.push(indexId);
    }

    // Register auto-inject skill content sections
    const autoInjectSkills = this._promptService.getAutoInjectSkills(selectedSkillIds);
    for (const skill of autoInjectSkills) {
      const contentId = `${PROMPT_SECTION.SKILL_CONTENT_PREFIX}${skill.name}`;
      try {
        const content = await this._promptService.getSkillContent(skill.name);
        this._systemPromptService.registerSection({
          id: contentId,
          priority: PROMPT_PRIORITY.SKILLS + 1,
          cacheable: false,
          getContent: () => `# Skill: ${skill.name}\n\n${content}`,
        });
        this._skillSectionIds.push(contentId);
      } catch (err) {
        this._logService.warn(`[SkillAgentController] Failed to load skill content for ${skill.name}: ${err}`);
      }
    }

    this._systemPromptService.rebuild();
    this._logService.log(`[SkillAgentController] Skill sections updated (${autoInjectSkills.length} auto-inject skills)`);
  }

  private async _getSelectedSkillIds(): Promise<string[] | null> {
    const sessionId = this._aiAgentService.getCurrentSessionId();
    if (!sessionId) {
      return null;
    }

    const session = await this._chatRepository.getSession(sessionId);
    if (!session || !Array.isArray(session.selectedSkillIds)) {
      return null;
    }

    return session.selectedSkillIds.filter((id): id is string => typeof id === 'string');
  }
}
