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

/**
 * Credential 字段级加解密工具。
 *
 * 设计原则：
 * - 仅加密真正敏感字段（password / privateKey / proxy.password），保留 type / username / host / port 等明文
 * - 这让"列表展示用户名"、"按 username 搜索"等能力不需要解密整批数据
 * - 加密幂等：对已加密字段不会重复加密
 * - 解密容错：未加密的旧值原样返回（迁移期共存）
 */

/** 加密 ICredential 中的敏感字段；返回新对象，不修改入参 */
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
    case 'always':
      return credential;
  }
}

/** 解密 ICredential 中的敏感字段；返回新对象 */
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
    case 'always':
      return credential;
  }
}

/** 加密 IProxy 中的密码字段 */
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
  return {
    ...proxy,
    password: encryptIfNeeded(proxy.password, cipher),
  };
}

/** 解密 IProxy 中的密码字段 */
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
  return {
    ...proxy,
    password: decryptIfNeeded(proxy.password, cipher),
  };
}

/**
 * 加密单个字符串字段（如 ai_provider.apiKey）。
 *
 * Nullability 透传：
 * - 输入 string → 输出 string（用于 ICredential.password 等必填字段）
 * - 输入 string | null | undefined → 输出 string | null（用于可空数据库字段）
 *
 * 空字符串（'')与已加密值原样返回——空字符串不会触发加密，已加密保持幂等。
 */
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

/** 解密单个字符串字段；nullability 同 encryptIfNeeded */
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

/**
 * 加密 MCP server config 中的敏感字段：
 * - stdio.env 的所有 value（环境变量常含 API_KEY/TOKEN）
 * - http.headers 的所有 value（常含 Authorization/x-api-key）
 *
 * 仅加密 value，key 保持明文（便于排查和列表展示）。
 */
export function encryptMcpConfig(
  config: McpServerConfig | null | undefined,
  cipher: ISecretCipherService
): McpServerConfig | null {
  if (!config) {
    return null;
  }

  if (config.type === 'stdio') {
    return {
      ...config,
      env: config.env ? mapValues(config.env, (v) => encryptIfNeeded(v, cipher)) : config.env,
    };
  }

  if (config.type === 'http') {
    return {
      ...config,
      headers: config.headers
        ? mapValues(config.headers, (v) => encryptIfNeeded(v, cipher))
        : config.headers,
    };
  }

  return config;
}

/** 解密 MCP server config 中的敏感字段 */
export function decryptMcpConfig(
  config: McpServerConfig | null | undefined,
  cipher: ISecretCipherService
): McpServerConfig | null {
  if (!config) {
    return null;
  }

  if (config.type === 'stdio') {
    return {
      ...config,
      env: config.env ? mapValues(config.env, (v) => decryptIfNeeded(v, cipher)) : config.env,
    };
  }

  if (config.type === 'http') {
    return {
      ...config,
      headers: config.headers
        ? mapValues(config.headers, (v) => decryptIfNeeded(v, cipher))
        : config.headers,
    };
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
