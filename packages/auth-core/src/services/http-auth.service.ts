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

import type { IAuthError, IAuthService, IDevice, ILoginInput, IMasterKeyService, IRegisterInput, ISrpClientService, ITokenPair, IUserAccount } from '@termlnk/auth';
import type { Observable } from 'rxjs';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { AuthState, IMasterKeyService as IMasterKeyServiceId, ISrpClientService as ISrpClientServiceId } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { fetch as undiciFetch } from 'undici';
import { TokenManager } from './token-manager.service';

/** Argon2id salt 的随机部分长度（字节）；用户邮箱拼上这串随机字节构成完整 salt。 */
const ARGON2_RANDOM_SALT_LENGTH = 32;

/**
 * 子集化的 fetch 函数签名——方便测试注入 fake，不强绑定 undici 类型。
 */
export type HttpFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;

/**
 * HttpAuthService 配置——构造时注入。
 */
export interface IHttpAuthServiceConfig {
  /** 云服务根（含版本前缀，如 `https://cloud.termlnk.io/v1`），与 sync transport 共用同一 baseUrl。 */
  readonly baseUrl: string;
  /** fetch 实现注入点；默认 undici.fetch。 */
  readonly fetchFn?: HttpFetchFn;
}

const DEFAULT_FETCH_FN: HttpFetchFn = async (url, init) => {
  const resp = await undiciFetch(url, init as never);
  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    json: () => resp.json(),
    text: () => resp.text(),
  };
};

/**
 * Wire format（基于 cloud-sync-architecture.md §6.4 的 SRP 端点扩展）：
 *
 * ```
 * POST {baseUrl}/auth/register
 *   Body: { email, argon2SaltB64, srpSalt, srpVerifier, displayName? }
 *   Resp: { user, accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt }
 *
 * POST {baseUrl}/auth/srp/init
 *   Body: { email }
 *   Resp: { argon2SaltB64, srpSalt, srpServerEphemeralPublic }
 *
 * POST {baseUrl}/auth/srp/verify
 *   Body: { email, clientPublicEphemeral, clientSessionProof }
 *   Resp: { serverSessionProof, user, accessToken, refreshToken,
 *           accessTokenExpiresAt, refreshTokenExpiresAt }
 *
 * POST {baseUrl}/auth/logout      (Bearer auth, best-effort)
 *   Resp: 204
 * ```
 *
 * 服务端在 SRP verify 阶段必须先校验 srpM1，再签发 token——避免提前泄漏 token 给猜测密码的攻击者。
 */
interface IRegisterRequestBody {
  email: string;
  displayName?: string;
  argon2SaltB64: string;
  srpSalt: string;
  srpVerifier: string;
  deviceName?: string;
}

interface IRegisterResponseBody {
  user: IUserAccount;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

interface ISrpInitRequestBody {
  email: string;
}

interface ISrpInitResponseBody {
  argon2SaltB64: string;
  srpSalt: string;
  srpServerEphemeralPublic: string;
}

interface ISrpVerifyRequestBody {
  email: string;
  clientPublicEphemeral: string;
  clientSessionProof: string;
  deviceName?: string;
}

interface IDeviceListResponseBody {
  devices: IDevice[];
}

interface ISrpVerifyResponseBody {
  serverSessionProof: string;
  user: IUserAccount;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

/**
 * IAuthService 的 HTTP 实现（**仅主进程**）。
 *
 * 数据流（register）：
 * 1. 客户端生成 32 字节 argon2Salt（随机部分）
 * 2. IMasterKeyService.derive(password, { email, saltB64 }) → master key 在主进程内存
 * 3. 取 authKey hex → ISrpClientService.enroll(email, authKey) → (srpSalt, srpVerifier)
 * 4. POST /auth/register { email, argon2SaltB64, srpSalt, srpVerifier, displayName }
 * 5. 服务端返回 user + tokens；TokenManager.setTokens 持久化；currentUser$ 推送
 *
 * 数据流（login）：
 * 1. POST /auth/srp/init { email } → server salt + ephemeral
 * 2. IMasterKeyService.derive 派生 master key（同样的 Argon2id+HKDF 链）
 * 3. ISrpClientService.generateEphemeral + deriveSession
 * 4. POST /auth/srp/verify → server M2 + tokens + user
 * 5. ISrpClientService.verifySession（失败 = MITM，丢弃 master key + tokens）
 * 6. TokenManager.setTokens；currentUser$ 推送；authState → Authenticated
 *
 * 数据流（logout）：
 * 1. POST /auth/logout (Bearer)（best-effort，网络失败不阻塞本地清理）
 * 2. IMasterKeyService.lock；TokenManager.clear；currentUser$/authState 重置
 *
 * 边界：
 * - **明文密码**仅在 register/login 调用栈内瞬时使用（IMasterKeyService.derive 后即丢弃引用）
 * - **master key**永不跨 IPC（仅本类与 IMasterKeyService 在主进程持有）
 * - **tokens**永不跨 IPC（TokenManager 内部）
 */
export class HttpAuthService extends Disposable implements IAuthService {
  private readonly _currentUser$ = new BehaviorSubject<IUserAccount | null>(null);
  readonly currentUser$: Observable<IUserAccount | null> = this._currentUser$.asObservable();

