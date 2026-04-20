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

import type { ICompactMetadata } from './compact';

export type ChatRole = 'user' | 'assistant' | 'system' | 'compact_boundary';

export type ToolCallStatus = 'running' | 'success' | 'error';

export type AgentStatus = 'idle' | 'thinking' | 'tool_calling' | 'streaming' | 'error' | 'compacting';

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface IChatToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: ToolCallStatus;
  error?: string;
}

export interface IChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface IImageAttachment {
  data: string;
  mimeType: string;
}

export type MessageDeliveryMode = 'auto' | 'steer' | 'followUp';

export interface ISendMessageOptions {
  images?: IImageAttachment[];
  deliverAs?: MessageDeliveryMode;
}

export interface IChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  thinking?: string;
  toolCalls?: IChatToolCall[];
  images?: IImageAttachment[];
  isStreaming?: boolean;
  error?: string;
  usage?: IChatUsage;
  createdAt: number;
  compactMetadata?: ICompactMetadata;
  hiddenInUI?: boolean;
}

export interface IAgentConfig {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  thinkingLevel?: ThinkingLevel;
}
