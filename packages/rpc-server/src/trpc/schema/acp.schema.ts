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

export const createACPSessionSchema = z.object({
  providerId: z.string().min(1),
  /** Empty string is allowed; main process falls back to homedir. */
  cwd: z.string(),
  sessionId: z.string().optional(),
  nativeSessionId: z.string().optional(),
  hostId: z.string().optional(),
});

export const promptBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('image'),
    image: z.object({
      data: z.string(),
      mimeType: z.string(),
    }),
  }),
]);

export const promptSchema = z.object({
  sessionId: z.string().min(1),
  blocks: z.array(promptBlockSchema).min(1),
});

export const sessionIdSchema = z.object({
  sessionId: z.string().min(1),
});

export const respondPermissionSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  optionId: z.string().min(1),
});

export const setModeSchema = z.object({
  sessionId: z.string().min(1),
  modeId: z.string().min(1),
});

export const setModelSchema = z.object({
  sessionId: z.string().min(1),
  modelId: z.string().min(1),
});

export const userProviderSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  command: z.tuple([z.string()]).rest(z.string()),
  env: z.record(z.string(), z.string()).optional(),
  installLink: z.string().optional(),
  version: z.string().optional(),
  iconId: z.string().optional(),
});

export const setProviderEnabledSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

export const probeCapabilitiesSchema = z.object({
  id: z.string().min(1),
  force: z.boolean().optional(),
});

export const customModelSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});
