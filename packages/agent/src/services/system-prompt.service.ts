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

import type { IDisposable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { createIdentifier } from '@termlnk/core';

/**
 * System prompt section registration config.
 * Each section is a logical paragraph of the prompt, sorted by priority.
 */
export interface IPromptSectionRegistration {
  /** Unique ID, use PROMPT_SECTION constants */
  id: string;
  /** Sort priority — lower numbers appear first */
  priority: number;
  /** Whether this section can be cached across requests (true for static content) */
  cacheable: boolean;
  /** Returns the section content */
  getContent: () => string | Promise<string>;
  /** Whether this section is enabled (defaults to true), section is skipped when false */
  isEnabled?: () => boolean;
}

/**
 * Modular system prompt service.
 *
 * Supports multiple subsystems independently registering/unregistering sections,
 * auto-assembled by priority order.
 */
export interface ISystemPromptService {
  /** Assembled full system prompt (debounced 300ms) */
  readonly prompt$: Observable<string>;

  /** Register a section, returns IDisposable for unregistration */
  registerSection(section: IPromptSectionRegistration): IDisposable;

  /** Remove a section by ID */
  removeSection(id: string): void;

  /** Trigger reassembly (debounced 300ms) */
  rebuild(): void;

  /** Get current assembled prompt (synchronous, returns latest assembly result) */
  getPrompt(): string;

  /** Get all registered section IDs */
  getSectionIds(): string[];
}

export const ISystemPromptService = createIdentifier<ISystemPromptService>(
  'agent.system-prompt-service'
);
