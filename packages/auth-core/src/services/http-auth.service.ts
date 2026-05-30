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

import type { AuthErrorCode, IAuthCapabilities, IAuthError, IAuthService, IDevice, ILoginInput, IRegisterInput, ITokenPair, IUserAccount } from '@termlnk/auth';
import type { Observable } from 'rxjs';
import { AUTH_DEVICE_ID_STORAGE_KEY, AuthError, AuthState, bytesToBase64, bytesToHex, HttpRequestError, IAuthKeyValueStorage, IDeviceNameProvider, IMasterKeyService, ISrpClientService, ITokenManager, IUserStorageService, MasterKeyState, randomBytes, VaultState } from '@termlnk/auth';
import { Disposable, generateRandomId, ILogService, Optional } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

// Random component length (bytes) of the Argon2id salt; combined with the email to form
// the full salt material.
const ARGON2_RANDOM_SALT_LENGTH = 32;

const FALLBACK_DEVICE_NAME = 'Unknown device';

// A Google sign-in relay code is only honored within this window after the user initiated the
// flow on this device (getGoogleAuthorizeUrl) — bounds the login-CSRF replay surface.
const GOOGLE_SIGN_IN_INTENT_TTL_MS = 10 * 60 * 1000;

// Subset of fetch() that we depend on; production passes globalThis.fetch, tests inject a fake.
export type HttpFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;

export interface IHttpAuthServiceConfig {
  // Cloud root with version prefix; shared with the sync transport.
  readonly baseUrl: string;
  readonly fetchFn?: HttpFetchFn;
}

const DEFAULT_FETCH_FN: HttpFetchFn = async (url, init) => {
  const resp = await globalThis.fetch(url, init as RequestInit);
  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    json: () => resp.json(),
    text: () => resp.text(),
  };
};

const SERVER_CODE_TO_AUTH_CODE: Readonly<Record<string, AuthErrorCode>> = {
  email_already_registered: 'email_already_registered',
  invalid_credentials: 'invalid_credentials',
  email_not_verified: 'email_not_verified',
  registration_closed: 'registration_closed',
  // Server differentiates `unauthorized` (access token rejected; refresh may recover)
  // from `invalid_refresh` (refresh itself revoked/replayed). Mirror that here so callers
  // can decide whether to retry silently or force a sign-in.
  unauthorized: 'token_expired',
  invalid_refresh: 'session_expired',
  invalid_request: 'invalid_request',
  rate_limited: 'rate_limited',
  server_error: 'server_error',
};

function mapServerErrorCode(code: string | undefined): AuthErrorCode | null {
  if (!code) {
    return null;
  }
  return SERVER_CODE_TO_AUTH_CODE[code] ?? null;
}

function mapHttpStatusCode(status: number): AuthErrorCode {
  // Status-only fallback for responses that didn't carry a `code`. Treats 401/403 as a
  // credential failure since that's the most common cause at login/register; specific
  // states (registration_closed, session_expired, …) come through SERVER_CODE_TO_AUTH_CODE.
  if (status === 400) {
    return 'invalid_request';
  }
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
  return 'unknown';
}

// User-facing English copy. UI layers that need localization can switch on `AuthError.code` and
// look up their own strings; this is the fallback when the UI just renders `err.message`.
const FRIENDLY_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  invalid_credentials: 'Invalid email or password.',
  email_already_registered: 'This email is already registered. Try signing in instead.',
  email_not_verified: 'Please verify your email before signing in.',
  registration_closed: 'Open registration is disabled on this server.',
  session_expired: 'Your session has ended. Please sign in again.',
  invalid_request: 'The request was rejected by the server. Please try again.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  network: 'Network error. Check your connection and try again.',
  server_error: 'Server error. Please try again later.',
  token_expired: 'Your session has expired. Please sign in again.',
  wrong_encryption_password: 'Incorrect encryption password.',
  unknown: 'Something went wrong. Please try again.',
};

function friendlyMessageFor(code: AuthErrorCode): string {
  return FRIENDLY_MESSAGES[code];
}

