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

import type { IAgentToolPermissionRequest, IToolPart } from '@termlnk/agent';
import type { ReactElement } from 'react';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { AlertCircle, Check, ChevronDown, Hourglass, Loader2, Wrench } from 'lucide-react';
import { memo, useState } from 'react';
import { pickPermissionHighlight } from './permission/highlight';
import { PermissionDeniedNote } from './permission/PermissionDeniedNote';

interface IToolPartProps {
  part: IToolPart;
  messageIsStreaming?: boolean;
}

type ToolDisplayState = 'pending' | 'completed' | 'errored';

const SUMMARY_PREFERRED_KEYS = [
  'query',
  'url',
  'path',
  'file_path',
  'filePath',
  'command',
  'pattern',
  'name',
  'id',
];

const OUTPUT_LINE_LIMIT = 24;
const SUMMARY_MAX_LEN = 96;

// Resolve effective state from part.state, output presence, and the parent
// message's streaming flag. The `state` field alone can lag behind reality:
// e.g. when a message is reloaded from persistence with state still set to
// `input-available`, or when the assistant message has already completed but
// the tool result reached the renderer through a different code path. As long
// as the parent message is no longer streaming, every tool must have settled.
function resolveDisplayState(part: IToolPart, messageIsStreaming: boolean): ToolDisplayState {
  if (part.state === 'output-error' || part.output?.isError) {
    return 'errored';
  }
  if (part.state === 'output-available' || part.output !== undefined) {
    return 'completed';
  }
  if (!messageIsStreaming) {
    return 'completed';
  }
  return 'pending';
}

function getStateIcon(state: ToolDisplayState): ReactElement {
  if (state === 'pending') {
    return <Loader2 size={11} className="tm:shrink-0 tm:animate-spin tm:text-nord-blue" />;
  }
  if (state === 'errored') {
    return <AlertCircle size={11} className="tm:shrink-0 tm:text-red" />;
  }
  return <Check size={11} className="tm:shrink-0 tm:text-green" />;
}

