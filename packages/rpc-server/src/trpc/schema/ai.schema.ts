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

import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z.string().min(1),
  images: z.array(z.object({
    data: z.string(),
    mimeType: z.string(),
  })).optional(),
  deliverAs: z.enum(['auto', 'steer', 'followUp']).optional(),
});

export const cancelPendingSchema = z.object({
  messageId: z.string().min(1),
});

export const retryMessageSchema = z.object({
  messageId: z.string().min(1),
});

export const editUserMessageSchema = z.object({
  messageId: z.string().min(1),
  content: z.string().min(1),
});

export const invokeToolSchema = z.object({
  toolName: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
});

export const setModelSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
});

export const setApiKeySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string(),
});

export const setSystemPromptSchema = z.object({
  prompt: z.string(),
});

export const setThinkingLevelSchema = z.object({
  level: z.enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh']),
});

export const setActiveModelSchema = z.object({
  modelId: z.string().min(1),
});

export const addProviderSchema = z.object({
  providerId: z.string().min(1),
  name: z.string().optional(),
  enabled: z.boolean().default(true),
  api: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  sort: z.number().optional(),
});

export const removeProviderSchema = z.object({
  providerId: z.string().min(1),
});

export const updateProviderConfigSchema = z.object({
  providerId: z.string().min(1),
  patch: z.object({
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    api: z.string().optional(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    sort: z.number().optional(),
  }),
});

export const getProviderConfigSchema = z.object({
  providerId: z.string().min(1),
});

export const refreshProviderModelsSchema = z.object({
  providerId: z.string().min(1),
});

export const testProviderModelSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});

export const toggleModelSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  enabled: z.boolean(),
});

export const updateModelOverridesSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  overrides: z.object({
    name: z.string().optional(),
    maxTokens: z.number().optional(),
    contextWindow: z.number().optional(),
    reasoning: z.boolean().optional(),
    input: z.array(z.enum(['text', 'image'])).optional(),
    cost: z.object({
      input: z.number().optional(),
      output: z.number().optional(),
      cacheRead: z.number().optional(),
      cacheWrite: z.number().optional(),
    }).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    compat: z.any().optional(),
  }),
});

export const resetModelOverridesSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});

export const addCustomModelSchema = z.object({
  providerId: z.string().min(1),
  model: z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    api: z.string().optional(),
    baseUrl: z.string().optional(),
    reasoning: z.boolean().optional(),
    input: z.array(z.enum(['text', 'image'])).optional(),
    cost: z.object({
      input: z.number(),
      output: z.number(),
      cacheRead: z.number(),
      cacheWrite: z.number(),
    }).optional(),
    contextWindow: z.number().optional(),
    maxTokens: z.number().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    compat: z.any().optional(),
  }),
});

export const removeCustomModelSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});

export const compactConversationSchema = z.object({
  trigger: z.enum(['manual', 'auto']),
  instructions: z.string().optional(),
});
