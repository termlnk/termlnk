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

import type { IACPProviderDescriptor } from '../models/acp-provider';

/**
 * Providers offered out of the box. Product names are intentional and must not
 * be localized. Availability is probed at runtime against PATH.
 *
 * Every command here is verified to actually speak ACP. Neither `claude` nor
 * `codex` does — they have no ACP flag at all — so both go through the
 * maintained Zed bridge packages instead. A command that is merely on PATH but
 * silent on stdio used to hang the handshake, which is why unverified guesses
 * do not belong in this list; candidates live in ACP_PROVIDER_REGISTRY and the
 * user adds them explicitly.
 */
export const ACP_PROVIDER_CATALOG: readonly IACPProviderDescriptor[] = [
  {
    id: 'claude-code',
    title: 'Claude Code',
    description: 'Anthropic Claude Code via the ACP bridge',
    version: '0.16.2',
    command: ['npx', '-y', '@zed-industries/claude-code-acp@0.16.2'],
    installLink: 'https://github.com/zed-industries/claude-code-acp',
    source: 'catalog',
  },
  {
    id: 'codex',
    title: 'Codex',
    description: 'OpenAI Codex via the ACP bridge',
    version: '0.16.0',
    command: ['npx', '-y', '@zed-industries/codex-acp@0.16.0'],
    installLink: 'https://github.com/zed-industries/codex-acp',
    source: 'catalog',
  },
  {
    id: 'gemini',
    title: 'Gemini CLI',
    description: "Google's official CLI for Gemini",
    version: '0.52.0',
    command: ['npx', '-y', '@google/gemini-cli@0.52.0', '--acp'],
    installLink: 'https://geminicli.com',
    source: 'catalog',
  },
  {
    id: 'kimi',
    title: 'Kimi Code CLI',
    description: "Moonshot AI's open-source terminal coding agent",
    version: '0.11.0',
    command: ['kimi', 'acp'],
    installLink: 'https://github.com/MoonshotAI/kimi-code',
    source: 'catalog',
  },
  {
    id: 'cursor',
    title: 'Cursor',
    description: "Cursor's coding agent",
    command: ['cursor-agent', 'acp'],
    installLink: 'https://docs.cursor.com/en/cli/overview',
    source: 'catalog',
  },
];
