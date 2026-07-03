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
    // Cache remote env once so precmd does not fork on every prompt.
    // `. /etc/os-release` runs in a subshell — it does not leak vars.
    '__termlnk_os="$(uname -s 2>/dev/null)"',
    '__termlnk_shell="zsh"',
    'if [ -r /etc/os-release ]; then',
    "  __termlnk_distro=\"$(. /etc/os-release 2>/dev/null && printf '%s' \"$ID\")\"",
    'else',
    '  __termlnk_distro=""',
    'fi',
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
    "  printf '\\e]633;P;RemoteOS=%s\\a' \"$__termlnk_os\"",
    "  printf '\\e]633;P;RemoteShell=%s\\a' \"$__termlnk_shell\"",
    "  printf '\\e]633;P;RemoteDistro=%s\\a' \"$__termlnk_distro\"",
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
    // ----------------------------------------------------------------------
    // Natural-language query interception (`# <query>` → OSC 633;Q;<base64>).
    //
    // Zsh treats `#` as a comment so the query never reaches the shell as a
    // real command. We wrap `accept-line` instead. Registration is deferred
    // to the first prompt so it runs AFTER plugins like zsh-autosuggestions
    // have set up their own wrappers.
    //
    // BUFFER is intentionally NOT cleared after dispatch:
    //   - The user's `# query` text stays visible while the host calls the
    //     LLM, which gives the renderer-side spinner a stable column to
    //     paint at and lets the user re-read what they asked.
    //   - When the suggestion arrives, the host writes `\x15<command>` to
    //     PTY stdin; `\x15` (Ctrl+U) tells ZLE to kill the line, which
    //     replaces BUFFER cleanly.
    //   - `__termlnk_nl_waiting` blocks duplicate dispatch when the user
    //     mashes Enter; it auto-resets after 30 s (LLM stuck) or on the
    //     next precmd (shell finished a real command, anything inflight
    //     no longer matters). User typing other characters also clears it,
    //     so the next Enter goes through .accept-line normally.
    //
    // For non-`#` lines we delegate to the builtin `.accept-line`. Any prior
    // accept-line wrapper (e.g. zsh-autosuggestions cleanup) is bypassed —
    // autosuggestions still tracks state via its zle-line-init and
    // zle-line-finish hooks, which are unaffected.
    //
    // Disabled by exporting TERMLNK_NL_DISABLE=1 in user rc.
    // ----------------------------------------------------------------------
    '__termlnk_nl_emit() {',
    '  local q="$1"',
    '  if (( $+commands[base64] )); then',
    '    local enc',
    "    enc=$(printf '%s' \"$q\" | base64 | tr -d '\\n')",
    "    printf '\\e]633;Q;%s\\a' \"$enc\"",
    '  fi',
    '}',
    '',
    '# Load $EPOCHSECONDS (used for the 30 s waiting timeout). zmodload is',
    '# idempotent, so re-running the integration is harmless.',
    'zmodload -F zsh/datetime p:EPOCHSECONDS 2>/dev/null',
    'typeset -gi __termlnk_nl_waiting=0',
    'typeset -gi __termlnk_nl_waiting_ts=0',
    'typeset -gi __termlnk_nl_waiting_cur=0',
    'typeset -g  __termlnk_nl_waiting_buf=""',
    '__termlnk_nl_reset_waiting() { __termlnk_nl_waiting=0; }',
    'add-zsh-hook precmd __termlnk_nl_reset_waiting',
    '',
    '__termlnk_nl_accept_line() {',
    '  # Decide whether the prior dispatch is still the active one. If the',
    '  # user has typed/deleted (BUFFER changed), moved the cursor (CURSOR',
    '  # changed), or 30 s have elapsed, the prior request is considered',
    '  # stale (renderer has likely already cancelled it via the host) and',
    '  # the next Enter falls through to a fresh dispatch.',
    '  if (( __termlnk_nl_waiting )); then',
    '    local now=$EPOCHSECONDS',
    '    local stale=0',
    '    (( now - __termlnk_nl_waiting_ts > 30 )) && stale=1',
    '    [[ "$BUFFER" != "$__termlnk_nl_waiting_buf" ]] && stale=1',
    '    (( CURSOR != __termlnk_nl_waiting_cur )) && stale=1',
    '    if (( stale )); then',
    '      __termlnk_nl_waiting=0',
    '    else',
    '      return',
    '    fi',
    '  fi',
    '  if [[ -z "${TERMLNK_NL_DISABLE:-}" && -n "$BUFFER" && "${BUFFER[1]}" == "#" && "$BUFFER" != *$\'\\n\'* ]]; then',
    '    local query="${BUFFER:1}"',
    '    query="${query# }"',
    '    if [[ -n "$query" ]]; then',
    '      print -s -- "$BUFFER"',
    '      __termlnk_nl_emit "$query"',
    '      __termlnk_nl_waiting=1',
    '      __termlnk_nl_waiting_ts=$EPOCHSECONDS',
    '      __termlnk_nl_waiting_buf="$BUFFER"',
    '      __termlnk_nl_waiting_cur=$CURSOR',
    '      return',
    '    fi',
    '  fi',
    '  zle .accept-line',
    '}',
    '',
    '# Register the widget synchronously. integration.zsh is itself sourced',
    '# from the first precmd (via __termlnk_si_init in our zdotdir/.zshenv),',
    '# so by this point the user .zshrc — including plugins that wrap',
    '# accept-line at load time, like zsh-autosuggestions — has already',
    '# finished. Deferring through another `add-zsh-hook precmd` would push',
    '# registration to the *next* prompt, which is too late for the very',
    '# first command the user types: their `# query` would just hit the',
    '# original (autosuggest-wrapped) accept-line and be treated as a',
    '# comment. Registering synchronously here makes the first Enter work.',
    'zle -N accept-line __termlnk_nl_accept_line',
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
    // Cache remote env once so precmd does not fork on every prompt.
    '__termlnk_os="$(uname -s 2>/dev/null)"',
    '__termlnk_shell="bash"',
    'if [ -r /etc/os-release ]; then',
    "  __termlnk_distro=\"$(. /etc/os-release 2>/dev/null && printf '%s' \"$ID\")\"",
    'else',
    '  __termlnk_distro=""',
    'fi',
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
    "  printf '\\e]633;P;RemoteOS=%s\\a' \"$__termlnk_os\"",
    "  printf '\\e]633;P;RemoteShell=%s\\a' \"$__termlnk_shell\"",
    "  printf '\\e]633;P;RemoteDistro=%s\\a' \"$__termlnk_distro\"",
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
    '# Cache remote env once so postexec does not fork on every prompt.',
    '# `sh -c` is needed because fish has no `.` builtin for /etc/os-release.',
    'set -g __termlnk_os (uname -s 2>/dev/null)',
    'set -g __termlnk_shell "fish"',
    'set -g __termlnk_distro (sh -c \'. /etc/os-release 2>/dev/null && printf "%s" "$ID"\' 2>/dev/null)',
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
    "  printf '\\e]633;P;RemoteOS=%s\\a' $__termlnk_os",
    "  printf '\\e]633;P;RemoteShell=%s\\a' $__termlnk_shell",
    "  printf '\\e]633;P;RemoteDistro=%s\\a' $__termlnk_distro",
    'end',
    '',
    '# Natural-language query interception (`# <query>` → OSC 633;Q;<base64>).',
    '# fish_preexec does NOT fire for comment-only lines, so we bind \\r and \\n',
    '# at the readline level. Disable by `set -gx TERMLNK_NL_DISABLE 1` in user rc.',
    '#',
    '# `commandline` is intentionally NOT cleared after dispatch: the user keeps',
    '# seeing their `# query` while the host calls the LLM, and the renderer',
    '# spinner has a stable column to paint at. The host writes \\x15<command>',
    '# when the suggestion arrives, which fish maps to backward-kill-line and',
    '# then inserts the command. `__termlnk_nl_waiting` blocks duplicate',
    '# dispatch within a 30 s window or until fish_prompt fires again.',
    'function __termlnk_nl_emit',
    '  if type -q base64',
    '    set -l enc (printf \'%s\' $argv[1] | base64 | tr -d \'\\n\')',
    "    printf '\\e]633;Q;%s\\a' $enc",
    '  end',
    'end',
    '',
    'set -g __termlnk_nl_waiting 0',
    'set -g __termlnk_nl_waiting_ts 0',
    'set -g __termlnk_nl_waiting_buf ""',
    'set -g __termlnk_nl_waiting_cur 0',
    'function __termlnk_nl_reset_waiting --on-event fish_prompt',
    '  set -g __termlnk_nl_waiting 0',
    'end',
    '',
    'function __termlnk_nl_execute',
    '  set -l buf (commandline)',
    '  set -l cur (commandline -C)',
    '  # Decide whether the prior dispatch is still the active one. If the',
    '  # user has typed/deleted (buf changed), moved the cursor (cur changed),',
    '  # or 30 s have elapsed, the prior request is considered stale (the',
    '  # renderer has likely already cancelled it via the host) and Enter',
    '  # falls through to a fresh dispatch.',
    '  if test "$__termlnk_nl_waiting" = "1"',
    '    set -l now (date +%s)',
    '    set -l stale 0',
    '    if test (math "$now - $__termlnk_nl_waiting_ts") -gt 30',
    '      set stale 1',
    '    end',
    '    if test "$buf" != "$__termlnk_nl_waiting_buf"',
    '      set stale 1',
    '    end',
    '    if test "$cur" -ne "$__termlnk_nl_waiting_cur"',
    '      set stale 1',
    '    end',
    '    if test "$stale" = "1"',
    '      set -g __termlnk_nl_waiting 0',
    '    else',
    '      return',
    '    end',
    '  end',
    '  if test -z "$TERMLNK_NL_DISABLE"; and string match -q -- \'#*\' $buf',
    '    set -l query (string sub -s 2 -- $buf)',
    '    set query (string trim -l -- $query)',
    '    if test -n "$query"',
    '      __termlnk_nl_emit $query',
    '      set -g __termlnk_nl_waiting 1',
    '      set -g __termlnk_nl_waiting_ts (date +%s)',
    '      set -g __termlnk_nl_waiting_buf "$buf"',
    '      set -g __termlnk_nl_waiting_cur "$cur"',
    '      return',
    '    end',
    '  end',
    '  commandline -f execute',
    'end',
    '',
    '# Bind in the active mode. Vi mode users can rebind manually if needed.',
    'bind \\r __termlnk_nl_execute 2>/dev/null',
    'bind \\n __termlnk_nl_execute 2>/dev/null',
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