  private readonly _authState$ = new BehaviorSubject<AuthState>(AuthState.Unauthenticated);
  readonly authState$: Observable<AuthState> = this._authState$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<IAuthError | null>(null);
  readonly lastError$: Observable<IAuthError | null> = this._lastError$.asObservable();

  private readonly _fetchFn: HttpFetchFn;

  constructor(
    private readonly _config: IHttpAuthServiceConfig,
    @Inject(IMasterKeyServiceId) private readonly _masterKey: IMasterKeyService,
    @Inject(ISrpClientServiceId) private readonly _srp: ISrpClientService,
    @Inject(TokenManager) private readonly _tokenManager: TokenManager,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
    this._fetchFn = _config.fetchFn ?? DEFAULT_FETCH_FN;
  }

  override dispose(): void {
    this._currentUser$.complete();
    this._authState$.complete();
    this._lastError$.complete();
    super.dispose();
  }

  getCurrentUser(): IUserAccount | null {
    return this._currentUser$.getValue();
  }

  async getAccessToken(): Promise<string | null> {
    return this._tokenManager.getAccessToken();
  }

  async register(input: IRegisterInput): Promise<IUserAccount> {
    this._lastError$.next(null);
    this._authState$.next(AuthState.Authenticating);

    try {
      const argon2SaltBytes = randomBytes(ARGON2_RANDOM_SALT_LENGTH);
      const argon2SaltB64 = argon2SaltBytes.toString('base64');

      const masterKey = await this._masterKey.derive(input.password, {
        email: input.email,
        saltB64: argon2SaltB64,
      });
      const authKeyHex = Buffer.from(masterKey.authKey).toString('hex');

      const enrollment = this._srp.enroll(input.email, authKeyHex);

      const body: IRegisterRequestBody = {
        email: input.email,
        argon2SaltB64,
        srpSalt: enrollment.srpSalt,
        srpVerifier: enrollment.srpVerifier,
        deviceName: safeHostname(),
      };
      if (input.displayName !== undefined) {
        body.displayName = input.displayName;
      }

      const resp = await this._fetchAuthFreeJson<IRegisterResponseBody>('/auth/register', body);
      await this._completeAuthSession(resp);
      return resp.user;
    } catch (err) {
      this._handleError(err, 'register');
      throw err;
    }
  }

  async login(input: ILoginInput): Promise<IUserAccount> {
    this._lastError$.next(null);
    this._authState$.next(AuthState.Authenticating);

    try {
      const initResp = await this._fetchAuthFreeJson<ISrpInitResponseBody>(
        '/auth/srp/init',
        { email: input.email } satisfies ISrpInitRequestBody
      );

      const masterKey = await this._masterKey.derive(input.password, {
        email: input.email,
        saltB64: initResp.argon2SaltB64,
      });
      const authKeyHex = Buffer.from(masterKey.authKey).toString('hex');

      const ephemeral = this._srp.generateEphemeral();
      const session = this._srp.deriveSession(
        ephemeral.secret,
        initResp.srpServerEphemeralPublic,
        initResp.srpSalt,
        input.email,
        authKeyHex
      );

      const verifyResp = await this._fetchAuthFreeJson<ISrpVerifyResponseBody>(
        '/auth/srp/verify',
        {
          email: input.email,
          clientPublicEphemeral: ephemeral.public,
          clientSessionProof: session.proof,
          deviceName: safeHostname(),
        } satisfies ISrpVerifyRequestBody
      );

      // verifySession throws on M2 mismatch — that's "server doesn't actually have the verifier",
      // i.e., MITM. We must reject the tokens that came alongside.
      this._srp.verifySession(ephemeral.public, session, verifyResp.serverSessionProof);

      await this._completeAuthSession(verifyResp);
      return verifyResp.user;
    } catch (err) {
      this._handleError(err, 'login');
      // SRP server-proof failure / network error / wrong password → master key may be partially
      // derived. Lock it to keep the in-memory invariant clean.
      this._masterKey.lock();
      throw err;
    }
  }

