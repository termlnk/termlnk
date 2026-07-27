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
 * Terminal identity configuration — which terminal emulator we announce
 * ourselves as to programs running inside the PTY.
 *
 * Why this exists: terminfo has no entry for graphics capabilities, so the CLI
 * ecosystem detects inline-image support by sniffing a hardcoded allow-list of
 * environment variables (TERM_PROGRAM, KITTY_WINDOW_ID, ITERM_SESSION_ID, ...).
 * A terminal not on those lists is treated as image-incapable and never even
 * gets offered an image — the CLI decides locally and emits a text placeholder.
 *
 * Termlnk's renderer does support Kitty graphics (chunked included), the iTerm2
 * inline image protocol, OSC 8 hyperlinks and truecolor, so announcing one of
 * those identities is an honest capability claim rather than a disguise.
 *
 * Default stays 'termlnk': announcing our own name is the truthful option, and
 * switching is an explicit user decision.
 *
 * Written by the settings UI, read by rpc-server (local PTY spawn + SSH
 * bootstrap). Persisted via ConfigRepository under TERMINAL_PLUGIN_CONFIG_KEY
 * ('terminal.config') / subKey 'identity'.
 */

export type TerminalIdentity = 'termlnk' | 'ghostty' | 'kitty' | 'iterm2';

export interface ITerminalIdentityConfig {
  /**
   * Terminal emulator identity announced via TERM_PROGRAM and friends.
   * - 'termlnk': announce ourselves (default). Most CLIs then assume no
   *   inline-image support.
   * - 'ghostty' / 'kitty': CLIs pick the Kitty graphics protocol.
   * - 'iterm2': CLIs pick the iTerm2 inline image protocol.
   */
  identity: TerminalIdentity;
}

export const TERMINAL_IDENTITIES: readonly TerminalIdentity[] = ['termlnk', 'ghostty', 'kitty', 'iterm2'];

export const DEFAULT_TERMINAL_IDENTITY_CONFIG: ITerminalIdentityConfig = {
  identity: 'termlnk',
};

/**
 * Version string reported alongside TERM_PROGRAM. Only needs to parse as a
 * plausible version — no consumer compares it against real releases.
 */
const IDENTITY_VERSIONS: Record<TerminalIdentity, string> = {
  termlnk: '0.0.0',
  ghostty: '1.2.0',
  kitty: '0.42.0',
  iterm2: '3.5.0',
};

/**
 * Fixed session id for the iTerm2 identity. Detectors only test for presence,
 * and a stable value keeps PTY environments reproducible across sessions.
 */
const ITERM_SESSION_ID = 'w0t0p0:5C8A1F2E-3B4D-4E5F-8A9B-0C1D2E3F4A5B';

/** Merge persisted config (possibly partial / legacy) with safe defaults. */
export function normalizeTerminalIdentityConfig(
  value: Partial<ITerminalIdentityConfig> | null | undefined
): ITerminalIdentityConfig {
  if (!value) {
    return { ...DEFAULT_TERMINAL_IDENTITY_CONFIG };
  }

  const identity = value.identity;
  if (typeof identity !== 'string' || !TERMINAL_IDENTITIES.includes(identity as TerminalIdentity)) {
    return { ...DEFAULT_TERMINAL_IDENTITY_CONFIG };
  }

  return { identity: identity as TerminalIdentity };
}

/**
 * Environment variables that declare the given identity.
 *
 * Never returns TERM. Overriding TERM (e.g. to 'xterm-kitty') would break
 * remote sessions whose terminfo database lacks that entry, which degrades far
 * worse than a missing image. TERM_PROGRAM plays no part in terminfo lookup,
 * so it is safe to vary.
 *
 * Values are restricted to [A-Za-z0-9._:-] so they stay safe to embed in the
 * single-quoted `export` lines of the SSH bootstrap script.
 */
export function resolveTerminalIdentityEnv(identity: TerminalIdentity): Record<string, string> {
  const version = IDENTITY_VERSIONS[identity] ?? IDENTITY_VERSIONS.termlnk;

  switch (identity) {
    case 'ghostty':
      return { TERM_PROGRAM: 'ghostty', TERM_PROGRAM_VERSION: version };
    case 'kitty':
      return { TERM_PROGRAM: 'kitty', TERM_PROGRAM_VERSION: version, KITTY_WINDOW_ID: '1' };
    case 'iterm2':
      return { TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: version, ITERM_SESSION_ID };
    case 'termlnk':
    default:
      return { TERM_PROGRAM: 'termlnk', TERM_PROGRAM_VERSION: IDENTITY_VERSIONS.termlnk };
  }
}

/**
 * Env keys any identity may set. Callers that mutate `process.env` in place
 * must clear all of them first, otherwise switching identities would leave the
 * previous identity's extra markers (e.g. KITTY_WINDOW_ID) behind.
 */
export const TERMINAL_IDENTITY_ENV_KEYS: readonly string[] = [
  'TERM_PROGRAM',
  'TERM_PROGRAM_VERSION',
  'KITTY_WINDOW_ID',
  'ITERM_SESSION_ID',
];
