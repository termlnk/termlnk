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

import type { ITerminalSuggestConfig, ITerminalSuggestion, ITerminalSuggestionPhaseEvent, ITerminalSuggestService, TerminalSuggestionKind } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import type { ICommandBlockService } from '../shell-integration/command-block.service';
import { AGENT_PLUGIN_CONFIG_KEY, DEFAULT_TERMINAL_SUGGEST_CONFIG, ILLMProviderService } from '@termlnk/agent';
import { IConfigService, ILogService, RxDisposable } from '@termlnk/core';
import { ISSHSessionService, ITerminalSessionNotifyService } from '@termlnk/rpc';
import { IPTYSessionService } from '@termlnk/terminal';
import { filter, Subject, takeUntil } from 'rxjs';
import { ICommandBlockService as ICommandBlockServiceId } from '../shell-integration/command-block.service';

/**
 * Exit codes that should NOT trigger an automatic error-fix suggestion.
 * Most are signal terminations (Ctrl+C, kill, SIGTERM) where the user already
 * knows what happened.
 */
const IGNORED_EXIT_CODES = new Set<number>([
  0, // success
  130, // 128 + SIGINT (Ctrl+C)
  131, // SIGQUIT
  137, // SIGKILL
  141, // SIGPIPE
  143, // SIGTERM
  148, // SIGTSTP (Ctrl+Z)
]);

/**
 * Commands the user is unlikely to want a "fix" for: help flags, empty,
 * known-friendly errors. Conservative — only filter the most obvious noise.
 */
function shouldSkipErrorFix(commandLine: string): boolean {
  const cmd = commandLine.trim();
  if (!cmd) {
    return true;
  }
  if (/(?:^|\s)(?:-h|--help)(?:\s|$)/.test(cmd)) {
    return true;
  }
  return false;
}

/** Patterns whose match means "do not auto-execute, never append \r". */
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*\s+)?(?:-[a-zA-Z]*f[a-zA-Z]*\s+)?\//,
  /\brm\s+-rf?\s+/,
  /\bdd\s+.*\bof=\/dev\//,
  /\bmkfs(?:\.[a-z0-9]+)?\s+/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bhalt\b/,
  /\bkill(?:all)?\s+-9\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-[a-zA-Z]*f/,
  /\bchmod\s+-R\s+/,
  /\bchown\s+-R\s+/,
  />\s*\/dev\/sd[a-z]/,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((re) => re.test(command));
}

/** Sanitize a single-line command: strip newlines/CR, trim, drop trailing semicolons. */
function sanitizeCommand(raw: string): string {
  return raw
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/;+\s*$/, '');
}

interface ISuggestionResponse {
  summary: string;
  command: string;
}

const ENV_ADAPTATION_RULE = 'Generate commands appropriate for the reported Remote OS / Shell / Distro. Pick the package manager and binaries that exist on that system (apt/yum/apk/pacman/brew/choco). If Remote OS is unknown, prefer commands that work cross-platform (POSIX) or suggest a detection step first.';

const NL_SYSTEM_PROMPT = [
  'You are a shell command assistant inside a terminal emulator.',
  'Given a natural-language request plus context (cwd, git branch, recent terminal output, target shell environment), produce ONE concrete shell command.',
  'Respond with EXACTLY one JSON object: {"summary": <one-sentence description, <= 72 chars, no parentheses>, "command": <single-line shell command>}.',
  'Output JSON only — no markdown, no code fences, no surrounding text.',
  ENV_ADAPTATION_RULE,
  'Do not use shell aliases (e.g. ll, gst). Spell out the underlying command.',
  'If you cannot produce a safe command, set "command" to an empty string and explain in summary.',
].join('\n');

const ERROR_FIX_SYSTEM_PROMPT = [
  'You are a shell debugging assistant inside a terminal emulator.',
  'Given a failed command, its non-zero exit code, recent output, and the target shell environment, suggest a single corrective shell command.',
  'Respond with EXACTLY one JSON object: {"summary": <one-sentence description, <= 72 chars, no parentheses>, "command": <single-line shell command>}.',
  'Output JSON only — no markdown, no code fences, no surrounding text.',
  ENV_ADAPTATION_RULE,
  'Prefer the smallest fix; do not chain unrelated cleanup.',
  'Do not include the original command verbatim unless the fix is to re-run it.',
  'If no safe fix exists, set "command" to an empty string and explain in summary.',
].join('\n');

