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

export const getSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export const deleteSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export const renameSessionSchema = z.object({
  sessionId: z.string().min(1),
  title: z.string().min(1),
});

export const loadSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export const getMessagesSchema = z.object({
  sessionId: z.string().min(1),
});

export const setSessionSelectedSkillsSchema = z.object({
  sessionId: z.string().min(1),
  skillIds: z.array(z.string().min(1)),
});

export const setSessionSelectedToolsSchema = z.object({
  sessionId: z.string().min(1),
  toolIds: z.array(z.string().min(1)).nullable(),
});