  async listDevices(): Promise<readonly IDevice[]> {
    const token = await this._tokenManager.getAccessToken();
    if (!token) {
      throw new Error('[HttpAuthService] not authenticated');
    }
    const url = this._joinUrl('/auth/devices');
    const resp = await this._fetchFn(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`[HttpAuthService] GET /auth/devices → ${resp.status} ${resp.statusText}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
    const json = await resp.json() as IDeviceListResponseBody;
    return json.devices;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    if (!deviceId) {
      throw new Error('[HttpAuthService] deviceId is required');
    }
    const token = await this._tokenManager.getAccessToken();
    if (!token) {
      throw new Error('[HttpAuthService] not authenticated');
    }
    const url = this._joinUrl(`/auth/devices/${encodeURIComponent(deviceId)}/revoke`);
    const resp = await this._fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`[HttpAuthService] POST /auth/devices/.../revoke → ${resp.status} ${resp.statusText}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
  }

  async logout(): Promise<void> {
    const token = await this._tokenManager.getAccessToken();
    if (token) {
      try {
        await this._fetchFn(this._joinUrl('/auth/logout'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
      } catch (err) {
        // best-effort — local logout proceeds even if server call fails
        this._logService.warn('[HttpAuthService] server logout failed (proceeding locally):', err);
      }
    }

    this._masterKey.lock();
    await this._tokenManager.clear();
    this._currentUser$.next(null);
    this._authState$.next(AuthState.Unauthenticated);
    this._lastError$.next(null);
  }

  private async _completeAuthSession(resp: IRegisterResponseBody | ISrpVerifyResponseBody): Promise<void> {
    const tokens: ITokenPair = {
      accessToken: resp.accessToken,
      refreshToken: resp.refreshToken,
      accessTokenExpiresAt: resp.accessTokenExpiresAt,
      refreshTokenExpiresAt: resp.refreshTokenExpiresAt,
    };
    await this._tokenManager.setTokens(tokens);
    this._currentUser$.next(resp.user);
    this._authState$.next(AuthState.Authenticated);
  }

  private _handleError(err: unknown, context: string): void {
    const message = err instanceof Error ? err.message : String(err);
    const code = this._classifyError(err);
    this._logService.warn(`[HttpAuthService] ${context} failed (${code}): ${message}`);
    this._lastError$.next({ code, message });
    this._authState$.next(AuthState.Error);
  }

  private _classifyError(err: unknown): IAuthError['code'] {
    const message = err instanceof Error ? err.message : String(err);
    // Error format from _fetchAuthFreeJson: "[HttpAuthService] POST <url> → <status> ..."
    const statusMatch = /→ (\d{3})/.exec(message);
    if (statusMatch) {
      const status = Number.parseInt(statusMatch[1], 10);
      if (status === 401 || status === 403) {
        return 'invalid_credentials';
      }
      if (status === 409) {
        return 'email_already_registered';
      }
      if (status === 429) {
        return 'rate_limited';
      }
      if (status >= 500) {
        return 'server_error';
      }
    }
    if (message.includes('verifySession') || message.toLowerCase().includes('proof')) {
      return 'invalid_credentials';
    }
    if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
      return 'network';
    }
    return 'unknown';
  }

  private async _fetchAuthFreeJson<T>(path: string, body: unknown): Promise<T> {
    const url = this._joinUrl(path);
    const resp = await this._fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`[HttpAuthService] POST ${path} → ${resp.status} ${resp.statusText}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
    return resp.json() as Promise<T>;
  }

  private _joinUrl(path: string): string {
    return `${this._config.baseUrl.replace(/\/+$/, '')}${path}`;
  }
}

/** Captures os.hostname() once; falls back to a placeholder if the OS call throws. */
function safeHostname(): string {
  try {
    const name = hostname();
    return name && name.length > 0 ? name : 'Unknown device';
  } catch {
    return 'Unknown device';
  }
}