const SUGGEST_MAX_TOKENS = 512;
const RECENT_OUTPUT_CHARS = 1500;

export class TerminalSuggestService extends RxDisposable implements ITerminalSuggestService {
  private readonly _suggestion$ = new Subject<ITerminalSuggestion>();
  readonly suggestion$: Observable<ITerminalSuggestion> = this._suggestion$.asObservable();

  private readonly _phase$ = new Subject<ITerminalSuggestionPhaseEvent>();
  readonly phase$: Observable<ITerminalSuggestionPhaseEvent> = this._phase$.asObservable();

  /** sessionId → 'ssh' | 'local' (so we can route writes correctly). */
  private readonly _sessionKinds = new Map<string, 'ssh' | 'local'>();

  /**
   * In-flight requests, keyed by sessionId+kind composite. A new query in the
   * same session aborts a prior in-flight NL2Cmd. Error-fix uses block seq
   * staleness instead.
   */
  private readonly _inflight = new Map<string, AbortController>();

  /**
   * Per-session counters for stable suggestion ids and for staleness-checking
   * error-fix injections against newer block starts.
   */
  private readonly _suggestSeq = new Map<string, number>();
  private readonly _latestBlockSeq = new Map<string, number>();

  /** Monotonic counter used to mint phase-event requestIds. */
  private _phaseRequestSeq = 0;

  /**
   * Most recent error-fix suggestion per session. Stored separately from
   * `suggestion$` so applyLastErrorFix() can re-fire the same command later
   * (matching Kaku's behavior — the suggestion stays valid until a fresh
   * error-fix supersedes it or the session closes).
   */
  private readonly _lastErrorFix = new Map<string, { command: string; summary: string; dangerous: boolean }>();

  constructor(
    @ICommandBlockServiceId private readonly _commandBlockService: ICommandBlockService,
    @ILLMProviderService private readonly _llmProviderService: ILLMProviderService,
    @IConfigService private readonly _configService: IConfigService,
    @ITerminalSessionNotifyService private readonly _sessionNotify: ITerminalSessionNotifyService,
    @ISSHSessionService private readonly _sshSessionService: ISSHSessionService,
    @IPTYSessionService private readonly _ptySessionService: IPTYSessionService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    // Track session kinds for write routing.
    this.disposeWithMe(
      this._sessionNotify.sessionCreated$.subscribe((event) => {
        this._sessionKinds.set(event.sessionId, event.type);
      })
    );

    this.disposeWithMe(
      this._sessionNotify.sessionClosed$.subscribe((event) => {
        this._sessionKinds.delete(event.sessionId);
        this._suggestSeq.delete(event.sessionId);
        this._latestBlockSeq.delete(event.sessionId);
        this._lastErrorFix.delete(event.sessionId);
        this._cancelInflightFor(event.sessionId);
      })
    );

    // Maintain latest block seq per session for error-fix staleness check.
    this.disposeWithMe(
      this._commandBlockService.blockStarted$.subscribe((event) => {
        // The tracker assigns seq to FINISHED blocks; pending ones have no seq
        // until they finalize. Use a session-local counter that strictly
        // increases across both started and finished, so we can detect
        // "a new block started after a failure but before injection".
        const next = (this._latestBlockSeq.get(event.sessionId) ?? 0) + 1;
        this._latestBlockSeq.set(event.sessionId, next);
      })
    );

    // NL2Cmd path.
    this.disposeWithMe(
      this._commandBlockService.query$
        .pipe(
          filter(() => this.getConfig().enabled && this.getConfig().naturalLanguageEnabled),
          takeUntil(this.dispose$)
        )
        .subscribe((event) => {
          this._handleNlQuery(event.sessionId, event.query).catch((err) => {
            this._logService.error('[TerminalSuggestService]', 'NL handler failed', err);
          });
        })
    );

    // Error-fix path.
    this.disposeWithMe(
      this._commandBlockService.blockFinished$
        .pipe(
          filter(() => this.getConfig().enabled && this.getConfig().errorAutoSuggest),
          filter((b) => !IGNORED_EXIT_CODES.has(b.exitCode)),
          filter((b) => !shouldSkipErrorFix(b.command)),
          takeUntil(this.dispose$)
        )
        .subscribe((block) => {
          const baselineSeq = this._latestBlockSeq.get(block.sessionId) ?? 0;
          this._handleErrorFix(block.sessionId, block.command, block.exitCode, block.output, baselineSeq).catch((err) => {
            this._logService.error('[TerminalSuggestService]', 'Error-fix handler failed', err);
          });
        })
    );
  }

