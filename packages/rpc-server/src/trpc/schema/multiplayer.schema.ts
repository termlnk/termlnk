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

import { SharedTerminalRole } from '@termlnk/shared-terminal';
import { z } from 'zod';

export const sharedTerminalRoleSchema = z.nativeEnum(SharedTerminalRole);

export const sessionIdSchema = z.string().min(1);
export const clientIdSchema = z.string().min(1);
export const inviteIdSchema = z.string().min(1);
export const deviceIdSchema = z.string().min(1);

export const createInviteInputSchema = z.object({
  sessionId: sessionIdSchema.optional(),
  role: sharedTerminalRoleSchema,
  ttlMs: z.number().int().positive(),
  singleUse: z.boolean(),
  note: z.string().optional(),
});

export const setDriverInputSchema = z.object({
  sessionId: sessionIdSchema,
  clientId: clientIdSchema.nullable(),
});

export const lockDriverInputSchema = z.object({
  sessionId: sessionIdSchema,
  clientId: clientIdSchema,
});

export const kickInputSchema = z.object({
  sessionId: sessionIdSchema,
  clientId: clientIdSchema,
  reason: z.string().optional(),
});

export const announceDeviceSessionInputSchema = z.object({
  sessionId: sessionIdSchema,
  title: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export const connectAsParticipantInputSchema = z.object({
  inviteUrl: z.string().min(1),
});

export const sendParticipantInputSchema = z.object({
  /** base64-encoded bytes — keeps the transport agnostic about utf-8 vs binary. */
  dataB64: z.string().regex(/^[A-Za-z0-9+/=]*$/, 'dataB64 must be standard base64'),
});

export const sendParticipantControlSchema = z.object({
  /** JSON-serializable control message; the daemon-side mux interprets `type`. */
  message: z.record(z.string(), z.unknown()),
});
