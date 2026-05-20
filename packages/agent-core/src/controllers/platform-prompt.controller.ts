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

import type { PlatformType } from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import { IPlatformContextService, ISystemPromptService, PROMPT_PRIORITY, PROMPT_SECTION } from '@termlnk/agent';
import { Disposable, ILogService as ILogServiceId } from '@termlnk/core';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { PLATFORM_LINUX_SECTION } from '../common/prompt-sections/platform-linux';
import { PLATFORM_MACOS_SECTION } from '../common/prompt-sections/platform-macos';
import { PLATFORM_WINDOWS_SECTION } from '../common/prompt-sections/platform-windows';
import { PLATFORM_WSL_SECTION } from '../common/prompt-sections/platform-wsl';

interface IPlatformSectionMapping {
  id: string;
  content: string;
}

const PLATFORM_SECTION_MAP: Record<string, IPlatformSectionMapping> = {
  macos: { id: PROMPT_SECTION.PLATFORM_MACOS, content: PLATFORM_MACOS_SECTION },
  windows: { id: PROMPT_SECTION.PLATFORM_WINDOWS, content: PLATFORM_WINDOWS_SECTION },
  linux: { id: PROMPT_SECTION.PLATFORM_LINUX, content: PLATFORM_LINUX_SECTION },
  wsl: { id: PROMPT_SECTION.PLATFORM_WSL, content: PLATFORM_WSL_SECTION },
};

export class PlatformPromptController extends Disposable {
  private _currentSectionIds: string[] = [];

  constructor(
    @IPlatformContextService private readonly _platformContext: IPlatformContextService,
    @ISystemPromptService private readonly _systemPrompt: ISystemPromptService,
    @ILogServiceId private readonly _logService: ILogService
  ) {
    super();
    this._initialize();
  }

  private _initialize(): void {
    // Watch platform context changes
    this.disposeWithMe(
      this._platformContext.context$.pipe(
        map((ctx) => ctx.platform),
        distinctUntilChanged(),
        debounceTime(500)
      ).subscribe((platform) => {
        this._updatePlatformSections(platform);
      })
    );

    // Register dynamic environment context section (always active)
    this.disposeWithMe(
      this._systemPrompt.registerSection({
        id: PROMPT_SECTION.PLATFORM_CONTEXT,
        priority: PROMPT_PRIORITY.PLATFORM_CONTEXT,
        cacheable: false,
        getContent: () => this._buildEnvironmentContextSection(),
      })
    );
  }

  private _updatePlatformSections(platform: PlatformType | string): void {
    for (const id of this._currentSectionIds) {
      this._systemPrompt.removeSection(id);
    }
    this._currentSectionIds = [];

    // Register current platform section
    const match = PLATFORM_SECTION_MAP[platform];
    if (match) {
      this._systemPrompt.registerSection({
        id: match.id,
        priority: PROMPT_PRIORITY.PLATFORM_SPECIFIC,
        cacheable: false,
        getContent: () => match.content,
      });
      this._currentSectionIds.push(match.id);
    }

    // WSL also gets Linux section
    if (platform === 'wsl') {
      this._systemPrompt.registerSection({
        id: PROMPT_SECTION.PLATFORM_LINUX,
        priority: PROMPT_PRIORITY.PLATFORM_SPECIFIC + 1,
        cacheable: false,
        getContent: () => PLATFORM_LINUX_SECTION,
      });
      this._currentSectionIds.push(PROMPT_SECTION.PLATFORM_LINUX);
    }

    this._systemPrompt.rebuild();
    this._logService.log(`[PlatformPromptController] Platform sections updated: ${platform}`);
  }

  private _buildEnvironmentContextSection(): string {
    const ctx = this._platformContext.getContext();
    return [
      '# Environment Context',
      '',
      `- **OS**: ${ctx.osVersion} (${ctx.platform}, ${ctx.arch})`,
      `- **Shell**: ${ctx.defaultShell}`,
      `- **Date**: ${ctx.currentDate}`,
      `- **Home**: ${ctx.homeDir}`,
      `- **Language**: ${ctx.locale}`,
    ].join('\n');
  }
}
