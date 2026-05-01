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

const FALLBACK_PROVIDER_SORT = 50;

export const DEFAULT_PROVIDER_SORT: Record<string, number> = {
  openai: 1,
  anthropic: 2,
  google: 3,
  deepseek: 4,
  'kimi-coding': 5,
  moonshotai: 6,
  'moonshotai-cn': 7,
  zai: 8,
  xai: 9,
  groq: 10,
  cerebras: 11,
  mistral: 12,
  openrouter: 20,
  'vercel-ai-gateway': 21,
  'cloudflare-ai-gateway': 22,
  'cloudflare-workers-ai': 23,
  fireworks: 24,
  huggingface: 25,
  minimax: 26,
  'minimax-cn': 27,
  'azure-openai-responses': 30,
  'amazon-bedrock': 31,
  'google-vertex': 32,
  'github-copilot': 33,
  'openai-codex': 34,
  opencode: 35,
  'opencode-go': 36,
};

export const PROVIDER_DISPLAY_NAME: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  deepseek: 'DeepSeek',
  'kimi-coding': 'Kimi For Coding',
  moonshotai: 'Moonshot AI',
  'moonshotai-cn': 'Moonshot AI 中国版',
  zai: 'Z.AI Coding Plan',
  xai: 'xAI',
  groq: 'Groq',
  cerebras: 'Cerebras',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
  'vercel-ai-gateway': 'Vercel AI Gateway',
  'cloudflare-ai-gateway': 'Cloudflare AI Gateway',
  'cloudflare-workers-ai': 'Cloudflare Workers AI',
  fireworks: 'Fireworks',
  huggingface: 'Hugging Face',
  minimax: 'MiniMax',
  'minimax-cn': 'MiniMax 中国版',
  'azure-openai-responses': 'Azure OpenAI',
  'amazon-bedrock': 'Amazon Bedrock',
  'google-vertex': 'Google Vertex AI',
  'github-copilot': 'GitHub Copilot',
  'openai-codex': 'OpenAI Codex',
  opencode: 'OpenCode',
  'opencode-go': 'OpenCode Go',
  aihubmix: 'AiHubMix',
};

export const DEFAULT_PROVIDER_BASE_URL: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  moonshotai: 'https://api.moonshot.ai/v1',
  'moonshotai-cn': 'https://api.moonshot.cn/v1',
  fireworks: 'https://api.fireworks.ai/inference',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  xai: 'https://api.x.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
  huggingface: 'https://router.huggingface.co/v1',
  'vercel-ai-gateway': 'https://ai-gateway.vercel.sh',
};

export const UNSUPPORTED_MODEL_SYNC_PROVIDERS = new Set<string>([
  'amazon-bedrock',
  'azure-openai-responses',
  'cloudflare-ai-gateway',
  'cloudflare-workers-ai',
  'github-copilot',
  'google-vertex',
  'openai-codex',
  'opencode',
  'opencode-go',
  'kimi-coding',
  'zai',
  'minimax',
  'minimax-cn',
]);

export function formatProviderDisplayName(providerId: string): string {
  const normalized = providerId.trim().toLowerCase();
  const mapped = PROVIDER_DISPLAY_NAME[normalized];
  if (mapped) {
    return mapped;
  }

  return providerId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getDefaultProviderBaseUrl(providerId: string): string | undefined {
  return DEFAULT_PROVIDER_BASE_URL[providerId];
}

export function getDefaultProviderSort(providerId: string): number {
  return DEFAULT_PROVIDER_SORT[providerId] ?? FALLBACK_PROVIDER_SORT;
}

export function compareProviders(
  a: { id: string; name: string },
  b: { id: string; name: string }
): number {
  const sortDiff = getDefaultProviderSort(a.id) - getDefaultProviderSort(b.id);
  if (sortDiff !== 0) {
    return sortDiff;
  }

  return a.name.localeCompare(b.name, 'zh-Hans-CN');
}
