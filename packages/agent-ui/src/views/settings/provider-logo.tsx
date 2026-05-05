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

import type { ComponentType, ReactElement } from 'react';
import { AiHubMix, Anthropic, AzureAI, Bedrock, Cerebras, Claude, Cloudflare, DeepSeek, Fireworks, Gemini, GithubCopilot, Groq, HuggingFace, Kimi, Minimax, Mistral, Moonshot, OpenAI, OpenCode, OpenRouter, Vercel, VertexAI, XAI, XiaomiMiMo, ZAI } from '@termlnk/design';
import { Sparkles } from 'lucide-react';

export interface IProviderLogoProps {
  className?: string;
}

export interface IProviderBrandLogoProps extends IProviderLogoProps {
  providerId: string;
}

export type ProviderLogoComponent = ComponentType<IProviderLogoProps>;

const DEFAULT_PROVIDER_LOGO: ProviderLogoComponent = ({ className }) => (
  <Sparkles className={className} strokeWidth={1.9} />
);

const PROVIDER_LOGOS: Record<string, ProviderLogoComponent> = {
  openai: OpenAI,
  anthropic: Anthropic,
  claude: Claude,
  google: Gemini,
  'google-vertex': VertexAI,
  deepseek: DeepSeek,
  'kimi-coding': Kimi,
  moonshotai: Moonshot,
  'moonshotai-cn': Moonshot,
  zai: ZAI,
  xai: XAI,
  groq: Groq,
  cerebras: Cerebras,
  mistral: Mistral,
  openrouter: OpenRouter,
  'vercel-ai-gateway': Vercel,
  'cloudflare-ai-gateway': Cloudflare,
  'cloudflare-workers-ai': Cloudflare,
  fireworks: Fireworks,
  huggingface: HuggingFace,
  minimax: Minimax,
  'minimax-cn': Minimax,
  'azure-openai-responses': AzureAI,
  'amazon-bedrock': Bedrock,
  'github-copilot': GithubCopilot,
  opencode: OpenCode,
  'opencode-go': OpenCode,
  aihubmix: AiHubMix,
  xiaomi: XiaomiMiMo,
  'xiaomi-token-plan-cn': XiaomiMiMo,
  'xiaomi-token-plan-ams': XiaomiMiMo,
  'xiaomi-token-plan-sgp': XiaomiMiMo,
};

function resolveProviderLogoKey(providerId: string): string {
  const normalizedId = providerId.toLowerCase();

  if (PROVIDER_LOGOS[normalizedId]) {
    return normalizedId;
  }

  if (normalizedId.includes('deepseek')) {
    return 'deepseek';
  }

  if (normalizedId.includes('moonshot') || normalizedId.includes('kimi')) {
    return 'moonshotai';
  }

  if (normalizedId.includes('claude')) {
    return 'anthropic';
  }

  if (normalizedId.includes('cloudflare')) {
    return 'cloudflare-ai-gateway';
  }

  if (normalizedId.includes('fireworks')) {
    return 'fireworks';
  }

  if (normalizedId.startsWith('zai-')) {
    return 'zai';
  }

  if (normalizedId.startsWith('openai-')) {
    return 'openai';
  }

  if (normalizedId.startsWith('google-')) {
    return 'google';
  }

  if (normalizedId.startsWith('azure-openai')) {
    return 'azure-openai-responses';
  }

  if (normalizedId.startsWith('xiaomi')) {
    return 'xiaomi';
  }

  return normalizedId;
}

export function ProviderLogo({ className, providerId }: IProviderBrandLogoProps): ReactElement {
  const providerLogoKey = resolveProviderLogoKey(providerId);
  const LogoComponent = PROVIDER_LOGOS[providerLogoKey] ?? DEFAULT_PROVIDER_LOGO;
  return <LogoComponent className={className} />;
}