// Server MUST validate srpM1 before issuing tokens; otherwise a password-guessing attacker
// could observe a token leak alongside the SRP rejection.
interface IRegisterRequestBody {
  email: string;
  displayName?: string;
  argon2SaltB64: string;
  srpSalt: string;
  srpVerifier: string;
  deviceName?: string;
  // Stable per-device id (nanoid). The server upserts the device row keyed on
  // (userId, deviceId), so re-login from the same install reuses the existing row instead
  // of creating a new one each time.
  deviceId: string;
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
  // See IRegisterRequestBody.deviceId.
  deviceId: string;
}

interface IDeviceListResponseBody {
  devices: IDevice[];
}

interface IMeResponseBody {
  user: IUserAccount;
  e2e: IE2EStatusBody;
}

interface ISrpVerifyResponseBody {
  serverSessionProof: string;
  user: IUserAccount;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

interface IE2EStatusBody {
  configured: boolean;
  argon2SaltB64?: string;
}

interface IGoogleClaimResponseBody {
  user: IUserAccount;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  e2e: IE2EStatusBody;
}

// Trust boundary: plaintext password is consumed inside register/login only; master key
// and tokens never leave the main process.
export class HttpAuthService extends Disposable implements IAuthService {
  private readonly _currentUser$ = new BehaviorSubject<IUserAccount | null>(null);
  readonly currentUser$: Observable<IUserAccount | null> = this._currentUser$.asObservable();

  private readonly _authState$ = new BehaviorSubject<AuthState>(AuthState.Unauthenticated);
  readonly authState$: Observable<AuthState> = this._authState$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<IAuthError | null>(null);
  readonly lastError$: Observable<IAuthError | null> = this._lastError$.asObservable();

  private readonly _vaultState$ = new BehaviorSubject<VaultState>(VaultState.Empty);
  readonly vaultState$: Observable<VaultState> = this._vaultState$.asObservable();

  private readonly _fetchFn: HttpFetchFn;

  // In-memory cache for the persisted device id. First read goes through IAuthKeyValueStorage;
  // subsequent reads short-circuit so register/login don't hit the keystore each call.
  private _deviceIdCache: string | null = null;

  // Tracks when a Google sign-in was initiated on this device (via getGoogleAuthorizeUrl). A
  // relay code arriving on the deep-link bus without a recent intent is rejected — this defeats
  // a forged/replayed `termlnk://auth/callback` signing this device into someone else's account.
  private _googleSignInIntentAt = 0;

  constructor(
    private readonly _config: IHttpAuthServiceConfig,
    @IMasterKeyService private readonly _masterKey: IMasterKeyService,
    @ISrpClientService private readonly _srp: ISrpClientService,
    @ITokenManager private readonly _tokenManager: ITokenManager,
    @IAuthKeyValueStorage private readonly _storage: IAuthKeyValueStorage,
    @IUserStorageService private readonly _userStorage: IUserStorageService,
    @ILogService private readonly _logService: ILogService,
    @Optional(IDeviceNameProvider) private readonly _deviceNameProvider?: IDeviceNameProvider
  ) {
    super();

    this._fetchFn = _config.fetchFn ?? DEFAULT_FETCH_FN;

    // Keep vaultState consistent when the master key is cleared out-of-band (e.g. the
    // idle-lock controller's fallback path locks the key directly, bypassing logout()).
    this.disposeWithMe(this._masterKey.state$.subscribe((state) => this._onMasterKeyState(state)));
  }

  override dispose(): void {
    this._currentUser$.complete();
    this._authState$.complete();
    this._lastError$.complete();
    this._vaultState$.complete();
    super.dispose();
  }

  getCurrentUser(): IUserAccount | null {
    return this._currentUser$.getValue();
  }

  async getAccessToken(): Promise<string | null> {
    return this._tokenManager.getAccessToken();
  }

