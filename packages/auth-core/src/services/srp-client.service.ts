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

import type { ISrpClientService, ISrpClientSession, ISrpEnrollment, ISrpEphemeral } from '@termlnk/auth';
import { Disposable } from '@termlnk/core';
import * as srp from 'secure-remote-password/client';

/**
 * SrpClientService 实现——薄包装 secure-remote-password/client。
 *
 * 第一性边界：该模块**不**派生 master key（那是 IMasterKeyService 职责）；
 * 调用方必须先 derive 出 authKey 并 hex 编码后传入 `authKeyHex` 参数。
 *
 * 把派生与 SRP 协议拆分的好处：
 * - 单元测试可用确定性 authKey 跑 SRP 端到端，不受 Argon2id 性能影响
 * - 未来若 SRP 库切换（如换成 SRP-6a-512），这里替换实现即可
 * - 服务端零知识：authKeyHex 在客户端瞬时使用——SrpClientService 不缓存
 */
export class SrpClientService extends Disposable implements ISrpClientService {
  enroll(username: string, authKeyHex: string): ISrpEnrollment {
    const srpSalt = srp.generateSalt();
    const privateKey = srp.derivePrivateKey(srpSalt, username, authKeyHex);
    const srpVerifier = srp.deriveVerifier(privateKey);
    return { srpSalt, srpVerifier };
  }

  generateEphemeral(): ISrpEphemeral {
    const ephemeral = srp.generateEphemeral();
    return { secret: ephemeral.secret, public: ephemeral.public };
  }

  deriveSession(
    clientSecretEphemeral: string,
    serverPublicEphemeral: string,
    srpSalt: string,
    username: string,
    authKeyHex: string
  ): ISrpClientSession {
    const privateKey = srp.derivePrivateKey(srpSalt, username, authKeyHex);
    const session = srp.deriveSession(
      clientSecretEphemeral,
      serverPublicEphemeral,
      srpSalt,
      username,
      privateKey
    );
    return { key: session.key, proof: session.proof };
  }

  verifySession(
    clientPublicEphemeral: string,
    clientSession: ISrpClientSession,
    serverProof: string
  ): void {
    srp.verifySession(clientPublicEphemeral, clientSession, serverProof);
  }
}
