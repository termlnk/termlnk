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

export const configKeySchema = z.string().min(1).max(255);

export const configSetSchema = z.object({
  key: configKeySchema,
  value: z.unknown(),
});

export const configSetManySchema = z.array(configSetSchema);

export const configFieldKeySchema = z.object({
  key: configKeySchema,
  field: z.string().min(1).max(255),
});

export const configFieldGetSchema = configFieldKeySchema;

export const configFieldSetSchema = configFieldKeySchema.extend({
  value: z.unknown(),
});

export const configFieldDeleteSchema = configFieldKeySchema;
