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

import type { Agent, AgentTool } from '@earendil-works/pi-agent-core';
import type { Model } from '@earendil-works/pi-ai';
import { getInitialSystemMessage } from '@earendil-works/pi-ai';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AIAgentService } from './ai-agent.service';

const noopLog = {
  debug: () => {},
  log: () => {},
  warn: () => {},
  error: () => {},
  deprecate: () => {},
  setLogLevel: () => {},
};

const FAKE_MODEL = {
  id: 'fake-model',
  name: 'Fake',
  api: 'openai-completions',
  provider: 'fake',
  baseUrl: 'http://127.0.0.1',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1000,
  maxTokens: 100,
} as unknown as Model<any>;

const FAKE_TOOL = {
  name: 'echo',
  label: 'Echo',
  description: 'Echo input',
  parameters: { type: 'object', properties: {} },
  execute: async () => ({ content: [{ type: 'text', text: 'ok' }], details: {} }),
} as unknown as AgentTool<any>;

function createService(): AIAgentService {
  const llmProvider = {
    resolveModel: () => FAKE_MODEL,
    getProviderConfig: () => null,
    streamSimple: () => {
      throw new Error('streamSimple must not be called in these tests');
    },
  };
  const chatRepository = {
    changed$: new Subject(),
    createSession: async () => {},
  };
  const permission = { pendingRequests$: new Subject() };
  return new AIAgentService(llmProvider as any, chatRepository as any, permission as any, noopLog as any);
}

function ensureAgent(service: AIAgentService): Agent {
  return (service as any)._ensureAgent() as Agent;
}

function systemContents(agent: Agent): unknown[] {
  return agent.state.messages.filter((m) => m.role === 'system').map((m) => m.content);
}

describe('AIAgentService system prompt', () => {
  it('seeds a new agent with the configured prompt as the leading system message', () => {
    const service = createService();
    service.setModel('fake', 'fake-model');
    service.setSystemPrompt('PROMPT-A');

    const agent = ensureAgent(service);

    expect(getInitialSystemMessage(agent.state.messages)?.content).toBe('PROMPT-A');
    expect(agent.state.systemPrompt).toBe('PROMPT-A');
  });

  it('rewrites the leading system message of a live agent and keeps the rest of the transcript', () => {
    const service = createService();
    service.setModel('fake', 'fake-model');
    service.setTools([FAKE_TOOL]);
    service.setSystemPrompt('PROMPT-A');
    const agent = ensureAgent(service);
    const userMessage = { role: 'user' as const, content: 'hi', timestamp: 1 };
    agent.state.messages = [...agent.state.messages, userMessage];
    const toolsBefore = getInitialSystemMessage(agent.state.messages)?.toolsAdded;
    expect(toolsBefore?.map((t) => t.name)).toEqual(['echo']);

    expect(() => service.setSystemPrompt('PROMPT-B')).not.toThrow();

    expect(agent.state.systemPrompt).toBe('PROMPT-B');
    expect(systemContents(agent)).toEqual(['PROMPT-B']);
    expect(getInitialSystemMessage(agent.state.messages)?.toolsAdded).toEqual(toolsBefore);
    expect(agent.state.messages.at(-1)).toBe(userMessage);
  });

  it('prepends a system message when the live agent has none', () => {
    const service = createService();
    service.setModel('fake', 'fake-model');
    const agent = ensureAgent(service);
    expect(agent.state.messages).toEqual([]);

    service.setSystemPrompt('PROMPT-B');

    expect(systemContents(agent)).toEqual(['PROMPT-B']);
  });
});

describe('AIAgentService agent message persistence', () => {
  it('drops system messages when carrying the transcript across abort, so a rebuilt agent uses the current prompt', () => {
    const service = createService();
    service.setModel('fake', 'fake-model');
    service.setSystemPrompt('PROMPT-A');
    const agent = ensureAgent(service);
    const userMessage = { role: 'user' as const, content: 'hi', timestamp: 1 };
    agent.state.messages = [...agent.state.messages, userMessage];

    service.abort();

    expect((service as any)._agent).toBeNull();
    expect((service as any)._savedAgentMessages).toEqual([userMessage]);

    service.setSystemPrompt('PROMPT-B');
    const rebuilt = ensureAgent(service);

    expect(rebuilt).not.toBe(agent);
    expect(systemContents(rebuilt)).toEqual(['PROMPT-B']);
    expect(rebuilt.state.messages.at(-1)).toEqual(userMessage);
  });
});

describe('AIAgentService session switching', () => {
  it('discards the agent and its saved transcript instead of resetting it', async () => {
    const service = createService();
    service.setModel('fake', 'fake-model');
    service.setSystemPrompt('PROMPT-A');
    const agent = ensureAgent(service);
    agent.state.messages = [...agent.state.messages, { role: 'user', content: 'hi', timestamp: 1 }];
    // Agent.reset() throws while a run is active and keeps the system message; switching must not depend on it.
    agent.reset = () => {
      throw new Error('reset must not be used');
    };

    await expect(service.createNewSession()).resolves.toEqual(expect.any(String));

    expect((service as any)._agent).toBeNull();
    expect((service as any)._savedAgentMessages).toEqual([]);

    service.setSystemPrompt('PROMPT-B');
    const fresh = ensureAgent(service);
    expect(systemContents(fresh)).toEqual(['PROMPT-B']);
    expect(fresh.state.messages.filter((m) => m.role !== 'system')).toEqual([]);
  });
});
