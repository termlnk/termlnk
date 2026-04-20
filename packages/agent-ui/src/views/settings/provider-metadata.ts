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

const COMMON_PROVIDER_PRIORITY: Record<string, number> = {
  openai: 0,
  deepseek: 1,
  moonshot: 2,
  kimi: 2,
  'kimi-coding': 2,
  zai: 3,
  anthropic: 4,
  google: 5,
  aihubmix: 6,
  openrouter: 7,
  'azure-openai-responses': 8,
  'github-copilot': 9,
  minimax: 10,
  'minimax-cn': 10,
};

const DEFAULT_PROVIDER_BASE_URL: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  cerebras: 'https://api.cerebras.ai/v1',
  xai: 'https://api.x.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
  huggingface: 'https://router.huggingface.co/v1',
  'vercel-ai-gateway': 'https://ai-gateway.vercel.sh',
};

function getProviderPriority(providerId: string): number {
  const normalizedId = providerId.toLowerCase();

  if (COMMON_PROVIDER_PRIORITY[normalizedId] !== undefined) {
    return COMMON_PROVIDER_PRIORITY[normalizedId];
  }

  if (normalizedId.includes('moonshot') || normalizedId.includes('kimi')) {
    return 2;
  }

  if (normalizedId.includes('minimax')) {
    return 3;
  }

  if (normalizedId === 'zai' || normalizedId.startsWith('zai-')) {
    return 4;
  }

  return Number.MAX_SAFE_INTEGER;
}

export function compareProviders(a: { id: string; name: string }, b: { id: string; name: string }): number {
  const priorityDiff = getProviderPriority(a.id) - getProviderPriority(b.id);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return a.name.localeCompare(b.name, 'zh-Hans-CN');
}

export function getDefaultProviderBaseUrl(providerId: string): string | undefined {
  return DEFAULT_PROVIDER_BASE_URL[providerId];
}
