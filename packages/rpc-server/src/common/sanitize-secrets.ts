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

import type { IProviderUserConfig } from '@termlnk/agent';
import type { IAIProviderEntity, IHostEntity } from '@termlnk/database';
import type { ICredential, IProxy } from '@termlnk/terminal';

/**
 * tRPC 边界脱敏工具集。
 *
 * 第一性原理：明文凭据可在主进程业务代码中流动；但**不应跨过 tRPC 序列化边界**进入渲染端。
 * 这套 sanitizer 就是这条边界的强制层——所有面向渲染端的 query/subscription 输出必须先过这里。
 *
 * 设计要点：
 * - 保留**用户可见的非敏感字段**（type / username / addr / port）以便 UI 渲染列表
 * - 用 `hasXxx: boolean` 占位符告诉 UI"该字段已配置"，不暴露任何明文/校验和/长度
 * - 类型推导由 tRPC `inferRouterOutputs` 自动跟踪，渲染端无需手写脱敏类型
 */

/** 仅 type / username + 占位符的安全凭据 */
export interface IPublicCredential {
  type: ICredential['type'];
  username: string;
  hasPassword?: boolean;
  hasPrivateKey?: boolean;
}

export function sanitizeCredential(credential: ICredential | null | undefined): IPublicCredential | null {
  if (!credential) {
    return null;
  }
  switch (credential.type) {
    case 'password':
      return {
        type: 'password',
        username: credential.username,
        hasPassword: !!credential.password && credential.password !== '',
      };
    case 'rsa':
      return {
        type: 'rsa',
        username: credential.username,
        hasPrivateKey: !!credential.privateKey && credential.privateKey !== '',
      };
    case 'always':
      return {
        type: 'always',
        username: credential.username,
      };
    default:
      return null;
  }
}

/** 仅 host/port/type/username + hasPassword 占位符的安全代理 */
export interface IPublicProxy extends Omit<IProxy, 'password'> {
  hasPassword: boolean;
}

export function sanitizeProxy(proxy: IProxy | null | undefined): IPublicProxy | null {
  if (!proxy) {
    return null;
  }
  const { password, ...rest } = proxy;
  return {
    ...rest,
    hasPassword: !!password && password !== '',
  };
}

/** 完整 host 实体脱敏版本（用于 host.getInfo / tree / list 等输出） */
export type IPublicHostEntity = Omit<IHostEntity, 'credential' | 'proxy'> & {
  credential: IPublicCredential | null;
  proxy: IPublicProxy | null;
};

export function sanitizeHostEntity<T extends IHostEntity>(entity: T): IPublicHostEntity {
  return {
    ...entity,
    credential: sanitizeCredential(entity.credential),
    proxy: sanitizeProxy(entity.proxy),
  };
}

export function sanitizeHostEntities<T extends IHostEntity>(entities: T[]): IPublicHostEntity[] {
  return entities.map((entity) => sanitizeHostEntity(entity));
}

/** 树结构递归脱敏（保留 children 字段） */
export interface IPublicHostTreeNode extends IPublicHostEntity {
  children: IPublicHostTreeNode[];
}

export function sanitizeHostTree(nodes: Array<IHostEntity & { children: any[] }>): IPublicHostTreeNode[] {
  return nodes.map((node) => ({
    ...sanitizeHostEntity(node),
    children: sanitizeHostTree(node.children ?? []),
  }));
}

// ---------------------------------------------------------------------------
// AI Provider
// ---------------------------------------------------------------------------

/** 不含 apiKey 的 provider 实体（用于 ai.getProviders / activeProvider$ 等输出） */
export type IPublicProviderEntity = Omit<IAIProviderEntity, 'apiKey'> & {
  apiKeyConfigured: boolean;
};

export function sanitizeProviderEntity(entity: IAIProviderEntity): IPublicProviderEntity {
  const { apiKey, ...rest } = entity;
  return {
    ...rest,
    apiKeyConfigured: !!apiKey && apiKey !== '',
  };
}

export function sanitizeProviderEntities(entities: IAIProviderEntity[]): IPublicProviderEntity[] {
  return entities.map(sanitizeProviderEntity);
}

/** 不含 apiKey 的 provider 用户配置（活跃 provider 推送使用） */
export type IPublicProviderUserConfig = Omit<IProviderUserConfig, 'apiKey'> & {
  apiKeyConfigured: boolean;
};

export function sanitizeProviderUserConfig(config: IProviderUserConfig | null | undefined): IPublicProviderUserConfig | null {
  if (!config) {
    return null;
  }
  const { apiKey, ...rest } = config;
  return {
    ...rest,
    apiKeyConfigured: !!apiKey && apiKey !== '',
  };
}
