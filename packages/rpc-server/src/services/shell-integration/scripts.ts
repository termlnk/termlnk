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

/* eslint-disable no-template-curly-in-string -- shell variable references, not JS template expressions */

import { Buffer } from 'node:buffer';

/**
 * Shell integration scripts that emit OSC 633 events matching
 * VS Code's Shell Integration Protocol.
 *
 * These scripts are the single source of truth used by both:
 * - packages/rpc-server/src/services/pty/shell-integration.ts (local PTY),
 *   which writes them to disk and sources them via shell-specific bootstrap
 *   (ZDOTDIR for zsh, --init-command for fish, --rcfile for bash);
 * - buildSshBootstrapCommand() below (SSH), which produces a single sh command
 *   that is executed on the remote via ssh2's exec channel. The command writes
 *   the integration scripts to disk under $XDG_DATA_HOME/termlnk/si and
 *   then `exec`s the user's interactive shell with the hooks wired up.
 *   No bytes are ever written to the remote interactive shell's stdin, so
 *   the injection is invisible — mirroring the local PTY approach.
 *
 * All hooks use the `__termlnk_` prefix and register via `precmd` / `preexec` /
 * `DEBUG trap` to avoid touching the user's `$PS1`. An idempotent guard
 * (`TERMLNK_SHELL_INTEGRATION=1`) prevents double-loading.
 */

/** Custom ZDOTDIR .zshenv that restores user's ZDOTDIR and loads integration via one-time precmd hook. */
export function getZshEnvBootstrap(): string {
  return [
    '# Termlnk Terminal - Shell Integration Bootstrap',
    '# Save our custom ZDOTDIR path for later use',
    '__termlnk_si_dir="${ZDOTDIR}"',
    '',
    '# Restore user\'s original ZDOTDIR immediately so .zprofile, .zshrc, .zlogin',
    '# are sourced from the correct location',
    'if [[ -n "${TERMLNK_ORIGINAL_ZDOTDIR}" ]]; then',
    '  ZDOTDIR="${TERMLNK_ORIGINAL_ZDOTDIR}"',
    'else',
    '  ZDOTDIR="${HOME}"',
    'fi',
    'unset TERMLNK_ORIGINAL_ZDOTDIR',
    '',
    '# Source user\'s .zshenv if it exists',
    '[[ -f "${ZDOTDIR}/.zshenv" ]] && source "${ZDOTDIR}/.zshenv"',
    '',
    '# Register a one-time precmd hook to load integration after all rc files are processed.',
    '# This ensures PS1 is already set by the user\'s .zshrc before we wrap it.',
    'autoload -Uz add-zsh-hook',
    '__termlnk_si_init() {',
    '  add-zsh-hook -d precmd __termlnk_si_init',
    '  unfunction __termlnk_si_init 2>/dev/null',
    '  source "${__termlnk_si_dir}/integration.zsh" 2>/dev/null',
    '  unset __termlnk_si_dir',
    '}',
    'add-zsh-hook precmd __termlnk_si_init',
    '',
  ].join('\n');
}

/** Zsh shell integration script that registers OSC 633 hooks. */
export function getZshIntegrationScript(): string {
  return [
    '# Termlnk Terminal - Zsh Shell Integration (OSC 633)',
    '# Prevent double loading',
    'if [[ -n "${TERMLNK_SHELL_INTEGRATION}" ]]; then',
    '  return',
    'fi',
    'export TERMLNK_SHELL_INTEGRATION=1',
    '',
    "__termlnk_prompt_start() { printf '\\e]633;A\\a'; }",
    "__termlnk_prompt_end() { printf '\\e]633;B\\a'; }",
    '',
    '__termlnk_preexec() {',
    "  printf '\\e]633;C\\a'",
    "  printf '\\e]633;E;%s\\a' \"${1// /\\\\x20}\"",
    '}',
    '',
    '__termlnk_precmd() {',
    '  local e=$?',
    "  printf '\\e]633;D;%d\\a' \"$e\"",
    "  printf '\\e]633;P;Cwd=%s\\a' \"$PWD\"",
    '}',
    '',
    'autoload -Uz add-zsh-hook',
    'add-zsh-hook preexec __termlnk_preexec',
    'add-zsh-hook precmd __termlnk_precmd',
    '',
    "if [[ \"$PS1\" != *'633;A'* ]]; then",
    "  PS1='%{$(__termlnk_prompt_start)%}'\"$PS1\"'%{$(__termlnk_prompt_end)%}'",
    'fi',
    '',
  ].join('\n');
}

