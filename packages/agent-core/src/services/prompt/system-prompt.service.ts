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

import type { IPromptSectionRegistration, ISystemPromptService } from '@termlnk/agent';
import type { IDisposable, ILogService } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { PROMPT_DYNAMIC_BOUNDARY, PROMPT_PRIORITY, PROMPT_SECTION } from '@termlnk/agent';
import { Disposable, ILogService as ILogServiceId, toDisposable } from '@termlnk/core';
import { BehaviorSubject, debounceTime, Subject } from 'rxjs';
import { BEHAVIOR_SECTION } from '../../common/prompt-sections/behavior';
import { COMMAND_SAFETY_SECTION } from '../../common/prompt-sections/command-safety';
import { CREDENTIAL_SAFETY_SECTION } from '../../common/prompt-sections/credential-safety';
import { IDENTITY_SECTION } from '../../common/prompt-sections/identity';
import { TOOL_USAGE_SECTION } from '../../common/prompt-sections/tool-usage';

export class SystemPromptService extends Disposable implements ISystemPromptService {
  private readonly _sections = new Map<string, IPromptSectionRegistration>();
  private readonly _prompt$ = new BehaviorSubject<string>('');
  readonly prompt$: Observable<string> = this._prompt$.asObservable();

  private readonly _rebuildTrigger$ = new Subject<void>();

  /** Tracks section IDs with pending async getContent to avoid redundant rebuilds. */
  private readonly _pendingAsyncSections = new Set<string>();

  constructor(
    @ILogServiceId private readonly _logService: ILogService
  ) {
    super();

    this.disposeWithMe(
      this._rebuildTrigger$.pipe(debounceTime(300)).subscribe(() => {
        this._assemble();
      })
    );

    this._registerCoreSections();
    this._assemble();
  }

  registerSection(section: IPromptSectionRegistration): IDisposable {
    this._sections.set(section.id, section);
    this._rebuildTrigger$.next();

    return this.disposeWithMe(toDisposable(() => {
      if (this._sections.get(section.id) === section) {
        this._sections.delete(section.id);
        this._rebuildTrigger$.next();
      }
    }));
  }

  removeSection(id: string): void {
    if (this._sections.delete(id)) {
      this._rebuildTrigger$.next();
    }
  }

  rebuild(): void {
    this._rebuildTrigger$.next();
  }

  getPrompt(): string {
    return this._prompt$.getValue();
  }

  getSectionIds(): string[] {
    return [...this._sections.keys()];
  }

  private _registerCoreSections(): void {
    const coreSections: IPromptSectionRegistration[] = [
      {
        id: PROMPT_SECTION.IDENTITY,
        priority: PROMPT_PRIORITY.IDENTITY,
        cacheable: true,
        getContent: () => IDENTITY_SECTION,
      },
      {
        id: PROMPT_SECTION.COMMAND_SAFETY,
        priority: PROMPT_PRIORITY.COMMAND_SAFETY,
        cacheable: true,
        getContent: () => COMMAND_SAFETY_SECTION,
      },
      {
        id: PROMPT_SECTION.BEHAVIOR,
        priority: PROMPT_PRIORITY.BEHAVIOR,
        cacheable: true,
        getContent: () => BEHAVIOR_SECTION,
      },
      {
        id: PROMPT_SECTION.TOOL_USAGE,
        priority: PROMPT_PRIORITY.TOOL_USAGE,
        cacheable: true,
        getContent: () => TOOL_USAGE_SECTION,
      },
      {
        id: PROMPT_SECTION.CREDENTIAL_SAFETY,
        priority: PROMPT_PRIORITY.CREDENTIAL_SAFETY,
        cacheable: true,
        getContent: () => CREDENTIAL_SAFETY_SECTION,
      },
    ];

    for (const section of coreSections) {
      this._sections.set(section.id, section);
    }
  }

  private _assemble(): void {
    try {
      const sections = [...this._sections.values()]
        .filter((s) => {
          if (s.isEnabled) {
            return s.isEnabled();
          }
          return true;
        })
        .sort((a, b) => a.priority - b.priority);

      const cacheableParts: string[] = [];
      const dynamicParts: string[] = [];

      for (const section of sections) {
        const content = section.getContent();
        if (content instanceof Promise) {
          // Track pending async section and schedule rebuild after resolution
          if (!this._pendingAsyncSections.has(section.id)) {
            this._pendingAsyncSections.add(section.id);
            content.then((resolved) => {
              this._pendingAsyncSections.delete(section.id);
              if (resolved) {
                this._rebuildTrigger$.next();
              }
            }).catch((err) => {
              this._pendingAsyncSections.delete(section.id);
              this._logService.error('[SystemPromptService]', `Failed to resolve section "${section.id}":`, err);
            });
          }
          continue;
        }
        if (!content) {
          continue;
        }
        if (section.cacheable) {
          cacheableParts.push(content);
        } else {
          dynamicParts.push(content);
        }
      }

      let prompt = cacheableParts.join('\n\n');
      if (dynamicParts.length > 0) {
        prompt += PROMPT_DYNAMIC_BOUNDARY + dynamicParts.join('\n\n');
      }

      this._prompt$.next(prompt);
    } catch (err) {
      this._logService.error('[SystemPromptService]', 'Failed to assemble system prompt:', err);
    }
  }

  override dispose(): void {
    this._prompt$.complete();
    this._rebuildTrigger$.complete();
    this._pendingAsyncSections.clear();
    super.dispose();
  }
}
