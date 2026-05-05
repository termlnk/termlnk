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
  AgentToolCategory,
  IGuardMetadata,
  IRiskAssessment,
  IRiskAssessmentService,
  ISuggestedRule,
} from '@termlnk/agent';
import { Disposable } from '@termlnk/core';
import { evaluateCommandRisk } from '../../common/danger-patterns';

/** SSH-critical commands escalated even when isDestructive on the tool is false. */
const SSH_CRITICAL_PATTERN = /\b(shutdown|reboot|halt|poweroff|init\s+[06])\b/i;

/**
 * Compound command leaders whose first sub-command is part of the prefix
 * suggestion (e.g. "git push", "docker rm", "sudo rm").
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
  'cargo',
]);

export class RiskAssessmentService extends Disposable implements IRiskAssessmentService {
  assess(
    toolName: string,
    input: unknown,
    category: AgentToolCategory,
    metadata?: IGuardMetadata
  ): IRiskAssessment {
    // MCP: trust user configuration (Q5=C). Read-only hint upgrades to safe.
    if (category === 'mcp') {
      return {
        level: 'safe',
        reason: metadata?.readOnlyHint ? 'mcp.read-only' : 'mcp.trusted-by-config',
      };
    }

    // Skill: cautious by default (Q5=C).
    if (category === 'skill') {
      return { level: 'caution', reason: 'skill.default-caution' };
    }

    // termlnk_terminal_run: per-command evaluation preserves SSH critical-command rule.
    if (toolName === 'termlnk_terminal_run') {
      return this._evaluateTerminalCommand(input, metadata);
    }

    // Other built-in tools: derive from IAgentTool metadata.
    if (metadata?.isDestructive) {
      return { level: 'dangerous', reason: 'tool.destructive' };
    }
    if (metadata?.isReadOnly) {
      return { level: 'safe', reason: 'tool.read-only' };
    }
    return { level: 'caution', reason: '' };
  }

  isReadOnly(toolName: string, category: AgentToolCategory, metadata?: IGuardMetadata): boolean {
    if (category === 'mcp') {
      return metadata?.readOnlyHint === true;
    }
    if (category === 'skill') {
      return false;
    }
    // Terminal run can write arbitrarily; never plan-mode-safe.
    if (toolName === 'termlnk_terminal_run') {
      return false;
    }
    return metadata?.isReadOnly === true;
  }

  generateSuggestedRules(
    toolName: string,
    input: unknown,
    category: AgentToolCategory
  ): ISuggestedRule[] {
    if (toolName === 'termlnk_terminal_run') {
      return this._generateTerminalSuggestions(input, toolName);
    }
    return this._generateGenericSuggestions(toolName, input, category);
  }

  private _evaluateTerminalCommand(input: unknown, metadata?: IGuardMetadata): IRiskAssessment {
    const command = (input as { command?: unknown })?.command;
    if (typeof command !== 'string') {
      return { level: 'caution', reason: '' };
    }

    if (metadata?.terminalSessionType === 'ssh' && SSH_CRITICAL_PATTERN.test(command)) {
      return {
        level: 'dangerous',
        reason: 'SSH critical command (shutdown/reboot/halt/poweroff/init)',
        highlight: { field: 'command', value: command },
      };
    }

    const evaluation = evaluateCommandRisk(command);
    return {
      level: evaluation.level,
      reason: evaluation.reasons.join('; '),
      highlight: { field: 'command', value: command },
    };
  }

  private _generateTerminalSuggestions(input: unknown, toolName: string): ISuggestedRule[] {
    const command = (input as { command?: unknown })?.command;
    if (typeof command !== 'string' || !command.trim()) {
      return [{
        label: `For all ${toolName} calls`,
        decision: 'allow',
      }];
    }

    const out: ISuggestedRule[] = [];

    // 1) Multi-line command — first line as prefix
    if (command.includes('\n')) {
      const firstLine = command.split('\n')[0]!.trim();
      if (firstLine) {
        out.push({
          label: `For commands matching ${firstLine}:*`,
          pattern: `${firstLine}:*`,
          matchField: 'command',
          decision: 'allow',
        });
      }
    }

    // 2) Compound-leader prefix (e.g. "git commit", "sudo rm")
    const compound = this._getCompoundPrefix(command);
    if (compound && compound !== command) {
      out.push({
        label: `For commands matching ${compound}:*`,
        pattern: `${compound}:*`,
        matchField: 'command',
        decision: 'allow',
      });
    }

    // 3) Simple leader prefix (e.g. "ls", "echo")
    const simple = command.trim().split(/\s+/)[0]!;
    if (simple && simple !== compound && !command.includes('\n')) {
      out.push({
        label: `For commands matching ${simple}:*`,
        pattern: `${simple}:*`,
        matchField: 'command',
        decision: 'allow',
      });
    }

    // 4) Exact command
    out.push({
      label: 'For this exact command',
      pattern: command,
      matchField: 'command',
      decision: 'allow',
    });

    // 5) Tool-wide
    out.push({
      label: `For all ${toolName} calls`,
      decision: 'allow',
    });

    return this._dedupe(out);
  }

  private _generateGenericSuggestions(
    toolName: string,
    input: unknown,
    category: AgentToolCategory
  ): ISuggestedRule[] {
    const out: ISuggestedRule[] = [];

    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;

      const path = obj.path;
      if (typeof path === 'string' && path) {
        out.push({
          label: 'For this exact path',
          pattern: path,
          matchField: 'path',
          decision: 'allow',
        });
        const slash = path.lastIndexOf('/');
        if (slash > 0) {
          const dir = path.substring(0, slash);
          out.push({
            label: `For paths in ${dir}/`,
            pattern: `${dir}/*`,
            matchField: 'path',
            decision: 'allow',
          });
        }
      }

      const url = obj.url;
      if (typeof url === 'string' && url) {
        out.push({
          label: 'For this exact URL',
          pattern: url,
          matchField: 'url',
          decision: 'allow',
        });
        try {
          const u = new URL(url);
          out.push({
            label: `For URLs at ${u.host}`,
            pattern: `${u.protocol}//${u.host}/*`,
            matchField: 'url',
            decision: 'allow',
          });
        } catch {
          // Ignore malformed URLs
        }
      }

      const host = obj.host;
      if (typeof host === 'string' && host) {
        out.push({
          label: `For host ${host}`,
          pattern: host,
          matchField: 'host',
          decision: 'allow',
        });
      }
    }

    out.push({
      label: `For all ${toolName} calls`,
      decision: 'allow',
    });

    if (category === 'mcp') {
      const serverPrefix = toolName.split('_').slice(0, 2).join('_');
      if (serverPrefix && serverPrefix !== toolName) {
        out.push({
          label: `For all ${serverPrefix}_* calls`,
          pattern: undefined,
          matchField: undefined,
          decision: 'allow',
        });
      }
    }

    return this._dedupe(out);
  }

  /** Extracts "git commit" / "sudo rm" / etc. from a compound command. */
  private _getCompoundPrefix(command: string): string | null {
    const tokens = command.trim().split(/\s+/);
    if (tokens.length < 2) {
      return null;
    }
    const leader = tokens[0]!.toLowerCase();
    if (!COMPOUND_LEADERS.has(leader)) {
      return null;
    }
    if (leader === 'sudo') {
      for (let i = 1; i < tokens.length; i++) {
        const tok = tokens[i]!;
        if (!tok.startsWith('-')) {
          const sub = tok.toLowerCase();
          if (COMPOUND_LEADERS.has(sub) && i + 1 < tokens.length) {
            return `sudo ${sub} ${tokens[i + 1]!.toLowerCase()}`;
          }
          return `sudo ${sub}`;
        }
      }
      return 'sudo';
    }
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (!tok.startsWith('-')) {
        return `${leader} ${tok.toLowerCase()}`;
      }
    }
    return leader;
  }

  private _dedupe(suggestions: ISuggestedRule[]): ISuggestedRule[] {
    const seen = new Set<string>();
    return suggestions.filter((s) => {
      const key = `${s.pattern ?? '__tool_wide__'}:${s.matchField ?? ''}:${s.decision}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
