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

import type { ICapability, ICollabInviteTransportService, IFrameCodecService, IRemoteSession, IRemoteSessionClosedEventNotify, IRemoteSessionCreatedEvent, IRemoteSessionCreateOptions, IRemoteSessionCreateResult, IRemoteSessionService, ISharedSessionInputPolicy, ISharedTerminalCryptoService, ISharedTerminalPluginConfig, RemoteSessionEvent, RemoteSessionStatus } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { HttpRequestError, ITokenManager } from '@termlnk/auth';
import { Disposable, IConfigService, ILogService, Optional } from '@termlnk/core';
import { ICollabInviteTransportService as ICollabInviteTransportServiceId, IFrameCodecService as IFrameCodecServiceId, ISharedTerminalCryptoService as ISharedTerminalCryptoServiceId, SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE, SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE, SHARED_TERMINAL_PLUGIN_CONFIG_KEY, SharedTerminalError } from '@termlnk/shared-terminal';
import { BehaviorSubject, EMPTY, Subject } from 'rxjs';
import { computeCapabilityHash } from '../utils/capability-hash';
import { RelayTransportService } from './relay-transport.service';
import { RemoteSession } from './remote-session';

/**
 * Joiner-side N-session container — structural twin of SSHSessionService /
 * PTYSessionService.
 *
 * Each `createSession(inviteUrl)` builds a `RemoteSession` against its own
 * relay transport (mirroring how SSH builds an `SSHSession` against its own
 * socket). Per-session subjects live inside `RemoteSession`; this service only
 * holds the map + the global `sessions$` / `sessionCreated$` / `sessionClosed$`
 * streams the bridge controller consumes.
 *
 * Dedup contract: concurrent `createSession` calls for the same parsed sid
 * (e.g. a double-click on Join, a tRPC retry) join the existing in-flight
 * promise so we never open a parallel transport.
 */
export class RemoteSessionService extends Disposable implements IRemoteSessionService {
  private readonly _sessions = new Map<string, RemoteSession>();
  private readonly _inflightConnects = new Map<string, Promise<IRemoteSessionCreateResult>>();

  private readonly _sessions$ = new BehaviorSubject<readonly string[]>([]);
  readonly sessions$: Observable<readonly string[]> = this._sessions$.asObservable();

  private readonly _sessionCreated$ = new Subject<IRemoteSessionCreatedEvent>();
  readonly sessionCreated$: Observable<IRemoteSessionCreatedEvent> = this._sessionCreated$.asObservable();

