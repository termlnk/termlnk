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

export const projectContextSchema = z.object({
  sessionId: z.string(),
  scope: z.enum(['local', 'remote']),
  hostId: z.string().optional(),
  rootPath: z.string(),
  cwd: z.string(),
  isGitRepository: z.boolean(),
});

export const projectPathSchema = z.object({
  context: projectContextSchema,
  path: z.string(),
});

export const projectWriteSchema = z.object({
  context: projectContextSchema,
  path: z.string(),
  content: z.string(),
});

export const gitLogSchema = z.object({
  context: projectContextSchema,
  limit: z.number().optional(),
  skip: z.number().optional(),
});

export const gitDiffSchema = z.object({
  context: projectContextSchema,
  path: z.string().optional(),
  staged: z.boolean().optional(),
  commit: z.string().optional(),
});

export const gitPathsSchema = z.object({
  context: projectContextSchema,
  paths: z.array(z.string()),
});

export const gitCommitSchema = z.object({
  context: projectContextSchema,
  message: z.string().min(1),
});

export const gitNumstatSchema = z.object({
  context: projectContextSchema,
  commit: z.string().optional(),
});

export const gitCheckoutSchema = z.object({
  context: projectContextSchema,
  branch: z.string().min(1),
  remote: z.boolean().optional(),
});
