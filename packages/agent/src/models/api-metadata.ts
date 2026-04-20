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

import type { KnownApi } from '@mariozechner/pi-ai';

export interface IApiTypeMetadata {
  id: KnownApi;
  name: string;
  description: string;
}

export const KNOWN_API_TYPES: IApiTypeMetadata[] = [
  { id: 'openai-completions', name: 'OpenAI Completions', description: 'OpenAI Chat Completions API (兼容 DeepSeek, Groq, Ollama 等)' },
  { id: 'openai-responses', name: 'OpenAI Responses', description: 'OpenAI Responses API (GPT-5, o3 等)' },
  { id: 'anthropic-messages', name: 'Anthropic Messages', description: 'Anthropic Messages API (Claude 系列)' },
  { id: 'google-generative-ai', name: 'Google Generative AI', description: 'Google Gemini API' },
  { id: 'google-vertex', name: 'Google Vertex AI', description: 'Google Vertex AI API' },
  { id: 'azure-openai-responses', name: 'Azure OpenAI', description: 'Azure OpenAI Responses API' },
  { id: 'bedrock-converse-stream', name: 'Amazon Bedrock', description: 'AWS Bedrock Converse Stream API' },
];
