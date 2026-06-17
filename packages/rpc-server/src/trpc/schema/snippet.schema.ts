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

export const createSnippetSchema = z.object({
  label: z.string().min(1).max(200),
  content: z.string().max(65536).default(''),
  description: z.string().max(500).nullable().optional(),
  pid: z.string().optional(),
  targetHostIds: z.array(z.string()).nullable().optional(),
  sort: z.number().int().optional(),
  favorite: z.boolean().optional(),
});

export const updateSnippetSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(200).optional(),
  content: z.string().max(65536).optional(),
  description: z.string().max(500).nullable().optional(),
  pid: z.string().optional(),
  targetHostIds: z.array(z.string()).nullable().optional(),
  sort: z.number().int().optional(),
  favorite: z.boolean().optional(),
});

export const createPackageSchema = z.object({
  label: z.string().min(1).max(100),
  pid: z.string().optional(),
  sort: z.number().int().optional(),
});

export const updatePackageSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100).optional(),
  sort: z.number().int().optional(),
  expanded: z.boolean().optional(),
});

export const moveSchema = z.object({
  id: z.string(),
  targetPid: z.string(),
  targetSort: z.number().int(),
});

export const runOnHostsSchema = z.object({
  snippetId: z.string(),
  hostIds: z.array(z.string()).min(1).max(50),
});

export const pasteOrRunSchema = z.object({
  sessionId: z.string(),
  content: z.string(),
});
