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

import { HOST_CHAIN_MAX_DEPTH, HostType } from '@termlnk/terminal';
import { z } from 'zod';

export const credentialSchema = z.object({
  type: z.string(),
  username: z.string().optional(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
});

export const proxySchema = z.object({
  enabled: z.boolean().optional(),
  type: z.string(),
  host: z.string(),
  port: z.number().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
});

export const settingsSchema = z.object({
  connectTimeout: z.number().nullish(),
  connectHeartbeat: z.number().nullish(),
  runScript: z.string().nullish(),
  encode: z.string().nullish(),
  x11Forward: z.boolean().nullish(),
  termType: z.string().nullish(),
  fontFamily: z.string().nullish(),
  fontSize: z.number().min(8).max(72).nullish(),
});

export const hostChainIdsSchema = z.array(z.string().min(1)).max(HOST_CHAIN_MAX_DEPTH);

export const hostSchema = z.object({
  label: z.string(),
  type: z.enum(Object.values(HostType) as HostType[]),
  pid: z.string().optional(),
  sort: z.number().optional(),

  addr: z.hostname().or(z.ipv4()).or(z.ipv6()).nullish(),
  port: z.number().min(1).max(65535).nullish(),
  credential: credentialSchema.nullish(),
  proxy: proxySchema.nullish(),
  settings: settingsSchema.nullish(),
  hostChainIds: hostChainIdsSchema.nullish(),
});

export const createHostSchema = hostSchema.extend({
  id: z.string().optional(),
});

export const updateHostSchema = hostSchema.extend({
  id: z.string(),
});
