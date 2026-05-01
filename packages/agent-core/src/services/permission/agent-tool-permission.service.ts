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

import type {
  IAgentToolPermissionRequest,
  IAgentToolPermissionResponse,
  IAgentToolPermissionService,
  IGuardInput,
  IGuardResult,
  IPermissionRuleService,
  IRiskAssessmentService,
  ToolPermissionMode,
  ToolRiskLevel,
} from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { AGENT_PLUGIN_CONFIG_KEY, IPermissionRuleService as IPermissionRuleServiceId, IRiskAssessmentService as IRiskAssessmentServiceId } from '@termlnk/agent';
import { Disposable, generateRandomId, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { BehaviorSubject } from 'rxjs';

const PERMISSION_MODE_FIELD = 'permissionMode';

interface IPendingResolver {
  resolve: (result: IGuardResult) => void;
  abortHandler?: () => void;
  signal?: AbortSignal;
}

export class AgentToolPermissionService extends Disposable implements IAgentToolPermissionService {
  private readonly _mode$ = new BehaviorSubject<ToolPermissionMode>('default');
  readonly mode$: Observable<ToolPermissionMode> = this._mode$.asObservable();

  private readonly _pendingRequests$ = new BehaviorSubject<IAgentToolPermissionRequest[]>([]);
  readonly pendingRequests$: Observable<IAgentToolPermissionRequest[]> = this._pendingRequests$.asObservable();

  private readonly _pendingResolvers = new Map<string, IPendingResolver>();

  constructor(
    @Inject(IPermissionRuleServiceId) private readonly _ruleService: IPermissionRuleService,
    @Inject(IRiskAssessmentServiceId) private readonly _riskService: IRiskAssessmentService,
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @ILogServiceId private readonly _logService: ILogService
  ) {
    super();
    void this._loadModeFromConfig();
  }

  getMode(): ToolPermissionMode {
    return this._mode$.getValue();
  }

  setMode(mode: ToolPermissionMode): void {
    if (mode === this._mode$.getValue()) {
      return;
    }
    this._mode$.next(mode);
    void this._configRepo.setField(AGENT_PLUGIN_CONFIG_KEY, PERMISSION_MODE_FIELD, mode);
    this._logService.log('[AgentToolPermissionService]', `mode → ${mode}`);
  }

  async guard(input: IGuardInput): Promise<IGuardResult> {
    // D1 — User-initiated invokes bypass approval.
    if (input.userInitiated) {
      return { decision: 'allow', via: 'user' };
    }

    // Pre-aborted signal short-circuits.
    if (input.signal?.aborted) {
      return { decision: 'deny', via: 'user', reason: 'Aborted before guard' };
    }

    const mode = this._mode$.getValue();

    // Plan-mode: deny non-readOnly tools regardless of rules.
    if (
      mode === 'plan'
      && !this._riskService.isReadOnly(input.toolName, input.toolCategory, input.metadata)
    ) {
      return { decision: 'deny', via: 'plan-mode', reason: 'plan-mode' };
    }

    // Rule matching takes precedence over mode (openclaude convention).
    const rule = this._ruleService.match(input.toolName, input.input, input.sessionId);
    if (rule) {
      if (rule.decision === 'allow') {
        return { decision: 'allow', via: 'rule', rule };
      }
      const ruleLabel = rule.pattern ? `${rule.toolName}(${rule.pattern})` : rule.toolName;
      return { decision: 'deny', via: 'rule', reason: `Denied by rule: ${ruleLabel}` };
    }

    // Risk evaluation + mode×risk matrix.
    const risk = this._riskService.assess(
      input.toolName,
      input.input,
      input.toolCategory,
      input.metadata
    );
    const action = decideByMatrix(mode, risk.level);
    if (action === 'allow') {
      return { decision: 'allow', via: 'mode' };
    }
    if (action === 'deny') {
      return { decision: 'deny', via: 'mode', reason: `Denied by mode: ${mode}` };
    }

    // ask → push request and wait for user response.
    return this._waitForUserDecision(input, risk);
  }

  respond(response: IAgentToolPermissionResponse): void {
    const resolver = this._pendingResolvers.get(response.requestId);
    if (!resolver) {
      this._logService.warn('[AgentToolPermissionService]', `No pending request: ${response.requestId}`);
      return;
    }

    this._cleanup(response.requestId, resolver);
    const current = this._pendingRequests$.getValue();
    const request = current.find((r) => r.id === response.requestId);
    this._pendingRequests$.next(current.filter((r) => r.id !== response.requestId));

    // Persist rule when scope is user/session.
    if (response.rule && response.scope !== 'once') {
      if (response.scope === 'user') {
        void this._ruleService.addUserRule(response.rule);
      }
      else if (response.scope === 'session' && request) {
        this._ruleService.addSessionRule(request.sessionId, response.rule);
      }
    }

    if (response.decision === 'allow') {
      resolver.resolve({
        decision: 'allow',
        via: 'user',
        updatedInput: response.updatedInput,
      });
    }
    else {
      resolver.resolve({
        decision: 'deny',
        via: 'user',
        reason: 'Denied by user',
      });
    }

    this._logService.log(
      '[AgentToolPermissionService]',
      `Request ${response.requestId} → ${response.decision} (scope=${response.scope})`
    );
  }

  clearSessionRules(sessionId: string): void {
    this._ruleService.clearSessionRules(sessionId);
  }

  private async _waitForUserDecision(input: IGuardInput, risk: ReturnType<IRiskAssessmentService['assess']>): Promise<IGuardResult> {
    const request: IAgentToolPermissionRequest = {
      id: generateRandomId(),
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      toolDisplayName: input.metadata?.toolDisplayName,
      toolCategory: input.toolCategory,
      input: input.input,
      highlight: risk.highlight,
      riskLevel: risk.level,
      reason: risk.reason,
      suggestedRules: this._riskService.generateSuggestedRules(
        input.toolName,
        input.input,
        input.toolCategory
      ),
      decisionReason: {
        type: 'mode',
        modeMatrix: { mode: this._mode$.getValue(), risk: risk.level },
      },
      createdAt: Date.now(),
    };

    return new Promise<IGuardResult>((resolve) => {
      const resolver: IPendingResolver = { resolve };
      if (input.signal) {
        const handler = (): void => {
          this._cleanup(request.id, resolver);
          this._pendingRequests$.next(
            this._pendingRequests$.getValue().filter((r) => r.id !== request.id)
          );
          resolve({ decision: 'deny', via: 'user', reason: 'Aborted by user' });
        };
        resolver.signal = input.signal;
        resolver.abortHandler = handler;
        input.signal.addEventListener('abort', handler, { once: true });
      }

      this._pendingResolvers.set(request.id, resolver);
      this._pendingRequests$.next([...this._pendingRequests$.getValue(), request]);

      this._logService.log(
        '[AgentToolPermissionService]',
        `Pending approval: ${input.toolName} risk=${risk.level} (id=${request.id})`
      );
    });
  }

  private _cleanup(requestId: string, resolver: IPendingResolver): void {
    if (resolver.signal && resolver.abortHandler) {
      resolver.signal.removeEventListener('abort', resolver.abortHandler);
    }
    this._pendingResolvers.delete(requestId);
  }

  private async _loadModeFromConfig(): Promise<void> {
    try {
      const stored = await this._configRepo.getField<ToolPermissionMode>(
        AGENT_PLUGIN_CONFIG_KEY,
        PERMISSION_MODE_FIELD
      );
      if (stored && isValidMode(stored)) {
        this._mode$.next(stored);
      }
    }
    catch (err) {
      this._logService.error('[AgentToolPermissionService]', `Failed to load mode: ${err}`);
    }
  }

  override dispose(): void {
    // Resolve outstanding requests as denied so callers don't hang.
    for (const [, resolver] of this._pendingResolvers) {
      if (resolver.signal && resolver.abortHandler) {
        resolver.signal.removeEventListener('abort', resolver.abortHandler);
      }
      resolver.resolve({ decision: 'deny', via: 'user', reason: 'Service disposed' });
    }
    this._pendingResolvers.clear();
    this._pendingRequests$.next([]);
    this._mode$.complete();
    this._pendingRequests$.complete();
    super.dispose();
  }
}

function decideByMatrix(mode: ToolPermissionMode, risk: ToolRiskLevel): 'allow' | 'deny' | 'ask' {
  switch (mode) {
    case 'auto':
      return risk === 'dangerous' ? 'ask' : 'allow';
    case 'default':
      return risk === 'safe' ? 'allow' : 'ask';
    case 'strict':
      return 'ask';
    case 'plan':
      // Plan-mode read-only tools reach here; they auto-allow.
      return 'allow';
    default:
      return 'ask';
  }
}

function isValidMode(value: unknown): value is ToolPermissionMode {
  return value === 'default' || value === 'auto' || value === 'strict' || value === 'plan';
}
