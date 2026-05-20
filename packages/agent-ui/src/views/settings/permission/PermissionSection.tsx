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

import type { IPermissionRule, ToolPermissionMode } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, Card, CardContent, CardHeader, cn, Input, useDependency, useObservable } from '@termlnk/design';
import { IAgentToolPermissionService } from '@termlnk/rpc-client';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

const MODE_OPTIONS: ReadonlyArray<{ value: ToolPermissionMode; labelKey: string; descKey: string }> = [
  { value: 'default', labelKey: 'mode-default', descKey: 'mode-default-desc' },
  { value: 'auto', labelKey: 'mode-auto', descKey: 'mode-auto-desc' },
  { value: 'strict', labelKey: 'mode-strict', descKey: 'mode-strict-desc' },
  { value: 'plan', labelKey: 'mode-plan', descKey: 'mode-plan-desc' },
];

function detectShadowed(rules: IPermissionRule[]): Map<string, IPermissionRule> {
  // For each specific rule, find a tool-wide rule on the same tool+scope.
  const out = new Map<string, IPermissionRule>();
  for (const r of rules) {
    if (!r.pattern) {
      continue;
    }
    const broader = rules.find((other) => other !== r
      && other.toolName === r.toolName
      && !other.pattern
      && other.scope === r.scope);
    if (broader) {
      out.set(r.id, broader);
    }
  }
  return out;
}

function formatPattern(rule: IPermissionRule, toolWideLabel: string): string {
  if (!rule.pattern) {
    return toolWideLabel;
  }
  return rule.matchField ? `${rule.matchField}: ${rule.pattern}` : rule.pattern;
}

export function PermissionSection() {
  const localeService = useDependency(LocaleService);
  const permissionService = useDependency(IAgentToolPermissionService);

  const t = useCallback(
    (key: string): string => localeService.t(`agent-ui.permission.${key}`),
    [localeService]
  );

  const mode = useObservable(permissionService.mode$, 'default' as ToolPermissionMode);
  const rules = useObservable(permissionService.rules$, [] as IPermissionRule[]);

  const [search, setSearch] = useState('');
  const [savingMode, setSavingMode] = useState<ToolPermissionMode | null>(null);

  const shadowedMap = useMemo(() => detectShadowed(rules), [rules]);

  const filteredRules = useMemo(() => {
    if (!search.trim()) {
      return rules;
    }
    const q = search.toLowerCase();
    return rules.filter((r) =>
      r.toolName.toLowerCase().includes(q)
      || (r.pattern?.toLowerCase().includes(q) ?? false)
    );
  }, [rules, search]);

  const handleModeChange = useCallback(
    (next: ToolPermissionMode) => {
      if (next === mode || savingMode) {
        return;
      }
      setSavingMode(next);
      void permissionService.setMode(next).finally(() => setSavingMode(null));
    },
    [mode, permissionService, savingMode]
  );

  const handleRemoveRule = useCallback(
    (id: string) => {
      void permissionService.removeRule(id);
    },
    [permissionService]
  );

  const toolWideLabel = t('rules-tool-wide');

  return (
    <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
      <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
        <div className="tm:flex tm:items-center tm:gap-2">
          <ShieldCheck className="tm:size-4 tm:text-blue" />
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">{t('mode')}</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="tm:flex tm:flex-col tm:gap-5 tm:py-4">
          <p className="tm:text-xs tm:text-grey-fg">{t('mode-hint')}</p>

          <div className="tm:grid tm:grid-cols-1 tm:gap-2">
            {MODE_OPTIONS.map((opt) => {
              const active = opt.value === mode;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={savingMode !== null}
                  onClick={() => handleModeChange(opt.value)}
                  className={cn(
                    `
                      tm:flex tm:flex-col tm:items-start tm:gap-1 tm:rounded-md tm:border tm:px-3 tm:py-2 tm:text-left
                      tm:transition-colors
                    `,
                    {
                      'tm:border-blue tm:bg-one-bg2': active,
                      'tm:border-line tm:bg-one-bg/30 tm:hover:bg-one-bg2/60': !active,
                    }
                  )}
                >
                  <span className="tm:text-sm tm:font-medium tm:text-white">{t(opt.labelKey)}</span>
                  <span className="tm:text-xs tm:text-grey-fg">{t(opt.descKey)}</span>
                </button>
              );
            })}
          </div>

          <div className="tm:flex tm:flex-col tm:gap-2 tm:border-t tm:border-line tm:pt-4">
            <div className="tm:flex tm:items-center tm:justify-between">
              <h4 className="tm:text-sm tm:font-semibold tm:text-white">{t('rules')}</h4>
            </div>
            <p className="tm:text-xs tm:text-grey-fg">{t('rules-hint')}</p>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('rules-search')}
              className="tm:h-8 tm:text-xs"
            />

            {filteredRules.length === 0
              ? (
                <p className="tm:py-3 tm:text-center tm:text-xs tm:text-grey">{t('rules-empty')}</p>
              )
              : (
                <ul className="tm:flex tm:flex-col tm:gap-1.5">
                  {filteredRules.map((rule) => {
                    const shadowed = shadowedMap.get(rule.id);
                    return (
                      <li
                        key={rule.id}
                        className={cn(
                          'tm:flex tm:items-center tm:gap-2 tm:rounded-sm tm:border tm:border-line tm:px-2 tm:py-1.5',
                          {
                            'tm:opacity-60': shadowed !== undefined,
                          }
                        )}
                      >
                        <span
                          className={cn('tm:rounded-sm tm:px-1.5 tm:py-0.5 tm:text-[0.65rem] tm:font-medium', {
                            'tm:bg-green/10 tm:text-green': rule.decision === 'allow',
                            'tm:bg-red/10 tm:text-red': rule.decision === 'deny',
                          })}
                        >
                          {rule.decision === 'allow' ? t('rules-allow') : t('rules-deny')}
                        </span>
                        <span className="tm:font-mono tm:text-xs tm:text-light-grey">{rule.toolName}</span>
                        <span className="tm:flex-1 tm:truncate tm:font-mono tm:text-xs tm:text-grey-fg">
                          {formatPattern(rule, toolWideLabel)}
                        </span>
                        {shadowed && (
                          <span
                            className="tm:text-[0.65rem] tm:text-yellow"
                            title={t('rules-shadowed')}
                          >
                            ⚠
                            {' '}
                            {t('rules-shadowed')}
                          </span>
                        )}
                        <span className="tm:text-[0.65rem] tm:text-grey">{rule.scope}</span>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={t('rules-remove')}
                          onClick={() => handleRemoveRule(rule.id)}
                        >
                          <Trash2 size={11} />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