  async register(input: IRegisterInput): Promise<void> {
    this._lastError$.next(null);
    this._authState$.next(AuthState.Authenticating);

    try {
      const argon2SaltBytes = randomBytes(ARGON2_RANDOM_SALT_LENGTH);
      const argon2SaltB64 = bytesToBase64(argon2SaltBytes);

      const masterKey = await this._masterKey.derive(input.password, {
        email: input.email,
        saltB64: argon2SaltB64,
      });
      const authKeyHex = bytesToHex(masterKey.authKey);

      const enrollment = this._srp.enroll(input.email, authKeyHex);

      const body: IRegisterRequestBody = {
        email: input.email,
        argon2SaltB64,
        srpSalt: enrollment.srpSalt,
        srpVerifier: enrollment.srpVerifier,
        deviceName: this._safeDeviceName(),
        deviceId: await this._loadOrCreateDeviceId(),
      };
      if (input.displayName !== undefined) {
        body.displayName = input.displayName;
      }

      const resp = await this._fetchAuthFreeJson<IRegisterResponseBody>('/auth/register', body);
      await this._completeAuthSession(resp);
      // SRP register derived the master key above; the vault is immediately usable.
      this._vaultState$.next(VaultState.Unlocked);
    } catch (err) {
      throw this._toAuthError(err, 'register');
    }
  }

  async login(input: ILoginInput): Promise<void> {
    this._lastError$.next(null);
    this._authState$.next(AuthState.Authenticating);

    try {
      const verifyResp = await this._performSrpLogin(input.email, input.password);
      await this._completeAuthSession(verifyResp);
      // SRP login derived the master key above; the vault is immediately usable.
      this._vaultState$.next(VaultState.Unlocked);
    } catch (err) {
      // SRP server-proof failure / network error / wrong password → master key may be
      // partially derived. Lock it to keep the in-memory invariant clean.
      this._masterKey.lock();
      throw this._toAuthError(err, 'login');
    }
  }

  // Runs the SRP6a handshake (init → derive → verify → M2 check) and returns the server
  // response. Mutates NO public state by design: callers decide whether the outcome is an
  // identity-login event (login) or a vault-unlock event (unlockVault), so a wrong password
  // during unlock does not flip the identity authState$ to Error.
  private async _performSrpLogin(email: string, password: string): Promise<ISrpVerifyResponseBody> {
    const initResp = await this._fetchAuthFreeJson<ISrpInitResponseBody>(
      '/auth/srp/init',
      { email } satisfies ISrpInitRequestBody
    );

    const masterKey = await this._masterKey.derive(password, {
      email,
      saltB64: initResp.argon2SaltB64,
    });
    const authKeyHex = bytesToHex(masterKey.authKey);

    const ephemeral = this._srp.generateEphemeral();
    const session = this._srp.deriveSession(
      ephemeral.secret,
      initResp.srpServerEphemeralPublic,
      initResp.srpSalt,
      email,
      authKeyHex
    );

    const verifyResp = await this._fetchAuthFreeJson<ISrpVerifyResponseBody>(
      '/auth/srp/verify',
      {
        email,
        clientPublicEphemeral: ephemeral.public,
        clientSessionProof: session.proof,
        deviceName: this._safeDeviceName(),
        deviceId: await this._loadOrCreateDeviceId(),
      } satisfies ISrpVerifyRequestBody
    );

    // verifySession throws on M2 mismatch — "server doesn't actually have the verifier",
    // i.e. MITM. We must reject the tokens that came alongside.
    this._srp.verifySession(ephemeral.public, session, verifyResp.serverSessionProof);

    return verifyResp;
  }

  async listDevices(): Promise<readonly IDevice[]> {
    try {
      const resp = await this._fetchAuthorized('GET /auth/devices', '/auth/devices', 'GET');
      const json = await resp.json() as IDeviceListResponseBody;
      return json.devices;
    } catch (err) {
      throw err instanceof AuthError ? err : this._classifyError(err);
    }
  }