  override dispose(): void {
    super.dispose();
    // Aborting in-flight controllers will let each handler reach its `finally`
    // and emit a `cleared` phase event for any active request, keeping
    // renderer-side state consistent up to the very end. We complete the
    // phase subject afterwards so those final events still get through.
    for (const ctrl of this._inflight.values()) {
      ctrl.abort();
    }
    this._inflight.clear();
    this._sessionKinds.clear();
    this._suggestSeq.clear();
    this._latestBlockSeq.clear();
    this._lastErrorFix.clear();
    this._suggestion$.complete();
    this._phase$.complete();
  }

  cancelInflight(sessionId: string): void {
    this._cancelInflightFor(sessionId);
  }

  applyLastErrorFix(sessionId: string): boolean {
    const fix = this._lastErrorFix.get(sessionId);
    if (!fix || !fix.command) {
      return false;
    }
    // \x15 (Ctrl+U) clears the readline buffer first so any partial typing
    // is wiped. For safe commands we append \n to auto-execute (Kaku does
    // the same — the user explicitly invoked Apply, so they intended to run
    // it). Dangerous commands are pasted without \n; the user must press
    // Enter themselves after reviewing.
    const payload = fix.dangerous ? `\x15${fix.command}` : `\x15${fix.command}\n`;
    void this._writeToSession(sessionId, payload).catch((err) => {
      this._logService.warn?.('[TerminalSuggestService]', `applyLastErrorFix write failed sessionId=${sessionId}`, err);
    });
    return true;
  }

  getConfig(): ITerminalSuggestConfig {
    const stored = this._configService.getConfig<{ terminalSuggest?: ITerminalSuggestConfig }>(AGENT_PLUGIN_CONFIG_KEY);
    return {
      ...DEFAULT_TERMINAL_SUGGEST_CONFIG,
      ...(stored?.terminalSuggest ?? {}),
    };
  }

  // ---------------------------------------------------------------------------
  // NL2Cmd
  // ---------------------------------------------------------------------------

  private async _handleNlQuery(sessionId: string, query: string): Promise<void> {
    // Supersede any prior NL request on the same session. The prior handler's
    // `finally` will emit its own `cleared` phase event with its own
    // requestId, so the renderer keeps its active set consistent.
    this._cancelInflightFor(sessionId, 'nl2cmd');

    const ctrl = new AbortController();
    this._inflight.set(this._inflightKey(sessionId, 'nl2cmd'), ctrl);
    const requestId = this._emitPhase(sessionId, 'nl2cmd', 'pending');

    try {
      const cwd = this._commandBlockService.getCurrentCwd(sessionId);
      const recentOutput = this._collectRecentOutput(sessionId);
      const userMsg = this._buildNlUserMessage(sessionId, query, cwd, recentOutput);

      const parsed = await this._invokeLlm(NL_SYSTEM_PROMPT, userMsg, ctrl.signal);
      if (!parsed) {
        return;
      }

      const command = sanitizeCommand(parsed.command);
      if (!command) {
        // Model declined to produce a command. Skip injection silently.
        this._emitSuggestion(sessionId, 'nl2cmd', '', parsed.summary, false, false);
        return;
      }

      const dangerous = isDangerous(command);
      const ok = await this._injectCommand(sessionId, command);
      this._emitSuggestion(sessionId, 'nl2cmd', command, parsed.summary, dangerous, ok);
    } finally {
      // Only delete if it's still our controller (not superseded).
      const key = this._inflightKey(sessionId, 'nl2cmd');
      if (this._inflight.get(key) === ctrl) {
        this._inflight.delete(key);
      }
      this._emitPhase(sessionId, 'nl2cmd', 'cleared', requestId);
    }
  }

