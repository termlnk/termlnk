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

import type { SessionUpdate } from '@agentclientprotocol/sdk';
import { describe, expect, it } from 'vitest';
import {
  createTranslatorState,
  reduceStreamEvents,
  translateSessionUpdate,
} from '../services/session/translate/session-update';

const NOW = 1_700_000_000_000;
let seq = 0;
const newId = () => `id-${++seq}`;

function translate(update: SessionUpdate, state = createTranslatorState()) {
  return translateSessionUpdate(update, state, { now: NOW, newId });
}

describe('translateSessionUpdate', () => {
  it('streams agent text chunks into one assistant message', () => {
    const state = createTranslatorState();
    const e1 = translate({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'Hello' },
    }, state);
    const e2 = translate({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: ' world' },
    }, state);

    const messages = reduceStreamEvents([], [...e1, ...e2]);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].parts).toEqual([{ type: 'text', text: 'Hello world' }]);
  });

  it('maps tool_call and tool_call_update by toolCallId', () => {
    const state = createTranslatorState();
    const created = translate({
      sessionUpdate: 'tool_call',
      toolCallId: 't1',
      title: 'Read file',
      name: 'Read',
      status: 'pending',
      rawInput: { path: '/tmp/a.ts' },
    }, state);
    const updated = translate({
      sessionUpdate: 'tool_call_update',
      toolCallId: 't1',
      status: 'completed',
      content: [
        {
          type: 'diff',
          path: '/tmp/a.ts',
          oldText: 'a',
          newText: 'b',
        },
      ],
    }, state);

    const messages = reduceStreamEvents([], [...created, ...updated]);
    expect(messages).toHaveLength(1);
    const tool = messages[0].parts.find((p) => p.type === 'tool');
    expect(tool).toMatchObject({
      type: 'tool',
      toolCallId: 't1',
      toolName: 'Read',
      state: 'output-available',
      output: {
        diff: [{ path: '/tmp/a.ts', oldText: 'a', newText: 'b' }],
      },
    });
  });

  it('maps plan updates to IPlanPart', () => {
    const state = createTranslatorState();
    const events = translate({
      sessionUpdate: 'plan',
      entries: [
        { content: 'Inspect', priority: 'high', status: 'in_progress' },
        { content: 'Fix', priority: 'medium', status: 'pending' },
      ],
    }, state);

    const messages = reduceStreamEvents([], events);
    expect(messages[0].parts).toContainEqual({
      type: 'plan',
      entries: [
        { content: 'Inspect', priority: 'high', status: 'in_progress' },
        { content: 'Fix', priority: 'medium', status: 'pending' },
      ],
    });
  });

  it('emits mode and commands as session meta events', () => {
    const mode = translate({
      sessionUpdate: 'current_mode_update',
      currentModeId: 'plan',
    });
    expect(mode).toEqual([{ type: 'mode_update', currentModeId: 'plan' }]);

    const cmds = translate({
      sessionUpdate: 'available_commands_update',
      availableCommands: [
        { name: 'compact', description: 'Compact history', input: { hint: 'optional note' } },
      ],
    });
    expect(cmds).toEqual([{
      type: 'commands_update',
      commands: [{ name: 'compact', description: 'Compact history', inputHint: 'optional note' }],
    }]);
  });

  it('replays user_message_chunk into a user message', () => {
    const state = createTranslatorState();
    const events = translate({
      sessionUpdate: 'user_message_chunk',
      content: { type: 'text', text: 'hi' },
    }, state);
    const messages = reduceStreamEvents([], events);
    expect(messages).toEqual([{
      id: expect.any(String),
      role: 'user',
      parts: [{ type: 'text', text: 'hi' }],
      createdAt: NOW,
    }]);
  });
});
