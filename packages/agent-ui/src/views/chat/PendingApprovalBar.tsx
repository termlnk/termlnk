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

import type { IAgentToolPermissionResponse, ISuggestedRule, ToolRiskLevel } from '@termlnk/agent';
import type { ReactElement } from 'react';
import { LocaleService } from '@termlnk/core';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useDependency,
  useObservable,
} from '@termlnk/design';
import { IPermissionClientService } from '@termlnk/rpc-client';
import { AlertTriangle, ChevronDown, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { memo, useState } from 'react';
import { pickPermissionHighlight } from './parts/permission/highlight';

function riskIcon(level: ToolRiskLevel): ReactElement {
  if (level === 'dangerous') {
    return <AlertTriangle size={12} className="tm:shrink-0 tm:text-red" />;
  }
  if (level === 'caution') {
    return <ShieldQuestion size={12} className="tm:shrink-0 tm:text-yellow" />;
  }
  return <ShieldCheck size={12} className="tm:shrink-0 tm:text-green" />;
}

export const PendingApprovalBar = memo(function PendingApprovalBar() {
  const localeService = useDependency(LocaleService);
  const permissionService = useDependency(IPermissionClientService);
  const pending = useObservable(permissionService.pendingRequests$, []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (pending.length === 0) {
    return null;
  }

  const t = (key: string, ...args: string[]): string =>
    localeService.t(`agent-ui.permission.${key}`, ...args);

  const request = pending[0]!;
  const remaining = pending.length - 1;
  const highlight = pickPermissionHighlight(request);
  const riskLabel = t(`risk-${request.riskLevel}`);

  const submit = async (response: IAgentToolPermissionResponse): Promise<void> => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await permissionService.respond(response);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAllowOnce = (): void => {
    void submit({ requestId: request.id, decision: 'allow', scope: 'once' });
  };

  const handleDeny = (): void => {
    void submit({ requestId: request.id, decision: 'deny', scope: 'once' });
  };

  const handleAllowAlways = (suggestion: ISuggestedRule): void => {
    void submit({
      requestId: request.id,
      decision: 'allow',
      scope: 'user',
      rule: {
        toolName: request.toolName,
        pattern: suggestion.pattern,
        matchField: suggestion.matchField,
        decision: 'allow',
      },
    });
  };

  // Fall back to a single tool-wide suggestion when the server didn't generate any.
  const suggestions: ISuggestedRule[] = request.suggestedRules?.length
    ? request.suggestedRules
    : [{ label: t('allow-always'), decision: 'allow' }];

  return (
    <div
      className={cn(
        'tm:flex tm:flex-col tm:gap-2 tm:border-t-2 tm:bg-black tm:px-3 tm:py-2.5',
        {
          'tm:border-t-red/70': request.riskLevel === 'dangerous',
          'tm:border-t-yellow/70': request.riskLevel === 'caution',
          'tm:border-t-green/60': request.riskLevel === 'safe',
        }
      )}
    >
      <div className="tm:flex tm:items-center tm:gap-2 tm:text-[0.72rem]">
        {riskIcon(request.riskLevel)}
        <span
          className={cn(
            `
              tm:inline-flex tm:shrink-0 tm:items-center tm:rounded-sm tm:px-1.5 tm:py-px tm:text-[0.62rem]
              tm:font-medium
            `,
            {
              'tm:bg-red/15 tm:text-red': request.riskLevel === 'dangerous',
              'tm:bg-yellow/15 tm:text-yellow': request.riskLevel === 'caution',
              'tm:bg-green/15 tm:text-green': request.riskLevel === 'safe',
            }
          )}
        >
          {riskLabel}
        </span>
        <span className="tm:min-w-0 tm:flex-1 tm:truncate tm:font-medium tm:text-white">
          {request.toolDisplayName ?? request.toolName}
        </span>
        {remaining > 0 && (
          <span
            className="tm:shrink-0 tm:rounded-sm tm:bg-one-bg tm:px-1.5 tm:py-px tm:text-[0.6rem] tm:text-grey-fg"
          >
            {t('more-pending', String(remaining))}
          </span>
        )}
      </div>

      {highlight && (
        <pre
          className={`
            tm:max-h-24 tm:overflow-auto tm:rounded-md tm:border tm:border-line/40 tm:bg-one-bg/60 tm:px-2 tm:py-1.5
            tm:font-mono tm:text-[0.7rem] tm:break-all tm:whitespace-pre-wrap tm:text-light-grey
          `}
        >
          {highlight.value}
        </pre>
      )}

      {request.reason && (
        <div className="tm:text-[0.68rem] tm:text-grey-fg">{request.reason}</div>
      )}

      <div className="tm:flex tm:items-center tm:gap-1.5 tm:pt-0.5">
        <Button
          size="sm"
          variant="primary"
          disabled={isSubmitting}
          onClick={handleAllowOnce}
        >
          {t('allow-once')}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
            >
              {t('allow-always')}
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="tm:min-w-56">
            {suggestions.map((s) => (
              <DropdownMenuItem
                key={`${s.matchField ?? ''}|${s.pattern ?? '__tool_wide__'}|${s.label}`}
                onSelect={() => handleAllowAlways(s)}
              >
                <span className="tm:truncate">{s.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="tm:flex-1" />

        <Button
          size="sm"
          variant="ghost"
          className={`
            tm:text-red
            tm:hover:bg-red/10 tm:hover:text-red
          `}
          disabled={isSubmitting}
          onClick={handleDeny}
        >
          {t('deny')}
        </Button>
      </div>
    </div>
  );
});