  // ---------------------------------------------------------------------------
  // Error fix
  // ---------------------------------------------------------------------------

  private async _handleErrorFix(
    sessionId: string,
    failedCommand: string,
    exitCode: number,
    output: string,
    baselineBlockSeq: number
  ): Promise<void> {
    this._cancelInflightFor(sessionId, 'errorFix');

    const ctrl = new AbortController();
    this._inflight.set(this._inflightKey(sessionId, 'errorFix'), ctrl);
    const requestId = this._emitPhase(sessionId, 'errorFix', 'pending');

    try {
      const cwd = this._commandBlockService.getCurrentCwd(sessionId);
      const trimmedOutput = output.slice(-RECENT_OUTPUT_CHARS);
      const userMsg = this._buildErrorFixUserMessage(sessionId, failedCommand, exitCode, cwd, trimmedOutput);

      const parsed = await this._invokeLlm(ERROR_FIX_SYSTEM_PROMPT, userMsg, ctrl.signal);
      if (!parsed) {
        return;
      }

      // Staleness check: if a new block has started since the failure, the
      // user has moved on — don't clobber their input line.
      const currentSeq = this._latestBlockSeq.get(sessionId) ?? 0;
      if (currentSeq > baselineBlockSeq) {
        this._logService.debug?.('[TerminalSuggestService]', `errorFix skipped: newer block started (sessionId=${sessionId})`);
        return;
      }

      const command = sanitizeCommand(parsed.command);
      if (!command) {
        this._emitSuggestion(sessionId, 'errorFix', '', parsed.summary, false, false);
        return;
      }

      // Error-fix path is asynchronous and not user-initiated — the user may
      // already be typing the next command. Unlike NL2Cmd we do NOT clobber
      // the input line. Instead store the suggestion as "last fix" for this
      // session and surface a notice in the terminal display via the
      // renderer (it subscribes to suggestion$). The user explicitly applies
      // it later via the keyboard shortcut, which calls applyLastErrorFix().
      const dangerous = isDangerous(command);
      this._lastErrorFix.set(sessionId, { command, summary: parsed.summary, dangerous });
      this._emitSuggestion(sessionId, 'errorFix', command, parsed.summary, dangerous, false);

      // Force a fresh prompt below the notice card the renderer is about to
      // draw, so the user's old prompt line stays untouched while a new
      // input-ready prompt appears beneath the suggestion. Mirrors Kaku's
      // `pane:send_text("\n")` after `inject_output`.
      await this._writeForceNewPrompt(sessionId);
    } finally {
      const key = this._inflightKey(sessionId, 'errorFix');
      if (this._inflight.get(key) === ctrl) {
        this._inflight.delete(key);
      }
      this._emitPhase(sessionId, 'errorFix', 'cleared', requestId);
    }
  }

  // ---------------------------------------------------------------------------
  // LLM invocation
  // ---------------------------------------------------------------------------

