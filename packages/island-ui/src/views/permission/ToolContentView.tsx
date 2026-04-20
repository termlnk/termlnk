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

import { cn } from '@termlnk/design';
import { DiffView } from './DiffView';

interface IToolContentViewProps {
  readonly toolName: string;
  readonly toolInput: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return `${str.slice(0, maxLen)}…`;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) {
    return String(val);
  }
  if (typeof val === 'string') {
    return val;
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

// ---------------------------------------------------------------------------
// Content styles (shared)
// ---------------------------------------------------------------------------

const CONTENT_CONTAINER_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  padding: '4px 6px',
  maxHeight: 90,
  fontSize: 9,
} as const;

// ---------------------------------------------------------------------------
// Bash
// ---------------------------------------------------------------------------

function BashContent({ toolInput }: { toolInput: Record<string, unknown> }) {
  const command = toolInput.command as string | undefined;
  const description = toolInput.description as string | undefined;

  return (
    <div
      className={cn('tm:overflow-auto tm:rounded-sm tm:font-mono')}
      style={CONTENT_CONTAINER_STYLE}
    >
      {command && (
        <div style={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>$ </span>
          {truncate(command, 500)}
        </div>
      )}
      {description && (
        <div style={{ color: 'rgba(255,255,255,0.35)', marginTop: 3, fontSize: 8 }}>
          {truncate(description, 200)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

function WriteContent({ toolInput }: { toolInput: Record<string, unknown> }) {
  const content = toolInput.content as string | undefined;

  return (
    <div
      className={cn('tm:overflow-auto tm:rounded-sm tm:font-mono')}
      style={CONTENT_CONTAINER_STYLE}
    >
      {content
        ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {truncate(content, 500)}
          </div>
        )
        : (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
            (empty)
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExitPlanMode
// ---------------------------------------------------------------------------

interface IAllowedPrompt {
  readonly tool: string;
  readonly prompt: string;
}

function ExitPlanModeContent({ toolInput }: { toolInput: Record<string, unknown> }) {
  const plan = toolInput.plan as string | undefined;
  const allowedPrompts = toolInput.allowedPrompts as IAllowedPrompt[] | undefined;

  return (
    <div
      className={cn('tm:flex tm:flex-col tm:gap-1 tm:overflow-auto tm:rounded-sm')}
      style={{ ...CONTENT_CONTAINER_STYLE, maxHeight: 110 }}
    >
      {plan && (
        <div
          className={cn('tm:font-mono')}
          style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
        >
          {truncate(plan, 400)}
        </div>
      )}
      {allowedPrompts && allowedPrompts.length > 0 && (
        <div className={cn('tm:flex tm:flex-wrap tm:gap-1')} style={{ marginTop: 2 }}>
          {allowedPrompts.map((p) => (
            <span
              key={`${p.tool}-${p.prompt}`}
              className={cn('tm:inline-flex tm:items-center tm:gap-0.5 tm:rounded-sm')}
              style={{
                fontSize: 8,
                padding: '1px 4px',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{p.tool}</span>
              {p.prompt}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Web (WebFetch / WebSearch)
// ---------------------------------------------------------------------------

function WebContent({ toolInput }: { toolInput: Record<string, unknown> }) {
  const url = toolInput.url as string | undefined;
  const query = toolInput.query as string | undefined;
  const prompt = toolInput.prompt as string | undefined;

  return (
    <div
      className={cn('tm:overflow-auto tm:rounded-sm tm:font-mono')}
      style={CONTENT_CONTAINER_STYLE}
    >
      {url && (
        <div style={{ color: 'rgba(255,255,255,0.6)', wordBreak: 'break-all' }}>
          {truncate(url, 300)}
        </div>
      )}
      {query && (
        <div style={{ color: 'rgba(255,255,255,0.6)', wordBreak: 'break-all' }}>
          {truncate(query, 300)}
        </div>
      )}
      {prompt && (
        <div style={{ color: 'rgba(255,255,255,0.35)', marginTop: 2, fontSize: 8 }}>
          {truncate(prompt, 200)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default (generic key-value)
// ---------------------------------------------------------------------------

/** Fields already handled by DiffView or shown in the header. */
const EXCLUDED_KEYS = new Set(['old_string', 'new_string', 'file_path']);

function DefaultContent({ toolInput }: { toolInput: Record<string, unknown> }) {
  const entries = Object.entries(toolInput).filter(([key]) => !EXCLUDED_KEYS.has(key));

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('tm:overflow-auto tm:rounded-sm tm:font-mono')}
      style={CONTENT_CONTAINER_STYLE}
    >
      {entries.map(([key, val]) => (
        <div
          key={key}
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>
            {key}
            :
            {' '}
          </span>
          {truncate(formatValue(val), 200)}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export function ToolContentView({ toolName, toolInput }: IToolContentViewProps) {
  switch (toolName) {
    case 'Edit':
      return (
        <DiffView
          oldString={toolInput.old_string as string}
          newString={toolInput.new_string as string}
        />
      );
    case 'Bash':
      return <BashContent toolInput={toolInput} />;
    case 'Write':
      return <WriteContent toolInput={toolInput} />;
    case 'ExitPlanMode':
      return <ExitPlanModeContent toolInput={toolInput} />;
    case 'WebFetch':
    case 'WebSearch':
      return <WebContent toolInput={toolInput} />;
    default:
      return <DefaultContent toolInput={toolInput} />;
  }
}
