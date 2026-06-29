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

export type MobileChatRole = 'user' | 'assistant' | 'system';
export type MobileAgentStatus = 'idle' | 'thinking' | 'streaming' | 'error';

export interface ITextPart {
  readonly type: 'text';
  readonly text: string;
}

export interface IThinkingPart {
  readonly type: 'thinking';
  readonly thinking: string;
}

export interface IErrorPart {
  readonly type: 'error';
  readonly message: string;
}

export interface IImagePart {
  readonly type: 'image';
  readonly data: string;
  readonly mimeType: string;
}

export type IMobileMessagePart = ITextPart | IThinkingPart | IErrorPart | IImagePart;

export type MobileThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface IMobileImageAttachment {
  readonly data: string;
  readonly mimeType: string;
}

export interface IMobileSendMessageOptions {
  readonly images?: readonly IMobileImageAttachment[];
}

export interface IChatUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface IMobileChatMessage {
  readonly id: string;
  readonly role: MobileChatRole;
  readonly parts: readonly IMobileMessagePart[];
  readonly isStreaming?: boolean;
  readonly usage?: IChatUsage;
  readonly createdAt: number;
}
