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
 * Shell integration configuration — controls OSC 633 auto-injection behavior
 * and heuristic fallback for AI agent command-block tracking.
 *
 * Written by the settings UI, read by rpc-server services (SSH session,
 * AI terminal tools). Persisted via ConfigRepository under the key
 * `SHELL_INTEGRATION_CONFIG_KEY`.
 */

export const SHELL_INTEGRATION_CONFIG_KEY = 'shellIntegration';

export interface ISSHShellIntegrationConfig {
  /**
   * If true, auto-inject OSC 633 hooks into remote shells on SSH session ready.
   * Affects bash/zsh on the remote host. Default: true.
   */
  autoInject: boolean;

  /**
   * If true, when shell integration is not active (unsupported shell, disabled,
   * or injection failed) the AI `termlnk_terminal_run` tool falls back to a
   * timeout-based heuristic (write + wait + ANSI-strip). Exit code is reported
   * as null in that mode. Default: true.
   */
  fallbackHeuristic: boolean;
}

export interface IShellIntegrationConfig {
  /**
   * Global switch:
   * - 'auto': behave as configured (sub-options below apply).
   * - 'disabled': never inject, never attach command tracker. AI tools fall
   *   back to the legacy byte-stream drain behavior of `termlnk_terminal_execute`
   *   + `termlnk_terminal_get_output`.
   * Default: 'auto'.
   */
  mode: 'auto' | 'disabled';

  ssh: ISSHShellIntegrationConfig;

  /**
   * Maximum bytes of raw output to retain per command block before truncating.
   * Applied inside CommandBlockTracker. Default: 524288 (512KB).
   */
  maxCommandOutputBytes: number;

  /**
   * If true, command blocks retain the raw (ANSI-laden) output in addition to
   * the cleaned output. Costs roughly 2–3x the memory per block. Default: false.
   */
  keepRawAnsi: boolean;
}

export const DEFAULT_SHELL_INTEGRATION_CONFIG: IShellIntegrationConfig = {
  mode: 'auto',
  ssh: {
    autoInject: true,
    fallbackHeuristic: true,
  },
  maxCommandOutputBytes: 524288,
  keepRawAnsi: false,
};

/** Merge persisted config (possibly partial / legacy) with safe defaults. */
export function normalizeShellIntegrationConfig(value: Partial<IShellIntegrationConfig> | null | undefined): IShellIntegrationConfig {
  if (!value) {
    return { ...DEFAULT_SHELL_INTEGRATION_CONFIG, ssh: { ...DEFAULT_SHELL_INTEGRATION_CONFIG.ssh } };
  }
  return {
    mode: value.mode === 'disabled' ? 'disabled' : 'auto',
    ssh: {
      autoInject: typeof value.ssh?.autoInject === 'boolean' ? value.ssh.autoInject : DEFAULT_SHELL_INTEGRATION_CONFIG.ssh.autoInject,
      fallbackHeuristic: typeof value.ssh?.fallbackHeuristic === 'boolean' ? value.ssh.fallbackHeuristic : DEFAULT_SHELL_INTEGRATION_CONFIG.ssh.fallbackHeuristic,
    },
    maxCommandOutputBytes: Number.isFinite(value.maxCommandOutputBytes) && (value.maxCommandOutputBytes ?? 0) > 0
      ? Number(value.maxCommandOutputBytes)
      : DEFAULT_SHELL_INTEGRATION_CONFIG.maxCommandOutputBytes,
    keepRawAnsi: typeof value.keepRawAnsi === 'boolean' ? value.keepRawAnsi : DEFAULT_SHELL_INTEGRATION_CONFIG.keepRawAnsi,
  };
}
