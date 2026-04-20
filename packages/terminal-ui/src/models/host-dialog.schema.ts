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

const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const ipv6Regex = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{4}:)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))$/;

function isValidHostname(value: string): boolean {
  if (!value || value.length > 253) return false;

  const labels = value.split('.');
  for (const label of labels) {
    if (
      label.length === 0
      || label.length > 63
      || !/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/.test(label)
    ) {
      return false;
    }
  }
  return true;
}

function isValidAddr(value: string): boolean {
  const trimmedValue = value.startsWith('[') && value.endsWith(']')
    ? value.slice(1, -1)
    : value;

  return ipv4Regex.test(trimmedValue) || ipv6Regex.test(trimmedValue) || isValidHostname(value);
}

export const passwordCredentialSchema = z.object({
  type: z.literal('password'),
  username: z.string().min(1, 'validation.usernameRequired'),
  password: z.string(),
});

export const rsaCredentialSchema = z.object({
  type: z.literal('rsa'),
  username: z.string().min(1, 'validation.usernameRequired'),
  privateKey: z.string().min(1, 'validation.privateKeyRequired'),
});

export const credentialSchema = z.discriminatedUnion('type', [
  passwordCredentialSchema,
  rsaCredentialSchema,
]);

export const proxySchema = z.object({
  enabled: z.boolean().optional(),
  type: z.enum(['socks5', 'http']).optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
}).superRefine((value, ctx) => {
  if (!value.enabled) return;

  const host = value.host?.trim() ?? '';
  const port = value.port;

  if (!host) {
    ctx.addIssue({
      code: 'custom',
      path: ['host'],
      message: 'validation.proxyHostRequired',
    });
  } else if (!isValidAddr(host)) {
    ctx.addIssue({
      code: 'custom',
      path: ['host'],
      message: 'validation.addrInvalid',
    });
  }

  if (typeof port !== 'number' || !Number.isFinite(port)) {
    ctx.addIssue({
      code: 'custom',
      path: ['port'],
      message: 'validation.proxyPortRequired',
    });
  } else if (!Number.isInteger(port)) {
    ctx.addIssue({
      code: 'custom',
      path: ['port'],
      message: 'validation.portInvalid',
    });
  } else if (port < 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['port'],
      message: 'validation.portMin',
    });
  } else if (port > 65535) {
    ctx.addIssue({
      code: 'custom',
      path: ['port'],
      message: 'validation.portMax',
    });
  }
});

export const settingsSchema = z.object({
  connectTimeout: z.number().min(1000, 'validation.timeoutMin'),
  connectHeartbeat: z.number().min(1000, 'validation.heartbeatMin'),
  encode: z.string(),
  runScript: z.string(),
  x11Forward: z.boolean(),
  termType: z.string(),
  fontFamily: z.string(),
  fontSize: z.number().min(8, 'validation.fontSizeMin').max(24, 'validation.fontSizeMax'),
});

export const hostSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'validation.labelRequired'),
  addr: z.string()
    .min(1, 'validation.addrRequired')
    .refine(isValidAddr, 'validation.addrInvalid'),
  port: z.number().min(1, 'validation.portMin').max(65535, 'validation.portMax'),
  type: z.enum(['host', 'group']),
  credential: credentialSchema,
  proxy: proxySchema.nullish(),
  settings: settingsSchema,
});

export type HostFormData = z.infer<typeof hostSchema>;
export type CredentialFormData = z.infer<typeof credentialSchema>;
export type ProxyFormData = z.infer<typeof proxySchema>;

export function getFieldError(error: z.ZodError | null, path: string): string | undefined {
  if (!error) return undefined;
  const issue = error.issues.find((i) => i.path.join('.') === path);
  return issue?.message;
}

export function hasFieldErrors(error: z.ZodError | null, pathPrefix: string): boolean {
  if (!error) return false;
  return error.issues.some((i) => i.path.join('.').startsWith(pathPrefix));
}