/** Bash shell integration script that registers OSC 633 hooks. */
export function getBashIntegrationScript(): string {
  return [
    '# Termlnk Terminal - Bash Shell Integration (OSC 633)',
    '# Prevent double loading',
    'if [ -n "${TERMLNK_SHELL_INTEGRATION:-}" ]; then',
    '  return 2>/dev/null || true',
    'fi',
    'export TERMLNK_SHELL_INTEGRATION=1',
    '',
    "__termlnk_prompt_start() { printf '\\e]633;A\\a'; }",
    "__termlnk_prompt_end() { printf '\\e]633;B\\a'; }",
    '',
    '__termlnk_preexec() {',
    "  printf '\\e]633;C\\a'",
    '}',
    '',
    '__termlnk_precmd() {',
    '  local e=$?',
    "  printf '\\e]633;D;%d\\a' \"$e\"",
    "  printf '\\e]633;P;Cwd=%s\\a' \"$PWD\"",
    '}',
    '',
    '__termlnk_debug_trap() {',
    "  if [ \"$BASH_COMMAND\" != '__termlnk_precmd' ] && [ \"$BASH_COMMAND\" != '__termlnk_prompt_start' ] && [ \"$BASH_COMMAND\" != '__termlnk_prompt_end' ]; then",
    '    __termlnk_preexec',
    "    printf '\\e]633;E;%s\\a' \"$BASH_COMMAND\"",
    '  fi',
    '}',
    '',
    'if [[ -n "${BASH_VERSION:-}" ]]; then',
    '  if [[ -z "${PROMPT_COMMAND:-}" ]]; then',
    "    PROMPT_COMMAND='__termlnk_precmd'",
    '  elif [[ "$PROMPT_COMMAND" != *__termlnk_precmd* ]]; then',
    '    PROMPT_COMMAND="__termlnk_precmd;${PROMPT_COMMAND}"',
    '  fi',
    "  if [[ \"$PS1\" != *'633;A'* ]]; then",
    // \[ \] marks the OSC-emitting $(...) as zero-width; without this, bash
    // miscounts prompt columns and readline drifts out of sync with xterm.
    "    PS1='\\[$(__termlnk_prompt_start)\\]'\"$PS1\"'\\[$(__termlnk_prompt_end)\\]'",
    '  fi',
    "  trap '__termlnk_debug_trap' DEBUG",
    'fi',
    '',
  ].join('\n');
}

/** Fish shell integration script that registers OSC 633 hooks. */
export function getFishIntegrationScript(): string {
  return [
    '# Termlnk Terminal - Fish Shell Integration (OSC 633)',
    '# Prevent double loading',
    'if test -n "$TERMLNK_SHELL_INTEGRATION"',
    '  exit 0',
    'end',
    'set -gx TERMLNK_SHELL_INTEGRATION 1',
    '',
    'function __termlnk_fish_prompt --on-event fish_prompt',
    "  printf '\\e]633;A\\a'",
    'end',
    '',
    'function __termlnk_fish_prompt_end --on-event fish_prompt',
    "  printf '\\e]633;B\\a'",
    'end',
    '',
    'function __termlnk_preexec --on-event fish_preexec',
    "  printf '\\e]633;C\\a'",
    "  printf '\\e]633;E;%s\\a' (string escape --style=url -- $argv)",
    'end',
    '',
    'function __termlnk_postexec --on-event fish_postexec',
    "  printf '\\e]633;D;%d\\a' $status",
    "  printf '\\e]633;P;Cwd=%s\\a' $PWD",
    'end',
    '',
  ].join('\n');
}

export type SupportedRemoteShell = 'bash' | 'zsh' | 'fish';

/** Get the integration script body for a supported shell, or null. */
export function getIntegrationScriptForShell(shell: string): string | null {
  switch (shell) {
    case 'bash':
      return getBashIntegrationScript();
    case 'zsh':
      return getZshIntegrationScript();
    case 'fish':
      return getFishIntegrationScript();
    default:
      return null;
  }
}

/**
 * Bash rcfile used when launching bash over SSH with `--rcfile`. `--rcfile`
 * turns bash into an interactive NON-login shell, so the rcfile manually
 * reproduces the profile-loading bash would normally do for an SSH login
 * shell (sourcing /etc/profile + $HOME/.bash_profile / .bash_login / .profile,
 * plus the interactive bashrc chain). Follows VS Code's integrated-terminal
 * approach.
 */