function formatJson(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncateOutput(text: string | undefined, lines = OUTPUT_LINE_LIMIT): { text: string; truncated: boolean; total: number } {
  if (!text) {
    return { text: '', truncated: false, total: 0 };
  }
  const split = text.split('\n');
  if (split.length <= lines) {
    return { text, truncated: false, total: split.length };
  }
  return {
    text: split.slice(0, lines).join('\n'),
    truncated: true,
    total: split.length,
  };
}

function formatInputSummary(input: Record<string, unknown> | undefined, raw: string | undefined): string {
  if (input && typeof input === 'object') {
    const entries = Object.entries(input);
    if (entries.length > 0) {
      const sorted = [...entries].sort(([a], [b]) => {
        const ai = SUMMARY_PREFERRED_KEYS.indexOf(a);
        const bi = SUMMARY_PREFERRED_KEYS.indexOf(b);
        if (ai === -1 && bi === -1) {
          return 0;
        }
        if (ai === -1) {
          return 1;
        }
        if (bi === -1) {
          return -1;
        }
        return ai - bi;
      });
      const [, value] = sorted[0];
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      if (str.length > SUMMARY_MAX_LEN) {
        return `${str.slice(0, SUMMARY_MAX_LEN)}…`;
      }
      return str;
    }
  }
  if (raw) {
    return raw.length > SUMMARY_MAX_LEN ? `${raw.slice(0, SUMMARY_MAX_LEN)}…` : raw;
  }
  return '';
}

function ApprovalWaitingPlaceholder({ request }: { request: IAgentToolPermissionRequest }): ReactElement {
  const localeService = useDependency(LocaleService);
  const t = (key: string): string => localeService.t(`agent-ui.permission.${key}`);
  const highlight = pickPermissionHighlight(request);

  return (
    <div
      className={`
        tm:flex tm:flex-col tm:gap-1 tm:rounded-md tm:border-l-2 tm:border-l-yellow tm:bg-one-bg/40 tm:px-2 tm:py-1.5
        tm:text-[0.7rem]
      `}
    >
      <div className="tm:flex tm:min-w-0 tm:items-center tm:gap-1.5">
        <Hourglass size={11} className="tm:shrink-0 tm:animate-pulse tm:text-yellow" />
        <span className="tm:shrink-0 tm:text-yellow">{t('awaiting-inline')}</span>
        <span className="tm:shrink-0 tm:text-grey">·</span>
        <span className="tm:min-w-0 tm:truncate tm:text-light-grey">
          {request.toolDisplayName ?? request.toolName}
        </span>
      </div>
      {highlight && (
        <span className="tm:truncate tm:font-mono tm:text-grey-fg">{highlight.value}</span>
      )}
    </div>
  );
}

export const ToolPart = memo(function ToolPart({ part, messageIsStreaming = false }: IToolPartProps) {
  const [expanded, setExpanded] = useState(false);

  // Awaiting approval — show a read-only placeholder. The actual Allow/Deny
  // controls live in the global PendingApprovalBar above ChatInput so there is
  // a single, predictable place to act on permission requests.
  if (part.state === 'awaiting-approval' && part.permissionRequest) {
    return <ApprovalWaitingPlaceholder request={part.permissionRequest} />;
  }

  const display = resolveDisplayState(part, messageIsStreaming);
  const pending = display === 'pending';
  const errored = display === 'errored';
  const completed = display === 'completed';
  const inputJson = formatJson(part.input ?? part.inputRaw);
  const output = truncateOutput(part.output?.text);
  const summary = formatInputSummary(part.input, part.inputRaw);
  const isPermissionDenial = errored && (part.output?.text?.startsWith('[Permission denied]') ?? false);

  return (
    <div
      className={cn(
        'tm:overflow-hidden tm:rounded-md tm:border-l-2 tm:bg-one-bg/60 tm:transition-colors',
        {
          'tm:border-nord-blue': pending,
          'tm:border-green/60': completed,
          'tm:border-red/70': errored,
        }
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`
          tm:flex tm:w-full tm:min-w-0 tm:items-center tm:gap-1.5 tm:px-2 tm:py-1.5 tm:text-left tm:text-xs
          tm:transition-colors
          tm:hover:bg-one-bg2
        `}
      >
        <Wrench size={11} className="tm:shrink-0 tm:text-light-grey" />
        <span className="tm:min-w-0 tm:truncate tm:font-medium tm:text-white">{part.toolName}</span>
        {summary && (
          <span className="tm:min-w-0 tm:flex-1 tm:truncate tm:text-light-grey">{summary}</span>
        )}
        <span className="tm:ml-auto tm:flex tm:shrink-0 tm:items-center tm:gap-1">
          {getStateIcon(display)}
          <ChevronDown
            size={11}
            className={cn('tm:text-grey-fg tm:transition-transform tm:duration-150', {
              'tm:rotate-180': expanded,
            })}
          />
        </span>
      </button>

      {expanded && (
        <div className="tm:border-t tm:border-line/60">
          {inputJson && (
            <div className="tm:border-b tm:border-line/60 tm:px-2 tm:py-1.5">
              <div className="tm:mb-1 tm:text-[0.6rem] tm:tracking-wide tm:text-grey">INPUT</div>
              <pre
                className="
                  tm:max-h-40 tm:overflow-auto tm:text-[0.7rem] tm:break-all tm:whitespace-pre-wrap tm:text-light-grey
                "
              >
                {inputJson}
              </pre>
            </div>
          )}

          {isPermissionDenial && (
            <PermissionDeniedNote outputText={part.output?.text ?? ''} />
          )}

          {!isPermissionDenial && output.text && (
            <div className="tm:px-2 tm:py-1.5">
              <div
                className={cn('tm:mb-1 tm:text-[0.6rem] tm:tracking-wide', {
                  'tm:text-grey': !errored,
                  'tm:text-red': errored,
                })}
              >
                {errored ? 'ERROR' : 'OUTPUT'}
              </div>
              <pre
                className={cn(
                  'tm:max-h-60 tm:overflow-auto tm:text-[0.7rem] tm:break-all tm:whitespace-pre-wrap',
                  {
                    'tm:text-light-grey': !errored,
                    'tm:text-red': errored,
                  }
                )}
              >
                {output.text}
                {output.truncated && (
                  <span className="tm:mt-1 tm:block tm:text-grey">
                    …
                    {' '}
                    {output.total - OUTPUT_LINE_LIMIT}
                    {' '}
                    more lines
                  </span>
                )}
              </pre>
            </div>
          )}

          {!isPermissionDenial && !output.text && (pending
            ? (
              <div className="tm:px-2 tm:py-1.5 tm:text-[0.7rem] tm:text-grey">
                (waiting for output…)
              </div>
            )
            : (
              <div
                className={cn('tm:px-2 tm:py-1.5 tm:text-[0.7rem]', {
                  'tm:text-grey': !errored,
                  'tm:text-red': errored,
                })}
              >
                {errored ? '(no error message)' : '(no output)'}
              </div>
            ))}
        </div>
      )}
    </div>
  );
});
