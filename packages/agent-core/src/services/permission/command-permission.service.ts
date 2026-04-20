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

import type { ICommandEvaluation, ICommandPermissionRequest, ICommandPermissionResponse, ICommandPermissionService, PermissionMode } from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { Disposable, generateRandomId, ILogService as ILogServiceId } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { evaluateCommandRisk } from '../../common/danger-patterns';

/** SSH-critical commands that require approval even in auto mode. */
const SSH_ALWAYS_APPROVE = /\b(shutdown|reboot|halt|init\s+0|poweroff)\b/i;

/** Max age for a cached decision (30 minutes). */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Max number of cached prefixes per session. */
const CACHE_MAX_ENTRIES = 100;

/**
 * Compound command leaders whose subcommand should be included
 * in the cache prefix (e.g., "git push", "docker rm", "sudo rm").
 */
const COMPOUND_LEADERS = new Set([
  'git',
  'docker',
  'kubectl',
  'sudo',
  'npm',
  'yarn',
  'pnpm',
  'systemctl',
  'apt',
  'brew',
  'pip',
]);

interface IPendingResolver {
  resolve: (decision: 'allow' | 'deny') => void;
}

interface ICacheEntry {
  decision: 'allow' | 'deny';
  timestamp: number;
}

export class CommandPermissionService extends Disposable implements ICommandPermissionService {
  private readonly _mode$ = new BehaviorSubject<PermissionMode>('default');
  readonly mode$: Observable<PermissionMode> = this._mode$.asObservable();

  private readonly _pendingRequests$ = new BehaviorSubject<ICommandPermissionRequest[]>([]);
  readonly pendingRequests$: Observable<ICommandPermissionRequest[]> = this._pendingRequests$.asObservable();

  /** Session-level decision cache: sessionId → commandPrefix → ICacheEntry */
  private readonly _sessionCache = new Map<string, Map<string, ICacheEntry>>();

  /** Pending approval resolvers: requestId → resolver */
  private readonly _pendingResolvers = new Map<string, IPendingResolver>();

  constructor(
    @ILogServiceId private readonly _logService: ILogService
  ) {
    super();
  }

  evaluateCommand(sessionId: string, command: string, sessionType?: 'ssh' | 'local'): ICommandEvaluation {
    const { level, reasons, suggestedAlternative } = evaluateCommandRisk(command);
    const mode = this._mode$.getValue();

    // Check session cache (with TTL)
    const cachedDecision = this._getCachedDecision(sessionId, command);
    if (cachedDecision) {
      return {
        riskLevel: level,
        allowed: cachedDecision === 'allow',
        requiresApproval: false,
        reason: reasons.join('; '),
        suggestedAlternative,
      };
    }

    // Evaluate based on mode
    switch (mode) {
      case 'default': {
        if (level === 'safe' || level === 'caution') {
          return { riskLevel: level, allowed: true, requiresApproval: false, reason: reasons.join('; '), suggestedAlternative };
        }
        // dangerous → requires approval
        return { riskLevel: level, allowed: false, requiresApproval: true, reason: reasons.join('; '), suggestedAlternative };
      }

      case 'auto': {
        // Auto mode: allow everything, but escalate dangerous commands in SSH sessions
        if (level === 'dangerous') {
          // SSH sessions: always require approval for critical commands
          if (sessionType === 'ssh' && SSH_ALWAYS_APPROVE.test(command)) {
            this._logService.warn('[CommandPermissionService]', `Auto-mode SSH escalation: ${command}`);
            return { riskLevel: level, allowed: false, requiresApproval: true, reason: reasons.join('; '), suggestedAlternative };
          }
          this._logService.warn('[CommandPermissionService]', `Auto-mode: allowing dangerous command: ${command}`);
        }
        return { riskLevel: level, allowed: true, requiresApproval: false, reason: reasons.join('; '), suggestedAlternative };
      }

      case 'strict': {
        if (level === 'safe') {
          return { riskLevel: level, allowed: true, requiresApproval: false };
        }
        // caution AND dangerous → requires approval
        return { riskLevel: level, allowed: false, requiresApproval: true, reason: reasons.join('; '), suggestedAlternative };
      }

      default: {
        return { riskLevel: level, allowed: true, requiresApproval: false };
      }
    }
  }

