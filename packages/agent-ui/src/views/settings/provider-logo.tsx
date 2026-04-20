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
import { AiHubMix, Anthropic, Antigravity, AzureAI, Bedrock, Cerebras, Claude, DeepSeek, Gemini, GithubCopilot, Groq, HuggingFace, Minimax, Mistral, Moonshot, OpenAI, OpenCode, OpenRouter, Vercel, VertexAI, XAI, ZAI } from '@termlnk/design';
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
  'amazon-bedrock': Bedrock,
  anthropic: Anthropic,
  aihubmix: AiHubMix,
  cerebras: Cerebras,
  claude: Claude,
  deepseek: DeepSeek,
  'github-copilot': GithubCopilot,
  google: Gemini,
  groq: Groq,
  huggingface: HuggingFace,
  minimax: Minimax,
  'minimax-cn': Minimax,
  moonshot: Moonshot,
  openai: OpenAI,
  opencode: OpenCode,
  'opencode-go': OpenCode,
  openrouter: OpenRouter,
  xai: XAI,
  zai: ZAI,
  'azure-openai': AzureAI,
  'vercel-ai-gateway': Vercel,
  mistral: Mistral,
  'google-vertex': VertexAI,
  'google-antigravity': Antigravity,
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
    return 'moonshot';
  }

  if (normalizedId.includes('claude')) {
    return 'anthropic';
  }

  if (normalizedId === 'zai' || normalizedId.startsWith('zai-')) {
    return 'zai';
  }

  if (normalizedId === 'openai' || normalizedId.startsWith('openai-')) {
    return 'openai';
  }

  if (normalizedId === 'google' || normalizedId.startsWith('google-')) {
    return 'google';
  }

  if (normalizedId.startsWith('azure-openai')) {
    return 'azure-openai';
  }

  return normalizedId;
}

export function ProviderLogo({ className, providerId }: IProviderBrandLogoProps): ReactElement {
  const providerLogoKey = resolveProviderLogoKey(providerId);
  const LogoComponent = PROVIDER_LOGOS[providerLogoKey] ?? DEFAULT_PROVIDER_LOGO;
  return <LogoComponent className={className} />;
}
