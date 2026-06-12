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

import { PortForwardingType } from '@termlnk/rpc';
import { z } from 'zod';

export const portForwardingTypeSchema = z.nativeEnum(PortForwardingType);
export const portForwardingHostKeyActionSchema = z.enum(['accept_save', 'accept_once', 'reject']);

export const portForwardingRuleIdSchema = z.object({
  ruleId: z.string(),
});

export const portForwardingCreateRuleSchema = z.object({
  label: z.string().optional(),
  type: portForwardingTypeSchema,
  hostId: z.string(),
  bindAddress: z.string().optional(),
  bindPort: z.number().int().min(0).max(65535),
  destinationAddress: z.string().nullish(),
  destinationPort: z.number().int().min(1).max(65535).nullish(),
});

export const portForwardingUpdateRuleSchema = z.object({
  id: z.string(),
  patch: z.object({
    label: z.string().optional(),
    type: portForwardingTypeSchema.optional(),
    hostId: z.string().optional(),
    bindAddress: z.string().optional(),
    bindPort: z.number().int().min(0).max(65535).optional(),
    destinationAddress: z.string().nullish(),
    destinationPort: z.number().int().min(1).max(65535).nullish(),
  }),
});

export const portForwardingStartRuleSchema = z.object({
  ruleId: z.string(),
  password: z.string().optional(),
});

export const portForwardingRespondKbInteractiveSchema = z.object({
  ruleId: z.string(),
  responses: z.array(z.string()),
});

export const portForwardingRespondChangePasswordSchema = z.object({
  ruleId: z.string(),
  newPassword: z.string(),
});

export const portForwardingRespondHostKeySchema = z.object({
  ruleId: z.string(),
  action: portForwardingHostKeyActionSchema,
});