  async revokeDevice(deviceId: string): Promise<void> {
    if (!deviceId) {
      throw new AuthError('unknown', '[HttpAuthService] deviceId is required');
    }
    const path = `/auth/devices/${encodeURIComponent(deviceId)}/revoke`;
    try {
      await this._fetchAuthorized(`POST ${path}`, path, 'POST');
      // Server responds 204 No Content — no body to parse.
    } catch (err) {
      throw err instanceof AuthError ? err : this._classifyError(err);
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
    await this._masterKey.clearPersistedKey();
    await this._tokenManager.clear();
    await this._userStorage.clear();
    this._currentUser$.next(null);
    this._authState$.next(AuthState.Unauthenticated);
    this._lastError$.next(null);
    this._vaultState$.next(VaultState.Empty);
  }

  // Idempotent and fail-soft; never throws to the caller.
  async restore(): Promise<void> {
    const cachedUser = await this._userStorage.load();
    if (cachedUser) {
      // Fast path: emit immediately so the UI does not flash the login screen while
      // we negotiate refresh / /auth/me. The post-network step below may overwrite this.
      this._currentUser$.next(cachedUser);
      this._authState$.next(AuthState.Authenticated);
    }

    // getAccessToken auto-refreshes when within the 30 s margin and fail-soft clears
    // both cache and storage when refresh fails. Either outcome is durable: null means
    // "no usable token left", non-null means "token verified usable for the next call".
    const token = await this._tokenManager.getAccessToken();
    if (!token) {
      if (cachedUser) {
        await this._userStorage.clear();
        this._currentUser$.next(null);
        this._authState$.next(AuthState.Unauthenticated);
      }
      this._vaultState$.next(VaultState.Empty);
      return;
    }

    // Token still alive — best-effort self-heal so changes elsewhere (displayName, avatar,
    // emailVerified) reach this device without forcing a re-login. /auth/me also carries the
    // authoritative e2e status used to resolve the vault state below. Errors are classified:
    //   401/403          → server revoked the token; clear everything.
    //   404 / network    → endpoint not deployed yet or transient outage; keep cached user.
    //   anything else    → log and keep cached user.
    let e2e: IE2EStatusBody | null = null;
    try {
      const me = await this._fetchMe(token);
      await this._userStorage.save(me.user);
      this._currentUser$.next(me.user);
      this._authState$.next(AuthState.Authenticated);
      e2e = me.e2e;
    } catch (err) {
      if (err instanceof HttpRequestError && (err.status === 401 || err.status === 403)) {
        this._logService.log('[HttpAuthService] /auth/me rejected token; clearing session');
        await this._userStorage.clear();
        await this._tokenManager.clear();
        await this._masterKey.clearPersistedKey();
        this._masterKey.lock();
        this._currentUser$.next(null);
        this._authState$.next(AuthState.Unauthenticated);
        this._vaultState$.next(VaultState.Empty);
        return;
      }
      this._logService.warn('[HttpAuthService] /auth/me self-heal failed (keeping cached user):', err);
    }

    await this._reconcileVaultState(e2e);
  }

  // Resolve the vault state on restore. The server's e2e status (when /auth/me was
  // reachable) is authoritative:
  //   - not configured → NeedsSetup; drop any local wrap so a half-finished
  //     setupEncryptionPassword can't masquerade as Unlocked here or desync other devices.
  //   - configured + local wrap present → Unlocked (key reinstalled from the OS keystore).
  //   - configured + no local wrap (new device / post-restart) → Locked; the user enters
  //     the encryption password to unlock.
  // When /auth/me was unreachable (e2e null, offline / legacy server) we degrade to the
  // local wrap alone.
  private async _reconcileVaultState(e2e: IE2EStatusBody | null): Promise<void> {
    if (e2e && !e2e.configured) {
      await this._masterKey.clearPersistedKey();
      this._masterKey.lock();
      this._vaultState$.next(VaultState.NeedsSetup);
      return;
    }
    const restored = await this._masterKey.tryRestoreFromStorage();
    this._vaultState$.next(restored ? VaultState.Unlocked : VaultState.Locked);
  }

  // Keep vaultState in sync when the master key is cleared out-of-band (e.g. the idle-lock
  // controller's fallback path calls IMasterKeyService.lock() directly without going through
  // logout()). Only downgrade an Unlocked vault for a still-authenticated user; logout() and
  // restore() own the Empty/NeedsSetup transitions explicitly.
  private _onMasterKeyState(state: MasterKeyState): void {
    if (
      state === MasterKeyState.Locked
      && this._currentUser$.getValue() !== null
      && this._vaultState$.getValue() === VaultState.Unlocked
    ) {
      this._vaultState$.next(VaultState.Locked);
    }
  }

  async getGoogleAuthorizeUrl(): Promise<string> {
    // Record that THIS device initiated a Google sign-in; the deep-link handler only
    // honors a relay code while this intent is fresh (see loginWithGoogle).
    this._googleSignInIntentAt = Date.now();
    return this._joinUrl('/auth/google/start');
  }

  async getServerCapabilities(): Promise<IAuthCapabilities> {
    try {
      const resp = await this._request('GET /auth/capabilities', 'GET', '/auth/capabilities');
      const body = await resp.json() as Partial<IAuthCapabilities>;
      return { googleOAuth: body.googleOAuth === true };
    } catch (err) {
      // Fail-soft: an unreachable or older server simply advertises no optional methods.
      this._logService.warn('[HttpAuthService] capabilities probe failed:', err);
      return { googleOAuth: false };
    }
  }

  async loginWithGoogle(relayCode: string): Promise<void> {
    if (!this._consumeGoogleSignInIntent()) {
      // A relay code we never initiated (forged / replayed deep link). Refuse so a malicious
      // local app can't sign this device into an attacker's account (login CSRF).
      this._logService.warn('[HttpAuthService] ignoring Google callback with no sign-in in progress');
      throw new AuthError('invalid_request', 'no Google sign-in is in progress on this device');
    }
    this._lastError$.next(null);
    this._authState$.next(AuthState.Authenticating);

    try {
      const resp = await this._fetchAuthFreeJson<IGoogleClaimResponseBody>('/auth/google/claim', {
        relayCode,
        deviceName: this._safeDeviceName(),
      });
      await this._completeAuthSession(resp);
      // Identity is established; the encryption key is a separate factor. NeedsSetup on
      // first ever sign-in, otherwise Locked until the user supplies the password.
      this._vaultState$.next(resp.e2e.configured ? VaultState.Locked : VaultState.NeedsSetup);
    } catch (err) {
      throw this._toAuthError(err, 'loginWithGoogle');
    }
  }

  // Returns true at most once per getGoogleAuthorizeUrl() call, and only within the TTL.
  private _consumeGoogleSignInIntent(): boolean {
    const at = this._googleSignInIntentAt;
    this._googleSignInIntentAt = 0;
    return at > 0 && Date.now() - at <= GOOGLE_SIGN_IN_INTENT_TTL_MS;
  }

  async setupEncryptionPassword(password: string): Promise<void> {
    const user = this._currentUser$.getValue();
    if (!user) {
      throw new AuthError('unknown', 'cannot set an encryption password before signing in');
    }
    try {
      const argon2SaltB64 = bytesToBase64(randomBytes(ARGON2_RANDOM_SALT_LENGTH));
      const masterKey = await this._masterKey.derive(password, { email: user.email, saltB64: argon2SaltB64 });
      const authKeyHex = bytesToHex(masterKey.authKey);
      // Enroll the encryption password as the account's SRP credential so it is also
      // a login password: email + this password can sign in via /auth/srp/* and
      // derives the same encKey (identity-only OAuth and password login converge).
      const enrollment = this._srp.enroll(user.email, authKeyHex);
      await this._fetchAuthorizedJson('POST /auth/e2e/setup', '/auth/e2e/setup', {
        argon2SaltB64,
        srpSalt: enrollment.srpSalt,
        srpVerifier: enrollment.srpVerifier,
      });
      this._vaultState$.next(VaultState.Unlocked);
    } catch (err) {
      // derive() already persisted the wrapped key as a side effect. Roll it back so a
      // failed upload can't leave a local wrap the server has no credential for — which
      // would restore as a bogus Unlocked on next launch and never unlock on other devices.
      this._masterKey.lock();
      await this._masterKey.clearPersistedKey();
      throw err instanceof AuthError ? err : this._classifyError(err);
    }
  }

  async unlockVault(password: string): Promise<void> {
    const user = this._currentUser$.getValue();
    if (!user) {
      throw new AuthError('unknown', 'cannot unlock the vault before signing in');
    }
    this._lastError$.next(null);
    try {
      // Unlocking proves the encryption password, which is also the SRP login password
      // (see setupEncryptionPassword). Re-running the handshake derives the master key
      // (unlocking the vault) and refreshes the session. Identity is already established,
      // so a wrong password is a VAULT error — we deliberately do NOT route through login(),
      // which would flip the identity authState$ to Error for an otherwise-valid session.
      const verifyResp = await this._performSrpLogin(user.email, password);
      await this._completeAuthSession(verifyResp);
      this._vaultState$.next(VaultState.Unlocked);
    } catch (err) {
      this._masterKey.lock();
      const authError = err instanceof AuthError ? err : this._classifyError(err);
      // A wrong encryption password surfaces as invalid_credentials; remap to the
      // vault-specific code so the UI shows the right message.
      const surfaced = authError.code === 'invalid_credentials'
        ? new AuthError('wrong_encryption_password', friendlyMessageFor('wrong_encryption_password'))
        : authError;
      this._lastError$.next({ code: surfaced.code, message: surfaced.message });
      throw surfaced;
    }
  }

  private async _completeAuthSession(resp: {
    user: IUserAccount;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  }): Promise<void> {
    const tokens: ITokenPair = {
      accessToken: resp.accessToken,
      refreshToken: resp.refreshToken,
      accessTokenExpiresAt: resp.accessTokenExpiresAt,
      refreshTokenExpiresAt: resp.refreshTokenExpiresAt,
    };
    await this._tokenManager.setTokens(tokens);
    await this._userStorage.save(resp.user);
    this._currentUser$.next(resp.user);
    this._authState$.next(AuthState.Authenticated);
  }

  // GET /auth/me — Bearer-authorized lookup of the canonical user record + e2e status.
  // Throws HttpRequestError on non-2xx so restore() can branch on status.
  private async _fetchMe(token: string): Promise<IMeResponseBody> {
    const resp = await this._request('GET /auth/me', 'GET', '/auth/me', { token });
    return resp.json() as Promise<IMeResponseBody>;
  }

  // Translate any thrown value into a user-facing AuthError and update the public state streams.
  // Already-classified AuthError instances pass through unchanged (only the side-effects re-fire).
  private _toAuthError(err: unknown, context: string): AuthError {
    const authError = err instanceof AuthError ? err : this._classifyError(err);
    const raw = err instanceof Error ? err.message : String(err);
    this._logService.warn(`[HttpAuthService] ${context} failed (${authError.code}): ${raw}`);
    this._lastError$.next({ code: authError.code, message: authError.message });
    this._authState$.next(AuthState.Error);
    return authError;
  }

  private _classifyError(err: unknown): AuthError {
    if (err instanceof HttpRequestError) {
      const code = mapServerErrorCode(err.serverCode) ?? mapHttpStatusCode(err.status);
      return new AuthError(code, friendlyMessageFor(code));
    }
    const message = err instanceof Error ? err.message : String(err);
    // SRP M2 mismatch surfaces as "Server provided session proof is invalid" — same UX as wrong password.
    if (message.includes('verifySession') || message.toLowerCase().includes('proof')) {
      return new AuthError('invalid_credentials', friendlyMessageFor('invalid_credentials'));
    }
    // fetch() failure outside a 4xx/5xx (DNS, refused, offline) bubbles up as a TypeError or
    // similar with "fetch" or "network" in the message; same with platform-specific wording.
    if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
      return new AuthError('network', friendlyMessageFor('network'));
    }
    return new AuthError('unknown', friendlyMessageFor('unknown'));
  }