  private async _invokeLlm(systemPrompt: string, userMessage: string, signal: AbortSignal): Promise<ISuggestionResponse | null> {
    const resolved = this._resolveSuggestModel();
    if (!resolved) {
      this._logService.warn?.('[TerminalSuggestService]', 'no model configured; skipping suggestion');
      return null;
    }

    const { model, apiKey } = resolved;

    try {
      const result = await this._llmProviderService.completeSimple(
        model,
        {
          systemPrompt,
          messages: [{ role: 'user', content: userMessage, timestamp: Date.now() }],
        },
        {
          maxTokens: SUGGEST_MAX_TOKENS,
          temperature: 0.2,
          apiKey,
          signal,
        }
      );

      // Defensive abort check: pi-ai aborts via fetch's AbortController and
      // typically rejects the promise (caught below), but a stream that has
      // already buffered all bytes can resolve with stopReason === 'aborted'.
      // We also guard against `signal.aborted` flipping true during the await
      // for transports that don't surface abortion as a rejection.
      if (signal.aborted || result.stopReason === 'aborted') {
        return null;
      }

      const text = result.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('');

      return parseSuggestionJson(text);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return null;
      }
      this._logService.error('[TerminalSuggestService]', 'LLM call failed', err);
      return null;
    }
  }

  private _resolveSuggestModel(): { model: NonNullable<ReturnType<ILLMProviderService['resolveModel']>>; apiKey?: string } | null {
    const cfg = this.getConfig();

    let providerId: string | null = null;
    let modelId: string | null = null;

    if (cfg.suggestModelId) {
      const slash = cfg.suggestModelId.indexOf('/');
      if (slash > 0) {
        providerId = cfg.suggestModelId.slice(0, slash);
        modelId = cfg.suggestModelId.slice(slash + 1);
      }
    }

    if (!providerId || !modelId) {
      const active = this._llmProviderService.getActiveModel();
      if (!active) {
        return null;
      }
      providerId = active.providerId;
      const slash = active.id.indexOf('/');
      modelId = slash > 0 ? active.id.slice(slash + 1) : active.id;
    }

    const model = this._llmProviderService.resolveModel(providerId, modelId);
    if (!model) {
      return null;
    }

    const providerConfig = this._llmProviderService.getProviderConfig(providerId);
    return { model, apiKey: providerConfig?.apiKey };
  }

  // ---------------------------------------------------------------------------
  // Injection
  // ---------------------------------------------------------------------------

  /**
   * Used by the NL2Cmd path to clobber the user's prompt with the AI command.
   * Prepends \x15 (Ctrl+U) so any partial input is wiped first; never
   * appends \r — Enter is the user's responsibility.
   */
  private async _injectCommand(sessionId: string, command: string): Promise<boolean> {
    return this._writeToSession(sessionId, `\x15${command}`);
  }

  /**
   * Send a single \n to the session's PTY. The shell sees Enter on an empty
   * BUFFER (no command) and prints a fresh prompt below. Used by the
   * error-fix path to push a new prompt under the notice card so the user's
   * old prompt is "abandoned" and a clean one appears for input.
   *
   * Returns when the write completes — important for ordering (we want the
   * suggestion event to reach the renderer first; the PTY round-trip
   * ensures the new prompt arrives later via data$).
   */
  private async _writeForceNewPrompt(sessionId: string): Promise<void> {
    await this._writeToSession(sessionId, '\n');
  }

  /**
   * Route a write to the right backend (SSH vs local PTY) using the kind
   * we tracked from sessionCreated$. If the kind is unknown for some reason,
   * try SSH first, then local — either may throw, the caller gets `false`.
   */
  private async _writeToSession(sessionId: string, data: string): Promise<boolean> {
    const kind = this._sessionKinds.get(sessionId);
    try {
      if (kind === 'ssh') {
        await this._sshSessionService.write(sessionId, data);
      } else if (kind === 'local') {
        await this._ptySessionService.write(sessionId, data);
      } else {
        // Unknown kind — try SSH first, fall back to local PTY.
        try {
          await this._sshSessionService.write(sessionId, data);
        } catch {
          await this._ptySessionService.write(sessionId, data);
        }
      }
      return true;
    } catch (err) {
      this._logService.warn?.('[TerminalSuggestService]', `write failed for sessionId=${sessionId}`, err);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _emitSuggestion(
    sessionId: string,
    kind: TerminalSuggestionKind,
    command: string,
    summary: string,
    dangerous: boolean,
    injected: boolean
  ): void {
    const seq = (this._suggestSeq.get(sessionId) ?? 0) + 1;
    this._suggestSeq.set(sessionId, seq);

    const suggestion: ITerminalSuggestion = {
      id: `${sessionId}:${kind}:${seq}`,
      sessionId,
      kind,
      command,
      summary: (summary || '').slice(0, 200),
      dangerous,
      injected,
      createdAt: Date.now(),
    };
    this._suggestion$.next(suggestion);
  }

  /**
   * Emit a phase transition. When `requestId` is omitted, mints a fresh one
   * (used by `pending`); when given, reuses it (used by the matching
   * `cleared` in the handler's finally block). Returns the requestId so
   * callers can chain pending → cleared without book-keeping.
   */
  private _emitPhase(
    sessionId: string,
    kind: TerminalSuggestionKind,
    phase: 'pending' | 'cleared',
    requestId?: string
  ): string {
    const id = requestId ?? `${sessionId}:${kind}:${++this._phaseRequestSeq}`;
    this._phase$.next({ sessionId, kind, phase, requestId: id, at: Date.now() });
    return id;
  }

  private _collectRecentOutput(sessionId: string): string {
    const blocks = this._commandBlockService.getBlocks(sessionId);
    if (blocks.length === 0) {
      return '';
    }
    // Concatenate the last few blocks' commands + outputs, capped by char count.
    const parts: string[] = [];
    let remaining = RECENT_OUTPUT_CHARS;
    for (let i = blocks.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const b = blocks[i];
      const piece = `$ ${b.command}\n${b.output}`.slice(0, remaining);
      parts.unshift(piece);
      remaining -= piece.length;
    }
    return parts.join('\n');
  }

  private _buildEnvLines(sessionId: string): string[] {
    const env = this._commandBlockService.getRawEnv(sessionId);
    const kind = this._sessionKinds.get(sessionId) ?? 'unknown';
    const lines = [`Session kind: ${kind}`];
    if (env.remoteOS) {
      lines.push(`Remote OS: ${env.remoteOS}`);
    }
    if (env.remoteShell) {
      lines.push(`Remote shell: ${env.remoteShell}`);
    }
    if (env.remoteDistro) {
      lines.push(`Remote distro: ${env.remoteDistro}`);
    }
    return lines;
  }

  private _buildNlUserMessage(sessionId: string, query: string, cwd: string, recentOutput: string): string {
    const lines = [
      `Request: ${query}`,
      ...this._buildEnvLines(sessionId),
      `Working directory: ${cwd || '(unknown)'}`,
    ];
    if (recentOutput) {
      lines.push('', 'Recent terminal output:', recentOutput);
    }
    return lines.join('\n');
  }

  private _buildErrorFixUserMessage(sessionId: string, failed: string, exitCode: number, cwd: string, recentOutput: string): string {
    const lines = [
      `Failed command: ${failed}`,
      `Exit code: ${exitCode}`,
      ...this._buildEnvLines(sessionId),
      `Working directory: ${cwd || '(unknown)'}`,
    ];
    if (recentOutput) {
      lines.push('', 'Recent output (truncated):', recentOutput);
    }
    return lines.join('\n');
  }

  private _inflightKey(sessionId: string, kind: TerminalSuggestionKind): string {
    return `${sessionId}:${kind}`;
  }

  private _cancelInflightFor(sessionId: string, kind?: TerminalSuggestionKind): void {
    if (kind) {
      const key = this._inflightKey(sessionId, kind);
      this._inflight.get(key)?.abort();
      this._inflight.delete(key);
      return;
    }
    for (const k of ['nl2cmd', 'errorFix'] as TerminalSuggestionKind[]) {
      const key = this._inflightKey(sessionId, k);
      this._inflight.get(key)?.abort();
      this._inflight.delete(key);
    }
  }
}

/**
 * Parse a JSON suggestion response. Tolerates code fences and leading prose;
 * extracts the first balanced `{...}` block and validates required fields.
 */
function parseSuggestionJson(text: string): ISuggestionResponse | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // Strip code fence wrappers if the model added them despite instructions.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  const json = candidate.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  const summary = typeof obj.summary === 'string' ? obj.summary : '';
  const command = typeof obj.command === 'string' ? obj.command : '';
  return { summary, command };
}
