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

import type { ITokenManager } from '@termlnk/auth';
import type { ICollabInviteCreateInput, ICollabInviteServerView, ICollabInviteTransportService } from '@termlnk/shared-terminal';
import { HttpRequestError, ITokenManager as ITokenManagerId } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';

/**
 * Subsettable fetch — same shape used by HttpSyncTransportService for testability.
 */
export type CollabHttpFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;

const DEFAULT_FETCH_FN: CollabHttpFetchFn = async (url, init) => {
  const resp = await globalThis.fetch(url, init as RequestInit);
  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    json: () => resp.json(),
    text: () => resp.text(),
  };
};

export interface IHttpCollabInviteTransportConfig {
  /** HTTPS root for `/collab/*` endpoints; e.g. `https://termlnk-server.example.com/v1`. */
  readonly baseUrl: string;
  readonly fetchFn?: CollabHttpFetchFn;
}

/**
 * Wire format (mirror of termlnk-server /v1/collab/invite/{create,revoke,list}):
 *
 * ```
 * POST {baseUrl}/collab/invite
 *   Body: ICollabInviteCreateInput
 *   Response: { invite: ICollabInviteServerView }
 *
 * POST {baseUrl}/collab/invite/:inviteId/revoke
 *   Body: empty
 *   Response: 204 No Content  // server-side: clients refresh via GET /collab/invite
 *
 * GET  {baseUrl}/collab/invite
 *   Response: { invites: ICollabInviteServerView[] }
 * ```
 */
export class HttpCollabInviteTransportService extends Disposable implements ICollabInviteTransportService {
  private readonly _fetchFn: CollabHttpFetchFn;

  constructor(
    private readonly _config: IHttpCollabInviteTransportConfig,
    @Inject(ITokenManagerId) private readonly _tokenManager: ITokenManager,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
    this._fetchFn = _config.fetchFn ?? DEFAULT_FETCH_FN;
  }

  isAvailable(): boolean {
    return typeof this._config.baseUrl === 'string' && this._config.baseUrl.length > 0;
  }

  async pushCreate(input: ICollabInviteCreateInput): Promise<void> {
    const url = this._joinUrl('/collab/invite');
    await this._fetchAuthorized(url, 'POST', input);
  }

  async pushRevoke(inviteId: string): Promise<void> {
    const url = this._joinUrl(`/collab/invite/${encodeURIComponent(inviteId)}/revoke`);
    await this._fetchAuthorized(url, 'POST', {});
  }

  async list(): Promise<readonly ICollabInviteServerView[]> {
    const url = this._joinUrl('/collab/invite');
    const resp = await this._fetchAuthorized(url, 'GET');
    const json = await resp.json() as { invites?: ICollabInviteServerView[] };
    return json.invites ?? [];
  }

  private _joinUrl(path: string): string {
    const base = this._config.baseUrl.replace(/\/+$/, '');
    return `${base}${path}`;
  }

  private async _fetchAuthorized(
    url: string,
    method: 'POST' | 'GET',
    body?: unknown
  ): Promise<{ json: () => Promise<unknown>; text: () => Promise<string> }> {
    const token = await this._tokenManager.getAccessToken();
    if (!token) {
      throw new Error('[HttpCollabInviteTransportService] unauthenticated: no access token available');
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const resp = await this._fetchFn(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new HttpRequestError(`${method} ${url}`, resp.status, resp.statusText, text);
    }
    return { json: () => resp.json(), text: () => resp.text() };
  }
}