  // Single fetch path shared by every JSON endpoint. Adds Accept (plus Bearer /
  // Content-Type when applicable), maps a transport failure to AuthError('network') and a
  // non-2xx to HttpRequestError(operation, …) so callers map serverCode consistently.
  private async _request(
    operation: string,
    method: 'GET' | 'POST',
    path: string,
    opts?: { token?: string; jsonBody?: unknown }
  ): Promise<Awaited<ReturnType<HttpFetchFn>>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts?.token) {
      headers.Authorization = `Bearer ${opts.token}`;
    }
    const jsonBody = opts?.jsonBody;
    const hasBody = jsonBody !== undefined;
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
    let resp: Awaited<ReturnType<HttpFetchFn>>;
    try {
      resp = await this._fetchFn(this._joinUrl(path), {
        method,
        headers,
        body: hasBody ? JSON.stringify(jsonBody) : undefined,
      });
    } catch {
      // fetch() rejected before a response (DNS, refused, TLS, offline). Translate to a typed
      // error so the classifier doesn't have to regex-match platform-specific wording.
      throw new AuthError('network', friendlyMessageFor('network'));
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new HttpRequestError(operation, resp.status, resp.statusText, text);
    }
    return resp;
  }

  // Bearer-authenticated request (no body) for listDevices/revokeDevice; surfaces
  // HttpRequestError with serverCode so callers map unauthorized / invalid_refresh.
  private async _fetchAuthorized(
    operation: string,
    path: string,
    method: 'POST' | 'GET'
  ): Promise<{ json: () => Promise<unknown> }> {
    const token = await this._tokenManager.getAccessToken();
    if (!token) {
      throw new AuthError('session_expired', friendlyMessageFor('session_expired'));
    }
    return this._request(operation, method, path, { token });
  }

  private async _fetchAuthFreeJson<T>(path: string, body: unknown): Promise<T> {
    const resp = await this._request(`POST ${path}`, 'POST', path, { jsonBody: body });
    return resp.json() as Promise<T>;
  }

  // Bearer-authenticated POST with a JSON body (e2e/setup).
  private async _fetchAuthorizedJson<T = unknown>(operation: string, path: string, body: unknown): Promise<T> {
    const token = await this._tokenManager.getAccessToken();
    if (!token) {
      throw new AuthError('session_expired', friendlyMessageFor('session_expired'));
    }
    const resp = await this._request(operation, 'POST', path, { token, jsonBody: body });
    return resp.json() as Promise<T>;
  }

  private _joinUrl(path: string): string {
    return `${this._config.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  // Cached in-memory after the first call. If the keystore throws we still return a fresh
  // id for this process so sign-in is not blocked; persistence retries on next launch.
  private async _loadOrCreateDeviceId(): Promise<string> {
    if (this._deviceIdCache) {
      return this._deviceIdCache;
    }
    try {
      const stored = await this._storage.getString(AUTH_DEVICE_ID_STORAGE_KEY);
      if (stored && stored.length > 0) {
        this._deviceIdCache = stored;
        return stored;
      }
    } catch (err) {
      this._logService.warn('[HttpAuthService] device id read failed, generating fresh:', err);
    }
    const fresh = generateRandomId(24);
    try {
      await this._storage.setString(AUTH_DEVICE_ID_STORAGE_KEY, fresh);
    } catch (err) {
      this._logService.warn('[HttpAuthService] device id persist failed (will retry next launch):', err);
    }
    this._deviceIdCache = fresh;
    return fresh;
  }

  private _safeDeviceName(): string {
    if (!this._deviceNameProvider) {
      return FALLBACK_DEVICE_NAME;
    }

    try {
      const name = this._deviceNameProvider.getName();
      return name && name.length > 0 ? name : FALLBACK_DEVICE_NAME;
    } catch (err) {
      this._logService.warn('[HttpAuthService] device name provider threw, falling back:', err);
      return FALLBACK_DEVICE_NAME;
    }
  }
}