  private readonly _sessionClosed$ = new Subject<IRemoteSessionClosedEventNotify>();
  readonly sessionClosed$: Observable<IRemoteSessionClosedEventNotify> = this._sessionClosed$.asObservable();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @ISharedTerminalCryptoServiceId private readonly _crypto: ISharedTerminalCryptoService,
    @IFrameCodecServiceId private readonly _codec: IFrameCodecService,
    @Optional(ITokenManager) private readonly _tokenManager?: ITokenManager,
    @Optional(ICollabInviteTransportServiceId) private readonly _inviteTransport?: ICollabInviteTransportService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    for (const sid of [...this._sessions.keys()]) {
      this._tearDown(sid);
    }
    this._sessions.clear();
    this._inflightConnects.clear();
    this._sessions$.complete();
    this._sessionCreated$.complete();
    this._sessionClosed$.complete();
  }

  getSessions(): readonly string[] {
    return this._sessions$.getValue();
  }

  getSession(sessionId: string): IRemoteSession | undefined {
    return this._sessions.get(sessionId);
  }

  data$(sessionId: string): Observable<Uint8Array> {
    return this._sessions.get(sessionId)?.data$ ?? EMPTY;
  }

  status$(sessionId: string): Observable<RemoteSessionStatus> {
    return this._sessions.get(sessionId)?.status$ ?? EMPTY;
  }

  event$(sessionId: string): Observable<RemoteSessionEvent> {
    return this._sessions.get(sessionId)?.event$ ?? EMPTY;
  }

  error$(sessionId: string): Observable<string | null> {
    return this._sessions.get(sessionId)?.error$ ?? EMPTY;
  }

  connectionId$(sessionId: string): Observable<string | null> {
    return this._sessions.get(sessionId)?.connectionId$ ?? EMPTY;
  }

  driverId$(sessionId: string): Observable<string | null> {
    return this._sessions.get(sessionId)?.driverId$ ?? EMPTY;
  }

  inputPolicy$(sessionId: string): Observable<ISharedSessionInputPolicy> {
    return this._sessions.get(sessionId)?.inputPolicy$ ?? EMPTY;
  }

  async createSession(options: IRemoteSessionCreateOptions): Promise<IRemoteSessionCreateResult> {
    const parsed = parseInviteUrl(options.inviteUrl);
    const sessionId = parsed.capability.sid;

    // Re-clicking the same invite while still connected is benign.
    const existing = this._sessions.get(sessionId);
    if (existing) {
      return { sessionId };
    }

    const inflight = this._inflightConnects.get(sessionId);
    if (inflight) {
      return inflight;
    }
    const promise = this._performConnect(parsed);
    this._inflightConnects.set(sessionId, promise);
    try {
      return await promise;
    } finally {
      this._inflightConnects.delete(sessionId);
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return;
    }
    try {
      await session.close();
    } catch (err) {
      this._logService.error(`[RemoteSessionService] close threw for ${sessionId}:`, err);
    }
    this._tearDown(sessionId);
  }

  async write(sessionId: string, data: string | Uint8Array): Promise<void> {
    await this._sessions.get(sessionId)?.write(data);
  }

  async resize(sessionId: string, rows: number, cols: number): Promise<void> {
    await this._sessions.get(sessionId)?.resize(rows, cols);
  }

  async sendControl(sessionId: string, message: object): Promise<void> {
    await this._sessions.get(sessionId)?.sendControl(message);
  }

  private async _performConnect(parsed: IParsedInvite): Promise<IRemoteSessionCreateResult> {
    const sessionId = parsed.capability.sid;

    const config = this._configService.getConfig<ISharedTerminalPluginConfig>(SHARED_TERMINAL_PLUGIN_CONFIG_KEY);
    const relayBaseUrl = config?.relayBaseUrl?.replace(/\/+$/, '');
    if (!relayBaseUrl) {
      throw new Error('shared-terminal: relayBaseUrl not configured (set ISharedTerminalPluginConfig.relayBaseUrl or deploy a relay).');
    }

    // Anonymous join is supported: no access token means the collab claim
    // below MUST succeed and MUST return a relay-claim token — that token is
    // the joiner's only relay credential (no JWT bucket to fall back to).
    const accountToken = await this._tokenManager?.getAccessToken();
    const anonymous = !accountToken;

    // The claim needs nothing from the key derivation below, so run it first:
    // every claim failure then rejects before any crypto work.
    let claimedConnectionId: string | undefined;
    let relayClaimToken: string | undefined;
    if (this._inviteTransport) {
      try {
        const capabilityHash = await computeCapabilityHash(parsed.capability);
        const claim = await this._inviteTransport.claim(parsed.inviteId, { capabilityHash });
        claimedConnectionId = claim.connectionId;
        relayClaimToken = claim.relayClaimToken;
      } catch (err) {
        if (isInactiveInviteClaimError(err)) {
          this._logService.warn('[RemoteSessionService] invite claim rejected because the invite is inactive:', err);
          throw new SharedTerminalError(SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE, { cause: err });
        }
        if (anonymous) {
          this._logService.warn('[RemoteSessionService] anonymous invite claim failed:', err);
          if (isAnonymousClaimRefusedError(err)) {
            // The server stated a policy (anonymous joining not admitted) —
            // map to the structured code so the join dialog can localize it.
            throw new SharedTerminalError(SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE, { cause: err });
          }
          // Transient failure (5xx, network). No same-account fallback exists
          // without a JWT, but this is not a policy statement — surface the
          // real error so the user retries instead of being told to sign in.
          throw err;
        }
        this._logService.warn('[RemoteSessionService] invite claim failed; falling back to same-account attach:', err);
      }
    }
    if (anonymous && !relayClaimToken) {
      // Covers: invite transport not wired, or the server accepted the claim
      // but minted no token (older deployment without relay-claim support).
      throw new SharedTerminalError(SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE);
    }

    const ephPriv = base64UrlToBytes(parsed.ephPriv);
    const daemonPub = base64UrlToBytes(parsed.capability.daemonPub);
    const sharedKey = this._crypto.deriveSharedKey(daemonPub, ephPriv);

    const userKp = this._crypto.generateKeypair();

    const transport = new RelayTransportService(this._codec, this._logService);
    const session = new RemoteSession(
      sessionId,
      transport,
      parsed.capability,
      daemonPub,
      userKp.secretKey,
      this._crypto,
      this._codec,
      this._logService
    );
    session.markConnecting();

    try {
      await transport.connect({
        relayBaseUrl,
        sessionId,
        mode: 'client',
        accountToken: accountToken ?? undefined,
        connectionId: claimedConnectionId,
        relayClaimToken,
      }, sharedKey);
    } catch (err) {
      // Failure path: dispose without ever registering or emitting on _sessions$ —
      // the renderer's bridge never sees a transient sid.
      session.dispose();
      const message = err instanceof Error ? err.message : String(err);
      this._logService.error(`[RemoteSessionService] transport connect failed for ${sessionId}: ${message}`);
      throw err;
    }

    this._sessions.set(sessionId, session);
    this._sessions$.next([...this._sessions$.getValue(), sessionId]);
    this._sessionCreated$.next({ sessionId });

    session.startHeartbeat();
    session.sendClientJoin(parsed.inviteId, userKp.publicKey);

    return { sessionId };
  }

  private _tearDown(sessionId: string): void {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return;
    }
    try {
      session.dispose();
    } catch (err) {
      this._logService.warn(`[RemoteSessionService] dispose threw for ${sessionId}:`, err);
    }
    this._sessions.delete(sessionId);
    this._sessions$.next(this._sessions$.getValue().filter((sid) => sid !== sessionId));
    this._sessionClosed$.next({ sessionId });
  }
}