export function getBashSshRcFile(): string {
  return [
    '# Termlnk Terminal - Bash shell integration rcfile (SSH bootstrap)',
    '# Replicate the profile chain an SSH login shell would normally source.',
    '[ -r /etc/profile ] && . /etc/profile',
    'if [ -r "$HOME/.bash_profile" ]; then',
    '  . "$HOME/.bash_profile"',
    'elif [ -r "$HOME/.bash_login" ]; then',
    '  . "$HOME/.bash_login"',
    'else',
    '  [ -r "$HOME/.profile" ] && . "$HOME/.profile"',
    '  [ -r /etc/bash.bashrc ] && . /etc/bash.bashrc',
    '  [ -r "$HOME/.bashrc" ] && . "$HOME/.bashrc"',
    'fi',
    '',
    getBashIntegrationScript(),
  ].join('\n');
}

/**
 * Build the single-line sh command to run on the remote via ssh2 exec channel.
 * The command writes the integration scripts to disk under
 * $XDG_DATA_HOME/termlnk/si and then `exec`s the user's interactive shell with
 * hooks wired up — no bytes are written to the shell's stdin, so the injection
 * is invisible.
 *
 * The outer wrapper is `sh -c 'eval "$(printf %s <b64> | base64 -d)"'`. Using
 * `sh -c` (rather than piping the script into sh's stdin) is CRITICAL: when
 * the inner script `exec`s the user's interactive shell, the new shell
 * inherits sh's stdin — if we used a pipeline, that stdin would be a
 * drained/closed pipe rather than the session PTY, causing the interactive
 * shell to read EOF and exit immediately (observed as the terminal
 * "disappearing" right after connect). With `sh -c`, sh's stdin stays the
 * PTY that ssh2 allocated via pty-req, so the user's shell reads from the
 * real terminal as expected.
 */
export function buildSshBootstrapCommand(): string {
  const bashRc = b64(getBashSshRcFile());
  const zshenv = b64(getZshEnvBootstrap());
  const zshScript = b64(getZshIntegrationScript());
  const fishScript = b64(getFishIntegrationScript());

  // POSIX sh. Any `exec` here replaces the `sh` process with the user's shell.
  const inner = [
    '# Termlnk SSH shell-integration bootstrap',
    'dir="${XDG_DATA_HOME:-$HOME/.local/share}/termlnk/si"',
    'mkdir -p "$dir/zdotdir" 2>/dev/null',
    '__tlk_w() {',
    '  # $1 = dest path, $2 = base64 payload',
    '  (printf %s "$2" | base64 -d 2>/dev/null || printf %s "$2" | base64 -D 2>/dev/null) > "$1"',
    '  chmod 600 "$1" 2>/dev/null || true',
    '}',
    `__tlk_w "$dir/bashrc" '${bashRc}'`,
    `__tlk_w "$dir/zdotdir/.zshenv" '${zshenv}'`,
    `__tlk_w "$dir/zdotdir/integration.zsh" '${zshScript}'`,
    `__tlk_w "$dir/fish.fish" '${fishScript}'`,
    '# Remote tmux: enable passthrough so OSC 633 reaches the terminal',
    'if [ -n "$TMUX" ]; then tmux set-option -g allow-passthrough on 2>/dev/null || true; fi',
    '__tlk_shell="${SHELL:-/bin/sh}"',
    'case "$__tlk_shell" in',
    '  */bash|bash) exec "$__tlk_shell" --rcfile "$dir/bashrc" -i ;;',
    '  */zsh|zsh)',
    '    export TERMLNK_ORIGINAL_ZDOTDIR="${ZDOTDIR:-$HOME}"',
    '    export ZDOTDIR="$dir/zdotdir"',
    '    exec "$__tlk_shell" -i',
    '    ;;',
    '  */fish|fish) exec "$__tlk_shell" -i -C "source $dir/fish.fish" ;;',
    '  *) exec "$__tlk_shell" -i ;;',
    'esac',
  ].join('\n');

  const outer = b64(inner);
  // The base64 alphabet is [A-Za-z0-9+/=] — no quote or whitespace characters
  // — so embedding it as a bare arg to printf is safe under any POSIX shell.
  // The outer single-quoted string is the sh script; it does not contain any
  // single quotes itself, so it passes through the user's login shell intact.
  return `sh -c 'eval "$(printf %s ${outer} | base64 -d 2>/dev/null || printf %s ${outer} | base64 -D 2>/dev/null)"'`;
}

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}
