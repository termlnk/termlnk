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

export const generateKeySchema = z.object({
  label: z.string().min(1),
  algorithm: z.enum(['ed25519', 'ecdsa', 'rsa']),
  bits: z.number().optional(),
  comment: z.string().optional(),
  passphrase: z.string().optional(),
  savePassphrase: z.boolean().optional(),
  // Cipher + KDF rounds protecting the private key when a passphrase is set.
  cipher: z.enum(['aes256-ctr', 'aes128-ctr', '3des-cbc']).optional(),
  rounds: z.number().int().min(1).max(1000).optional(),
});

export const importKeySchema = z.object({
  label: z.string().min(1),
  privateKey: z.string().min(1),
  passphrase: z.string().optional(),
  savePassphrase: z.boolean().optional(),
  certificate: z.string().optional(),
});

export const updateSshKeySchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  certificate: z.string().optional(),
  passphrase: z.string().optional(),
  savePassphrase: z.boolean().optional(),
});

export const createIdentitySchema = z.object({
  label: z.string().min(1),
  username: z.string().min(1),
  password: z.string().optional(),
  keyId: z.string().optional(),
});

export const updateIdentitySchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  keyId: z.string().nullable().optional(),
});
