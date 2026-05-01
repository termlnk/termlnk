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

import type { IAgentToolPermissionRequest, ISuggestedRule, ToolRiskLevel } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, useDependency } from '@termlnk/design';
import { IPermissionClientService } from '@termlnk/rpc-client';
import { AlertTriangle, ChevronDown, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { memo, useState } from 'react';
import { PERMISSION_ANCHOR_ATTR } from '../../PendingApprovalsPill';

interface IToolApprovalCardProps {
  request: IAgentToolPermissionRequest;
}

function riskIcon(level: ToolRiskLevel) {
  if (level === 'dangerous') {
    return <AlertTriangle size={14} className="tm:text-red" />;
  }
  if (level === 'caution') {
    return <ShieldQuestion size={14} className="tm:text-yellow" />;
  }
  return <ShieldCheck size={14} className="tm:text-green" />;
}

function pickHighlight(request: IAgentToolPermissionRequest): { field: string; value: string } | null {
  if (request.highlight) {
    return request.highlight;
  }
  const input = request.input;
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const obj = input as Record<string, unknown>;
  for (const key of ['command', 'path', 'url', 'host']) {
    const v = obj[key];
    if (typeof v === 'string' && v) {
      return { field: key, value: v };
    }
  }
  return null;
}

export const ToolApprovalCard = memo(function ToolApprovalCard({ request }: IToolApprovalCardProps) {
  const localeService = useDependency(LocaleService);
  const permissionService = useDependency(IPermissionClientService);
  const [submitting, setSubmitting] = useState<'allow-once' | 'allow-always' | 'deny' | null>(null);

  const t = (key: string): string => localeService.t(`agent-ui.permission.${key}`);
  const highlight = pickHighlight(request);
  const riskLabel = t(`risk-${request.riskLevel}`);

  const submitOnce = async () => {
    if (submitting) {
      return;
    }
    setSubmitting('allow-once');
    try {
      await permissionService.respond({
        requestId: request.id,
        decision: 'allow',
        scope: 'once',
      });
    }
    finally {
      setSubmitting(null);
    }
  };

  const submitDeny = async () => {
    if (submitting) {
      return;
    }
    setSubmitting('deny');
    try {
      await permissionService.respond({
        requestId: request.id,
        decision: 'deny',
        scope: 'once',
      });
    }
    finally {
      setSubmitting(null);
    }
  };

  const submitAlways = async (suggestion: ISuggestedRule) => {
    if (submitting) {
      return;
    }
    setSubmitting('allow-always');
    try {
      await permissionService.respond({
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
    }
    finally {
      setSubmitting(null);
    }
  };

  // Fall back to a single tool-wide suggestion when the server didn't generate any.
  const suggestions: ISuggestedRule[] = request.suggestedRules?.length
    ? request.suggestedRules
    : [{ label: t('allow-always'), decision: 'allow' }];

  return (
    <div
      {...{ [PERMISSION_ANCHOR_ATTR]: request.id }}
      className={cn(
        `
          tm:flex tm:flex-col tm:gap-2 tm:rounded-md tm:border-l-2
          tm:bg-one-bg/60 tm:p-3
        `,
        {
          'tm:border-red': request.riskLevel === 'dangerous',
          'tm:border-yellow': request.riskLevel === 'caution',
          'tm:border-green/60': request.riskLevel === 'safe',
        }
      )}
    >
      <div className="tm:flex tm:items-center tm:gap-2 tm:text-xs">
        {riskIcon(request.riskLevel)}
        <span
          className={cn('tm:font-semibold', {
            'tm:text-red': request.riskLevel === 'dangerous',
            'tm:text-yellow': request.riskLevel === 'caution',
            'tm:text-green': request.riskLevel === 'safe',
          })}
        >
          {riskLabel}
        </span>
        <span className="tm:truncate tm:text-light-grey">{request.toolDisplayName ?? request.toolName}</span>
      </div>

      {highlight && (
        <pre
          className={`
            tm:max-h-32 tm:overflow-auto tm:rounded tm:bg-black/40 tm:px-2 tm:py-1.5
            tm:text-[0.7rem] tm:break-all tm:whitespace-pre-wrap tm:text-light-grey
          `}
        >
          {highlight.value}
        </pre>
      )}

      {request.reason && (
        <div className="tm:text-[0.7rem] tm:text-grey-fg">{request.reason}</div>
      )}

      <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-2 tm:pt-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={submitting !== null}
          onClick={submitOnce}
        >
          {t('allow-once')}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              disabled={submitting !== null}
            >
              {t('allow-always')}
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="tm:min-w-[14rem]">
            {suggestions.map((s, idx) => (
              <DropdownMenuItem
                key={`${s.pattern ?? '__tool_wide__'}-${idx}`}
                onSelect={() => {
                  void submitAlways(s);
                }}
              >
                <span className="tm:truncate">{s.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="destructive"
          disabled={submitting !== null}
          onClick={submitDeny}
        >
          {t('deny')}
        </Button>
      </div>
    </div>
  );
});
