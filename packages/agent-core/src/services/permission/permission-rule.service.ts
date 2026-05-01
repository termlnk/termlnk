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
  IPermissionRule,
  IPermissionRuleInput,
  IPermissionRuleService,
  IShadowedRule,
  ToolPermissionScope,
} from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { AGENT_PLUGIN_CONFIG_KEY, matchRule } from '@termlnk/agent';
import { Disposable, generateRandomId, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { BehaviorSubject, combineLatest, map, shareReplay, Subject } from 'rxjs';

const PERMISSION_RULES_FIELD = 'permissionRules';

export class PermissionRuleService extends Disposable implements IPermissionRuleService {
  private readonly _userRules$ = new BehaviorSubject<IPermissionRule[]>([]);
  private readonly _sessionRulesChanged$ = new Subject<void>();
  /** sessionId → rules. Memory only, no persistence. */
  private readonly _sessionRules = new Map<string, IPermissionRule[]>();

  readonly rules$: Observable<IPermissionRule[]> = combineLatest([
    this._userRules$,
    this._sessionRulesChanged$,
  ]).pipe(
    map(([user]) => [...user, ...this._allSessionRules()]),
    shareReplay(1),
  );

  constructor(
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @ILogServiceId private readonly _logService: ILogService
  ) {
    super();
    void this._loadUserRules();
    this._watchExternalChanges();
    // Prime the combineLatest gate so subscribers receive the initial empty state.
    this._sessionRulesChanged$.next();
  }

  match(toolName: string, input: unknown, sessionId: string): IPermissionRule | null {
    const userRules = this._userRules$.getValue();
    const sessionRules = this._sessionRules.get(sessionId) ?? [];

    // Priority: user-deny > session-deny > user-allow > session-allow.
    return this._findMatch(userRules, 'deny', toolName, input)
      ?? this._findMatch(sessionRules, 'deny', toolName, input)
      ?? this._findMatch(userRules, 'allow', toolName, input)
      ?? this._findMatch(sessionRules, 'allow', toolName, input);
  }

  async addUserRule(input: Omit<IPermissionRuleInput, 'scope'>): Promise<IPermissionRule> {
    const rule: IPermissionRule = {
      ...input,
      id: generateRandomId(),
      scope: 'user',
      createdAt: Date.now(),
    };
    const next = [...this._userRules$.getValue(), rule];
    this._userRules$.next(next);
    await this._persistUserRules(next);
    this._logService.log('[PermissionRuleService]', `Added user rule: ${rule.toolName} ${rule.pattern ?? '(tool-wide)'}`);
    return rule;
  }

  addSessionRule(sessionId: string, input: Omit<IPermissionRuleInput, 'scope'>): IPermissionRule {
    const rule: IPermissionRule = {
      ...input,
      id: generateRandomId(),
      scope: 'session',
      createdAt: Date.now(),
    };
    const existing = this._sessionRules.get(sessionId) ?? [];
    this._sessionRules.set(sessionId, [...existing, rule]);
    this._sessionRulesChanged$.next();
    return rule;
  }

  async removeRule(ruleId: string): Promise<void> {
    // Try user rules first.
    const userRules = this._userRules$.getValue();
    const userIdx = userRules.findIndex((r) => r.id === ruleId);
    if (userIdx >= 0) {
      const next = userRules.filter((r) => r.id !== ruleId);
      this._userRules$.next(next);
      await this._persistUserRules(next);
      return;
    }
    // Otherwise scan session maps.
    for (const [sessionId, rules] of this._sessionRules) {
      const idx = rules.findIndex((r) => r.id === ruleId);
      if (idx >= 0) {
        this._sessionRules.set(sessionId, rules.filter((r) => r.id !== ruleId));
        this._sessionRulesChanged$.next();
        return;
      }
    }
  }

  listRules(scope?: ToolPermissionScope): IPermissionRule[] {
    if (scope === 'user') {
      return [...this._userRules$.getValue()];
    }
    if (scope === 'session') {
      return this._allSessionRules();
    }
    return [...this._userRules$.getValue(), ...this._allSessionRules()];
  }

  clearSessionRules(sessionId: string): void {
    if (this._sessionRules.delete(sessionId)) {
      this._sessionRulesChanged$.next();
    }
  }

  detectShadowedRules(): IShadowedRule[] {
    const all = [...this._userRules$.getValue(), ...this._allSessionRules()];
    const out: IShadowedRule[] = [];
    for (const r of all) {
      if (!r.pattern) {
        continue;
      }
      const broader = all.find((other) => other !== r
        && other.toolName === r.toolName
        && !other.pattern
        && other.scope === r.scope);
      if (broader) {
        out.push({
          rule: r,
          shadowedBy: broader,
          reason: broader.decision === 'deny' ? 'tool-level-deny' : 'tool-level-allow',
        });
      }
    }
    return out;
  }

  private _findMatch(
    rules: IPermissionRule[],
    decision: 'allow' | 'deny',
    toolName: string,
    input: unknown
  ): IPermissionRule | null {
    return rules.find((r) => r.decision === decision && matchRule(r, toolName, input)) ?? null;
  }

  private _allSessionRules(): IPermissionRule[] {
    return [...this._sessionRules.values()].flat();
  }

  private async _loadUserRules(): Promise<void> {
    try {
      const stored = await this._configRepo.getField<IPermissionRule[]>(
        AGENT_PLUGIN_CONFIG_KEY,
        PERMISSION_RULES_FIELD
      );
      if (Array.isArray(stored)) {
        this._userRules$.next(stored);
      }
    }
    catch (err) {
      this._logService.error('[PermissionRuleService]', `Failed to load user rules: ${err}`);
    }
  }

  private async _persistUserRules(rules: IPermissionRule[]): Promise<void> {
    try {
      await this._configRepo.setField(AGENT_PLUGIN_CONFIG_KEY, PERMISSION_RULES_FIELD, rules);
    }
    catch (err) {
      this._logService.error('[PermissionRuleService]', `Failed to persist user rules: ${err}`);
    }
  }

  private _watchExternalChanges(): void {
    this.disposeWithMe(
      this._configRepo.changed$.subscribe((event) => {
        if (event.key !== AGENT_PLUGIN_CONFIG_KEY) {
          return;
        }
        if (event.subKey !== undefined && event.subKey !== PERMISSION_RULES_FIELD) {
          return;
        }
        // Reload if either the whole key or our subKey changed externally.
        void this._loadUserRules();
      })
    );
  }

  override dispose(): void {
    this._userRules$.complete();
    this._sessionRulesChanged$.complete();
    this._sessionRules.clear();
    super.dispose();
  }
}
