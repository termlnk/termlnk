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

/**
 * Section ID constants — unique identifier for each prompt section.
 */
export const PROMPT_SECTION = {
  // Core sections (cacheable = true, static across sessions)
  IDENTITY: 'core.identity',
  COMMAND_SAFETY: 'core.command-safety',
  BEHAVIOR: 'core.behavior',
  TOOL_USAGE: 'core.tool-usage',
  CREDENTIAL_SAFETY: 'core.credential-safety',

  // Platform sections (cacheable = false, changes with detection)
  PLATFORM_CONTEXT: 'platform.context',
  PLATFORM_MACOS: 'platform.macos',
  PLATFORM_WINDOWS: 'platform.windows',
  PLATFORM_LINUX: 'platform.linux',
  PLATFORM_WSL: 'platform.wsl',
  PLATFORM_SSH: 'platform.ssh',

  // Skill sections (cacheable = false, changes with session/skill selection)
  SKILL_INDEX: 'skill.index',
  SKILL_CONTENT_PREFIX: 'skill.content.',

  // Terminal session section (cacheable = false, changes with session state)
  TERMINAL_SESSIONS: 'terminal.sessions',

  // Permission section (cacheable = false, changes with permission mode)
  PERMISSION_RULES: 'permission.rules',
};

/**
 * Section sort priority — lower numbers appear first.
 */
export const PROMPT_PRIORITY = {
  IDENTITY: 10,
  PLATFORM_CONTEXT: 20,
  TERMINAL_SESSIONS: 25,
  COMMAND_SAFETY: 30,
  PERMISSION_RULES: 35,
  BEHAVIOR: 40,
  TOOL_USAGE: 50,
  CREDENTIAL_SAFETY: 60,
  PLATFORM_SPECIFIC: 70,
  SKILLS: 80,
};

/**
 * Boundary marker between static (cacheable) and dynamic sections.
 * Used for LLM API prompt cache optimization — content before
 * the marker can be cached across requests.
 */
export const PROMPT_DYNAMIC_BOUNDARY = '\n<!-- dynamic-boundary -->\n';
