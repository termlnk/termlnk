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

export type MobileApiType =
  | 'openai-completions'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'google-generative-ai'
  | 'google-vertex'
  | 'azure-openai-responses'
  | 'bedrock-converse-stream';

export interface IMobileProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly builtin: boolean;
  readonly api: MobileApiType;
  readonly baseUrl?: string;
  readonly headers?: Record<string, string>;
  readonly sort: number;
}

export interface IMobileModelConfig {
  readonly id: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly reasoning: boolean;
  readonly contextWindow: number;
  readonly maxTokens: number;
}

export interface IMobileProviderGroup {
  readonly provider: IMobileProviderConfig;
  readonly models: readonly IMobileModelConfig[];
}

export interface IKnownProviderTemplate {
  readonly id: string;
  readonly name: string;
  readonly api: MobileApiType;
  readonly defaultBaseUrl?: string;
  readonly models: readonly IKnownModelSeed[];
}

export interface IKnownModelSeed {
  readonly modelId: string;
  readonly name: string;
  readonly reasoning: boolean;
  readonly contextWindow: number;
  readonly maxTokens: number;
}

export const KNOWN_PROVIDER_TEMPLATES: readonly IKnownProviderTemplate[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      { modelId: 'gpt-5.5', name: 'GPT-5.5', reasoning: true, contextWindow: 272_000, maxTokens: 128_000 },
      { modelId: 'gpt-5.5-pro', name: 'GPT-5.5 Pro', reasoning: true, contextWindow: 1_050_000, maxTokens: 128_000 },
      { modelId: 'gpt-5.4', name: 'GPT-5.4', reasoning: true, contextWindow: 272_000, maxTokens: 128_000 },
      { modelId: 'gpt-5.4-mini', name: 'GPT-5.4 mini', reasoning: true, contextWindow: 400_000, maxTokens: 128_000 },
      { modelId: 'gpt-5.4-nano', name: 'GPT-5.4 nano', reasoning: true, contextWindow: 400_000, maxTokens: 128_000 },
      { modelId: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', reasoning: true, contextWindow: 1_050_000, maxTokens: 128_000 },
      { modelId: 'gpt-5', name: 'GPT-5', reasoning: true, contextWindow: 400_000, maxTokens: 128_000 },
      { modelId: 'gpt-5-mini', name: 'GPT-5 Mini', reasoning: true, contextWindow: 400_000, maxTokens: 128_000 },
      { modelId: 'gpt-5-pro', name: 'GPT-5 Pro', reasoning: true, contextWindow: 400_000, maxTokens: 128_000 },
      { modelId: 'gpt-4.1', name: 'GPT-4.1', reasoning: false, contextWindow: 1_047_576, maxTokens: 32_768 },
      { modelId: 'gpt-4.1-mini', name: 'GPT-4.1 mini', reasoning: false, contextWindow: 1_047_576, maxTokens: 32_768 },
      { modelId: 'gpt-4.1-nano', name: 'GPT-4.1 nano', reasoning: false, contextWindow: 1_047_576, maxTokens: 32_768 },
      { modelId: 'gpt-4o', name: 'GPT-4o', reasoning: false, contextWindow: 128_000, maxTokens: 16_384 },
      { modelId: 'gpt-4o-mini', name: 'GPT-4o mini', reasoning: false, contextWindow: 128_000, maxTokens: 16_384 },
      { modelId: 'o4-mini', name: 'o4-mini', reasoning: true, contextWindow: 200_000, maxTokens: 100_000 },
      { modelId: 'o3', name: 'o3', reasoning: true, contextWindow: 200_000, maxTokens: 100_000 },
      { modelId: 'o3-mini', name: 'o3-mini', reasoning: true, contextWindow: 200_000, maxTokens: 100_000 },
      { modelId: 'o3-pro', name: 'o3-pro', reasoning: true, contextWindow: 200_000, maxTokens: 100_000 },
      { modelId: 'o1', name: 'o1', reasoning: true, contextWindow: 200_000, maxTokens: 100_000 },
      { modelId: 'o1-pro', name: 'o1-pro', reasoning: true, contextWindow: 200_000, maxTokens: 100_000 },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    api: 'anthropic-messages',
    defaultBaseUrl: 'https://api.anthropic.com',
    models: [
      { modelId: 'claude-opus-4-8', name: 'Claude Opus 4.8', reasoning: true, contextWindow: 1_000_000, maxTokens: 128_000 },
      { modelId: 'claude-opus-4-7', name: 'Claude Opus 4.7', reasoning: true, contextWindow: 1_000_000, maxTokens: 128_000 },
      { modelId: 'claude-opus-4-6', name: 'Claude Opus 4.6', reasoning: true, contextWindow: 1_000_000, maxTokens: 128_000 },
      { modelId: 'claude-opus-4-5', name: 'Claude Opus 4.5', reasoning: true, contextWindow: 200_000, maxTokens: 64_000 },
      { modelId: 'claude-opus-4-1', name: 'Claude Opus 4.1', reasoning: true, contextWindow: 200_000, maxTokens: 32_000 },
      { modelId: 'claude-opus-4-0', name: 'Claude Opus 4', reasoning: true, contextWindow: 200_000, maxTokens: 32_000 },
      { modelId: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', reasoning: true, contextWindow: 1_000_000, maxTokens: 64_000 },
      { modelId: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', reasoning: true, contextWindow: 200_000, maxTokens: 64_000 },
      { modelId: 'claude-sonnet-4-0', name: 'Claude Sonnet 4', reasoning: true, contextWindow: 200_000, maxTokens: 64_000 },
      { modelId: 'claude-fable-5', name: 'Claude Fable 5', reasoning: true, contextWindow: 1_000_000, maxTokens: 128_000 },
      { modelId: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', reasoning: true, contextWindow: 200_000, maxTokens: 64_000 },
      { modelId: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7', reasoning: true, contextWindow: 200_000, maxTokens: 64_000 },
      { modelId: 'claude-3-5-sonnet-20241022', name: 'Claude Sonnet 3.5 v2', reasoning: false, contextWindow: 200_000, maxTokens: 8_192 },
      { modelId: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5', reasoning: false, contextWindow: 200_000, maxTokens: 8_192 },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: [
      { modelId: 'deepseek-chat', name: 'DeepSeek Chat', reasoning: false, contextWindow: 128_000, maxTokens: 8_192 },
      { modelId: 'deepseek-reasoner', name: 'DeepSeek Reasoner', reasoning: true, contextWindow: 64_000, maxTokens: 8_192 },
    ],
  },
  {
    id: 'moonshotai',
    name: 'Moonshot AI',
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.moonshot.ai/v1',
    models: [
      { modelId: 'moonshot-v1-8k', name: 'Moonshot v1 8K', reasoning: false, contextWindow: 8_000, maxTokens: 4_096 },
      { modelId: 'moonshot-v1-32k', name: 'Moonshot v1 32K', reasoning: false, contextWindow: 32_000, maxTokens: 16_384 },
      { modelId: 'moonshot-v1-128k', name: 'Moonshot v1 128K', reasoning: false, contextWindow: 128_000, maxTokens: 16_384 },
    ],
  },
  {
    id: 'moonshotai-cn',
    name: 'Moonshot AI 中国版',
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    models: [
      { modelId: 'moonshot-v1-8k', name: 'Moonshot v1 8K', reasoning: false, contextWindow: 8_000, maxTokens: 4_096 },
      { modelId: 'moonshot-v1-32k', name: 'Moonshot v1 32K', reasoning: false, contextWindow: 32_000, maxTokens: 16_384 },
      { modelId: 'moonshot-v1-128k', name: 'Moonshot v1 128K', reasoning: false, contextWindow: 128_000, maxTokens: 16_384 },
    ],
  },
  {
    id: 'xai',
    name: 'xAI',
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.x.ai/v1',
    models: [
      { modelId: 'grok-4.3', name: 'Grok 4.3', reasoning: true, contextWindow: 1_000_000, maxTokens: 30_000 },
      { modelId: 'grok-3', name: 'Grok 3', reasoning: false, contextWindow: 131_072, maxTokens: 8_192 },
      { modelId: 'grok-3-fast', name: 'Grok 3 Fast', reasoning: false, contextWindow: 131_072, maxTokens: 8_192 },
      { modelId: 'grok-build-0.1', name: 'Grok Build 0.1', reasoning: true, contextWindow: 256_000, maxTokens: 256_000 },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { modelId: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', reasoning: false, contextWindow: 131_072, maxTokens: 32_768 },
      { modelId: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', reasoning: false, contextWindow: 131_072, maxTokens: 131_072 },
      { modelId: 'qwen/qwen3-32b', name: 'Qwen3 32B', reasoning: true, contextWindow: 131_072, maxTokens: 40_960 },
    ],
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    models: [
      { modelId: 'llama-3.3-70b', name: 'Llama 3.3 70B', reasoning: false, contextWindow: 128_000, maxTokens: 8_192 },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    models: [
      { modelId: 'mistral-large-latest', name: 'Mistral Large', reasoning: false, contextWindow: 262_144, maxTokens: 262_144 },
      { modelId: 'mistral-medium-latest', name: 'Mistral Medium', reasoning: false, contextWindow: 262_144, maxTokens: 262_144 },
      { modelId: 'mistral-small-latest', name: 'Mistral Small', reasoning: true, contextWindow: 256_000, maxTokens: 256_000 },
      { modelId: 'codestral-latest', name: 'Codestral', reasoning: false, contextWindow: 256_000, maxTokens: 4_096 },
      { modelId: 'devstral-latest', name: 'Devstral', reasoning: false, contextWindow: 262_144, maxTokens: 262_144 },
      { modelId: 'magistral-medium-latest', name: 'Magistral Medium', reasoning: true, contextWindow: 128_000, maxTokens: 16_384 },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    api: 'openai-completions',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    models: [],
  },
  {
    id: 'vercel-ai-gateway',
    name: 'Vercel AI Gateway',
    api: 'openai-completions',
    defaultBaseUrl: 'https://ai-gateway.vercel.sh',
    models: [],
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.fireworks.ai/inference',
    models: [],
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    api: 'openai-completions',
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    models: [],
  },
  {
    id: 'cloudflare-ai-gateway',
    name: 'Cloudflare AI Gateway',
    api: 'openai-completions',
    models: [],
  },
  {
    id: 'cloudflare-workers-ai',
    name: 'Cloudflare Workers AI',
    api: 'openai-completions',
    models: [],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    api: 'openai-completions',
    models: [],
  },
  {
    id: 'minimax-cn',
    name: 'MiniMax 中国版',
    api: 'openai-completions',
    models: [],
  },
] as const;
