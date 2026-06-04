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

import type { McpServerConfig } from '@termlnk/agent';
import type { ICredential, IProxy } from '@termlnk/terminal';
import type { ISecretCipherService } from '../secret-cipher.service';
import { isEncrypted } from '../secret-cipher.service';

// Field-level encrypt/decrypt helpers. Only sensitive subfields are touched —
// usernames, host addresses, ports, transport types, etc. stay plaintext so list
// views and queries do not need the cipher.

export function encryptCredential(
  credential: ICredential | null | undefined,
  cipher: ISecretCipherService
): ICredential | null {
  if (!credential) {
    return null;
  }
  switch (credential.type) {
    case 'password':
      return { ...credential, password: encryptIfNeeded(credential.password, cipher) };
    case 'rsa':
      return { ...credential, privateKey: encryptIfNeeded(credential.privateKey, cipher) };
    case 'key':
      return credential.passphrase
        ? { ...credential, passphrase: encryptIfNeeded(credential.passphrase, cipher) }
        : credential;
    case 'identity':
    case 'always':
      return credential;
  }
}

export function decryptCredential(
  credential: ICredential | null | undefined,
  cipher: ISecretCipherService
): ICredential | null {
  if (!credential) {
    return null;
  }
  switch (credential.type) {
    case 'password':
      return { ...credential, password: decryptIfNeeded(credential.password, cipher) };
    case 'rsa':
      return { ...credential, privateKey: decryptIfNeeded(credential.privateKey, cipher) };
    case 'key':
      return credential.passphrase
        ? { ...credential, passphrase: decryptIfNeeded(credential.passphrase, cipher) }
        : credential;
    case 'identity':
    case 'always':
      return credential;
  }
}

export function encryptProxy(
  proxy: IProxy | null | undefined,
  cipher: ISecretCipherService
): IProxy | null {
  if (!proxy) {
    return null;
  }
  if (!proxy.password) {
    return proxy;
  }
  return { ...proxy, password: encryptIfNeeded(proxy.password, cipher) };
}

export function decryptProxy(
  proxy: IProxy | null | undefined,
  cipher: ISecretCipherService
): IProxy | null {
  if (!proxy) {
    return null;
  }
  if (!proxy.password) {
    return proxy;
  }
  return { ...proxy, password: decryptIfNeeded(proxy.password, cipher) };
}

// Overloaded so nullability flows through to callers:
// - string in -> string out (required fields like ICredential.password)
// - nullable in -> nullable out (optional database columns)
//
// Empty strings and already-encrypted values pass through unchanged.
export function encryptIfNeeded(value: string, cipher: ISecretCipherService): string;
export function encryptIfNeeded(value: string | null | undefined, cipher: ISecretCipherService): string | null;
export function encryptIfNeeded(value: string | null | undefined, cipher: ISecretCipherService): string | null {
  if (value == null) {
    return null;
  }
  if (value === '' || isEncrypted(value)) {
    return value;
  }
  return cipher.encrypt(value);
}

export function decryptIfNeeded(value: string, cipher: ISecretCipherService): string;
export function decryptIfNeeded(value: string | null | undefined, cipher: ISecretCipherService): string | null;
export function decryptIfNeeded(value: string | null | undefined, cipher: ISecretCipherService): string | null {
  if (value == null) {
    return null;
  }
  if (value === '' || !isEncrypted(value)) {
    return value;
  }
  return cipher.decrypt(value);
}

// MCP server config: only env (stdio) / headers (http) values are encrypted —
// keys stay plaintext so logs and list views remain useful for debugging.
export function encryptMcpConfig(config: McpServerConfig, cipher: ISecretCipherService): McpServerConfig;
export function encryptMcpConfig(config: McpServerConfig | null | undefined, cipher: ISecretCipherService): McpServerConfig | null;
export function encryptMcpConfig(
  config: McpServerConfig | null | undefined,
  cipher: ISecretCipherService
): McpServerConfig | null {
  return _mapMcpConfigSecrets(config, (v) => encryptIfNeeded(v, cipher));
}

export function decryptMcpConfig(config: McpServerConfig, cipher: ISecretCipherService): McpServerConfig;
export function decryptMcpConfig(config: McpServerConfig | null | undefined, cipher: ISecretCipherService): McpServerConfig | null;
export function decryptMcpConfig(
  config: McpServerConfig | null | undefined,
  cipher: ISecretCipherService
): McpServerConfig | null {
  return _mapMcpConfigSecrets(config, (v) => decryptIfNeeded(v, cipher));
}

function _mapMcpConfigSecrets(
  config: McpServerConfig | null | undefined,
  fn: (value: string) => string
): McpServerConfig | null {
  if (!config) {
    return null;
  }
  if (config.type === 'stdio') {
    return config.env ? { ...config, env: mapValues(config.env, fn) } : config;
  }
  if (config.type === 'http') {
    return config.headers ? { ...config, headers: mapValues(config.headers, fn) } : config;
  }
  return config;
}

function mapValues(
  record: Record<string, string>,
  fn: (value: string) => string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = fn(v);
  }
  return out;
}