  async requestApproval(request: Omit<ICommandPermissionRequest, 'id' | 'timestamp'>): Promise<'allow' | 'deny'> {
    const fullRequest: ICommandPermissionRequest = {
      ...request,
      id: generateRandomId(),
      timestamp: Date.now(),
    };

    return new Promise<'allow' | 'deny'>((resolve) => {
      this._pendingResolvers.set(fullRequest.id, { resolve });

      const current = this._pendingRequests$.getValue();
      this._pendingRequests$.next([...current, fullRequest]);

      this._logService.log('[CommandPermissionService]', `Approval requested for: ${request.command} (${request.riskLevel})`);
    });
  }

  respondToRequest(response: ICommandPermissionResponse): void {
    const resolver = this._pendingResolvers.get(response.requestId);
    if (!resolver) {
      this._logService.warn('[CommandPermissionService]', `No pending request found for ID: ${response.requestId}`);
      return;
    }

    // Remove from pending
    this._pendingResolvers.delete(response.requestId);
    const current = this._pendingRequests$.getValue();
    const request = current.find((r) => r.id === response.requestId);
    this._pendingRequests$.next(current.filter((r) => r.id !== response.requestId));

    // Cache decision if requested
    if (response.rememberForSession && request) {
      this._cacheDecision(request.sessionId, request.command, response.decision);
    }

    // Resolve the promise
    resolver.resolve(response.decision);

    this._logService.log('[CommandPermissionService]', `Request ${response.requestId} resolved: ${response.decision}`);
  }

  setMode(mode: PermissionMode): void {
    this._mode$.next(mode);
    this._logService.log('[CommandPermissionService]', `Permission mode set to: ${mode}`);
  }

  clearSessionCache(sessionId: string): void {
    this._sessionCache.delete(sessionId);
  }

  private _getCachedDecision(sessionId: string, command: string): 'allow' | 'deny' | null {
    const sessionMap = this._sessionCache.get(sessionId);
    if (!sessionMap) {
      return null;
    }
    const prefix = this._getCommandPrefix(command);
    const entry = sessionMap.get(prefix);
    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      sessionMap.delete(prefix);
      return null;
    }

    return entry.decision;
  }

  private _cacheDecision(sessionId: string, command: string, decision: 'allow' | 'deny'): void {
    let sessionMap = this._sessionCache.get(sessionId);
    if (!sessionMap) {
      sessionMap = new Map();
      this._sessionCache.set(sessionId, sessionMap);
    }

    // Enforce size limit: remove oldest entry if at capacity
    if (sessionMap.size >= CACHE_MAX_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of sessionMap) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }
      if (oldestKey !== null) {
        sessionMap.delete(oldestKey);
      }
    }

    const prefix = this._getCommandPrefix(command);
    sessionMap.set(prefix, { decision, timestamp: Date.now() });
  }

  /**
   * Extract a normalized command prefix for caching.
   *
   * For compound commands (git, docker, kubectl, sudo, etc.), includes
   * the leader and first subcommand: "git push", "sudo rm", "docker rm".
   * For sudo, extracts the target command: "sudo rm -rf" → "sudo rm".
   * For simple commands, takes the first token: "ls -la" → "ls".
   */
  private _getCommandPrefix(command: string): string {
    const trimmed = command.replace(/\\n$/, '').trim();
    const tokens = trimmed.split(/\s+/);

    if (tokens.length === 0) {
      return '';
    }

    const leader = tokens[0].toLowerCase();

    if (leader === 'sudo' && tokens.length >= 2) {
      // For sudo, extract the actual command after sudo (skip sudo flags)
      for (let i = 1; i < tokens.length; i++) {
        if (!tokens[i].startsWith('-')) {
          const subcommand = tokens[i].toLowerCase();
          // If the sub is also a compound leader, include its subcommand
          if (COMPOUND_LEADERS.has(subcommand) && i + 1 < tokens.length) {
            return `sudo ${subcommand} ${tokens[i + 1].toLowerCase()}`;
          }
          return `sudo ${subcommand}`;
        }
      }
      return 'sudo';
    }

    if (COMPOUND_LEADERS.has(leader) && tokens.length >= 2) {
      // Skip flags to find the subcommand
      for (let i = 1; i < tokens.length; i++) {
        if (!tokens[i].startsWith('-')) {
          return `${leader} ${tokens[i].toLowerCase()}`;
        }
      }
      return leader;
    }

    return leader;
  }

  override dispose(): void {
    // Deny all pending requests
    for (const [, resolver] of this._pendingResolvers) {
      resolver.resolve('deny');
    }
    this._pendingResolvers.clear();
    this._pendingRequests$.next([]);

    this._mode$.complete();
    this._pendingRequests$.complete();
    this._sessionCache.clear();
    super.dispose();
  }
}