interface IParsedInvite {
  readonly inviteId: string;
  readonly ephPriv: string;
  readonly capability: ICapability;
}

function parseInviteUrl(url: string): IParsedInvite {
  const hashIdx = url.indexOf('#');
  if (hashIdx < 0) {
    throw new Error('invite URL is missing the fragment payload');
  }
  const fragment = decodeURIComponent(url.slice(hashIdx + 1));
  const parsed = JSON.parse(fragment) as { ephPriv?: string; capability?: ICapability };
  if (!parsed.ephPriv || !parsed.capability) {
    throw new Error('invite fragment missing ephPriv or capability');
  }
  const pathMatch = url.match(/\/(?:s|invite)\/([\w_-]+)/);
  if (!pathMatch) {
    throw new Error('invite URL is missing the /s/<id> or /invite/<id> path segment');
  }
  return {
    inviteId: pathMatch[1]!,
    ephPriv: parsed.ephPriv,
    capability: parsed.capability,
  };
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? padded : padded + '='.repeat(4 - (padded.length % 4));
  const binary = atob(pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function isInactiveInviteClaimError(err: unknown): boolean {
  return err instanceof HttpRequestError && (err.status === 410 || err.serverCode === 'invite_not_active');
}

// The server signals "anonymous joining is not admitted" as a policy, not a
// fault: 503 `anonymous_join_unavailable` when the relay-claim secret is not
// configured (collab.service.ts server-side), or 401/403 from older
// deployments whose claim route still requires auth. Anything else (5xx,
// network) is transient and must NOT be classified as policy.
function isAnonymousClaimRefusedError(err: unknown): boolean {
  return err instanceof HttpRequestError
    && (err.serverCode === 'anonymous_join_unavailable' || err.status === 401 || err.status === 403);
}

// Keep symbol exported for tests and DI plugin registration; the same identifier
// is exported from `@termlnk/shared-terminal` so registering here is sufficient.
export { RemoteSessionService as RemoteSessionServiceImpl };
