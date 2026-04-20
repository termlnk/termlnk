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

import type { CommandRiskLevel } from '@termlnk/agent';

export interface IDangerPattern {
  pattern: RegExp;
  level: CommandRiskLevel;
  reason: string;
  suggestedAlternative?: string;
}

export const DANGER_PATTERNS: IDangerPattern[] = [
  // ── Dangerous: requires explicit user approval ──

  // Recursive forced deletion
  { pattern: /\brm\s+(-\w*r\w*f|-\w*f\w*r)\b/i, level: 'dangerous', reason: 'Recursive forced deletion (rm -rf)', suggestedAlternative: 'Use rm -ri for interactive confirmation' },
  { pattern: /\brm\s+-rf\s+[/~]/i, level: 'dangerous', reason: 'rm -rf on system/home path' },

  // Disk/partition operations
  { pattern: /\bdd\s+if=/i, level: 'dangerous', reason: 'Direct disk write (dd)' },
  { pattern: /\bmkfs\b/i, level: 'dangerous', reason: 'Filesystem creation (mkfs)' },
  { pattern: /\bfdisk\b/i, level: 'dangerous', reason: 'Partition manipulation (fdisk)' },
  { pattern: /\bparted\b/i, level: 'dangerous', reason: 'Partition manipulation (parted)' },

  // System destructive
  { pattern: /:\(\)\s*\{.*\|.*&\s*\}\s*;/i, level: 'dangerous', reason: 'Fork bomb detected' },
  { pattern: />\s*\/dev\/sd[a-z]/i, level: 'dangerous', reason: 'Writing to raw device' },

  // Database destructive
  { pattern: /\bDROP\s+(DATABASE|TABLE)\b/i, level: 'dangerous', reason: 'Database DROP operation' },
  { pattern: /\bTRUNCATE\s+TABLE\b/i, level: 'dangerous', reason: 'Database TRUNCATE' },
  { pattern: /\bDELETE\s+FROM\b(?![\s\S]*\bWHERE\b)/i, level: 'dangerous', reason: 'DELETE without WHERE clause' },

  // Network/firewall
  { pattern: /\biptables\s+-F\b/i, level: 'dangerous', reason: 'Flush firewall rules' },
  { pattern: /\bufw\s+(disable|reset)\b/i, level: 'dangerous', reason: 'Disable/reset firewall' },

  // System power
  { pattern: /\bshutdown\b/i, level: 'dangerous', reason: 'System shutdown' },
  { pattern: /\breboot\b/i, level: 'dangerous', reason: 'System reboot' },
  { pattern: /\bhalt\b/i, level: 'dangerous', reason: 'System halt' },
  { pattern: /\binit\s+0\b/i, level: 'dangerous', reason: 'System halt (init 0)' },

  // Git force/destructive operations
  { pattern: /\bgit\s+push\s+.*--force\b/i, level: 'dangerous', reason: 'Git force push' },
  { pattern: /\bgit\s+reset\s+--hard\b/i, level: 'dangerous', reason: 'Git hard reset' },
  { pattern: /\bgit\s+clean\s+-[a-z]*f/i, level: 'dangerous', reason: 'Git clean (deletes untracked files)' },
  { pattern: /\bgit\s+checkout\s+--\s*\./i, level: 'dangerous', reason: 'Git discard all local changes' },
  { pattern: /\bgit\s+branch\s+-D\b/i, level: 'dangerous', reason: 'Git force delete branch' },
  { pattern: /\bgit\s+stash\s+drop\b/i, level: 'dangerous', reason: 'Git stash drop (irreversible)' },

  // Broad permission changes
  { pattern: /\bchmod\s+777\b/i, level: 'dangerous', reason: 'Set world-writable permissions' },
  { pattern: /\bchmod\s+-R\s+.*\/(etc|usr|var|boot)\b/i, level: 'dangerous', reason: 'Recursive permission change on system directory' },
  { pattern: /\bchown\s+-R\s+.*\/(etc|usr|var|boot)\b/i, level: 'dangerous', reason: 'Recursive ownership change on system directory' },

  // SSH configuration modification
  { pattern: />\s*~?\/?\.ssh\/(authorized_keys|config|known_hosts)\b/i, level: 'dangerous', reason: 'Overwriting SSH configuration file' },
  { pattern: /\brm\s+.*~?\/?\.ssh\//i, level: 'dangerous', reason: 'Deleting SSH configuration files' },
  { pattern: /\bsed\s+-i.*\/etc\/ssh\//i, level: 'dangerous', reason: 'Modifying SSH server configuration' },

  // Piped remote code execution
  { pattern: /\bcurl\b.*\|.*\b(bash|sh|zsh)\b/i, level: 'dangerous', reason: 'Piped remote code execution (curl | sh)', suggestedAlternative: 'Download the script first, review it, then execute' },
  { pattern: /\bwget\b.*\|.*\b(bash|sh|zsh)\b/i, level: 'dangerous', reason: 'Piped remote code execution (wget | sh)', suggestedAlternative: 'Download the script first, review it, then execute' },
  { pattern: /\bcurl\b.*-o\s*-\s*\|/i, level: 'dangerous', reason: 'Piped remote code execution' },

  // sudo combined with destructive
  { pattern: /\bsudo\s+rm\s+(-\w*r|-\w*f)/i, level: 'dangerous', reason: 'Privileged recursive/forced deletion' },
  { pattern: /\bsudo\s+chmod\b/i, level: 'dangerous', reason: 'Privileged permission change' },
  { pattern: /\bsudo\s+chown\b/i, level: 'dangerous', reason: 'Privileged ownership change' },
  { pattern: /\bsudo\s+dd\b/i, level: 'dangerous', reason: 'Privileged disk write' },
  { pattern: /\bsudo\s+mkfs\b/i, level: 'dangerous', reason: 'Privileged filesystem creation' },

  // Container/orchestration destructive
  { pattern: /\bdocker\s+system\s+prune\b/i, level: 'dangerous', reason: 'Docker system prune (removes all unused data)' },
  { pattern: /\bdocker\s+volume\s+rm\b/i, level: 'dangerous', reason: 'Docker volume removal (data loss)' },
  { pattern: /\bkubectl\s+delete\s+namespace\b/i, level: 'dangerous', reason: 'Kubernetes namespace deletion' },
  { pattern: /\bkubectl\s+delete\s+.*--all\b/i, level: 'dangerous', reason: 'Kubernetes bulk resource deletion' },

  // Environment destruction
  { pattern: /\bunset\s+(PATH|HOME|SHELL|USER)\b/i, level: 'dangerous', reason: 'Unsetting critical environment variable' },
  { pattern: /\bexport\s+PATH\s*=\s*["']?\s*["']?\s*$/i, level: 'dangerous', reason: 'Clearing PATH variable' },

  // Windows destructive
  { pattern: /\bRemove-Item\b.*-Recurse.*-Force/i, level: 'dangerous', reason: 'PowerShell recursive forced deletion' },
  { pattern: /\bFormat-Volume\b/i, level: 'dangerous', reason: 'Windows volume format' },
  { pattern: /\bSet-ExecutionPolicy\b/i, level: 'dangerous', reason: 'PowerShell execution policy change' },

  // ── Caution: logged, allowed in default mode ──

  // File modification
  { pattern: /\b(mkdir|touch|cp|mv|ln)\s+/i, level: 'caution', reason: 'File modification operation' },

  // Git mutations
  { pattern: /\bgit\s+(add|commit|push|checkout|merge|rebase)\b/i, level: 'caution', reason: 'Git mutation operation' },

  // Package management
  { pattern: /\b(apt|brew|pip|npm|yarn|pnpm|cargo)\s+install\b/i, level: 'caution', reason: 'Package installation' },
  { pattern: /\b(apt|pip|npm)\s+(remove|uninstall)\b/i, level: 'caution', reason: 'Package removal' },

  // Service management
  { pattern: /\bsystemctl\s+(start|stop|restart)\b/i, level: 'caution', reason: 'Service management' },

  // Container management
  { pattern: /\bdocker\s+(run|stop|rm|build|push)\b/i, level: 'caution', reason: 'Container management' },

  // Environment modification
  { pattern: /\bexport\s+\w+=/i, level: 'caution', reason: 'Environment variable modification' },

  // Cron/scheduled tasks
  { pattern: /\bcrontab\s+(-e|-r)\b/i, level: 'caution', reason: 'Crontab modification' },

  // Non-GET HTTP requests
  { pattern: /\bcurl\s+.*-X\s*(POST|PUT|DELETE|PATCH)\b/i, level: 'caution', reason: 'Non-GET HTTP request' },
  { pattern: /\bcurl\s+.*(-d|--data)\b/i, level: 'caution', reason: 'HTTP request with data payload' },
];

export function evaluateCommandRisk(command: string): {
  level: CommandRiskLevel;
  reasons: string[];
  suggestedAlternative?: string;
} {
  let maxLevel: CommandRiskLevel = 'safe';
  const reasons: string[] = [];
  let suggestedAlternative: string | undefined;

  for (const entry of DANGER_PATTERNS) {
    if (entry.pattern.test(command)) {
      reasons.push(entry.reason);
      if (entry.level === 'dangerous') {
        maxLevel = 'dangerous';
        if (!suggestedAlternative && entry.suggestedAlternative) {
          suggestedAlternative = entry.suggestedAlternative;
        }
      } else if (entry.level === 'caution' && maxLevel === 'safe') {
        maxLevel = 'caution';
      }
    }
  }

  return { level: maxLevel, reasons, suggestedAlternative };
}
