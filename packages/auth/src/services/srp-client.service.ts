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

import { createIdentifier } from '@termlnk/core';

/** SRP6a 注册产物：上传到服务端的 (salt, verifier) 元组。 */
export interface ISrpEnrollment {
  /** SRP 协议 salt（hex），与 Argon2id 的 salt 独立——前者防 verifier 重放，后者拉伸 password。 */
  readonly srpSalt: string;
  /** SRP verifier（hex）；服务端零知识存储，无法反推 password / authKey。 */
  readonly srpVerifier: string;
}

/** SRP6a 客户端临时密钥对：secret 永不离开主进程，public 发到服务端。 */
export interface ISrpEphemeral {
  readonly secret: string;
  readonly public: string;
}

/**
 * SRP6a deriveSession 输出。
 *
 * `key` 是握手成功后双方共享的 session key（可作为后续派生加密通道的 IKM）。
 * `proof` 是 M1 客户端证明，发到服务端用于触发服务端写出 M2 证明。
 *
 * 字段名故意保留 `key` / `proof`（与 secure-remote-password 库对齐），
 * 这样 verifySession 可直接传入而无需重映射。
 */
export interface ISrpClientSession {
  readonly key: string;
  readonly proof: string;
}

/**
 * 客户端 SRP6a（**仅主进程**）。
 *
 * 设计要点：
 * - SRP password 输入 = `IMasterKey.authKey` hex 编码——明文密码永不离开主进程，
 *   服务端只见到 SRP verifier（一次性零知识证据），即使被攻破也无法推 master key
 * - enroll → deriveVerifier 是 register 路径；ephemeral → deriveSession → verifySession 是 login 路径
 * - 协议参数遵循 secure-remote-password 库默认（RFC 5054 group / SHA-1）；
 *   后续若服务端切换 group/hash 需同步更新
 *
 * 整个登录流程 5 步：
 * 1. Client: `generateEphemeral()` → 取 `public` 发服务端
 * 2. Server: 收到 username + clientPublic → 取出存储的 (salt, verifier) → `Server.generateEphemeral(verifier)` → 把 (salt, serverPublic) 发回
 * 3. Client: 派生 authKey hex → `deriveSession(secret, serverPublic, salt, username, authKeyHex)` → 取 `proof` 发服务端
 * 4. Server: `Server.deriveSession(...)` → 把 serverProof 发回
 * 5. Client: `verifySession(clientPublic, clientSession, serverProof)` —— 失败抛错（说明服务端未持有 verifier，可能被 MITM）
 */
export interface ISrpClientService {
  /**
   * 注册时生成 (salt, verifier)。username 通常用 email；authKeyHex 由 IMasterKey.authKey 转 hex。
   * 上传 (salt, verifier) 到服务端；客户端不需要保留，下次登录时服务端会发回 salt。
   */
  enroll(username: string, authKeyHex: string): ISrpEnrollment;

  /** 登录第 1 步：生成临时 ephemeral 密钥对。secret 留在主进程，public 发服务端。 */
  generateEphemeral(): ISrpEphemeral;

  /**
   * 登录第 3 步：服务端返回 (srpSalt, serverPublicEphemeral) 后派生 session + proof。
   *
   * @throws 服务端 ephemeral 非法（如 `B mod N === 0`）时抛错——说明协议被破坏，应中止登录
   */
  deriveSession(
    clientSecretEphemeral: string,
    serverPublicEphemeral: string,
    srpSalt: string,
    username: string,
    authKeyHex: string,
  ): ISrpClientSession;

  /**
   * 登录第 5 步：用服务端的 proof 验证它真的持有 verifier。
   * 验证失败抛错——客户端**必须**视为登录失败，丢弃 session key（即使前面 deriveSession 成功）。
   */
  verifySession(
    clientPublicEphemeral: string,
    clientSession: ISrpClientSession,
    serverProof: string,
  ): void;
}

export const ISrpClientService = createIdentifier<ISrpClientService>('auth.srp-client-service');
