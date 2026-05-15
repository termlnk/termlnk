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

// Decodes the server's `{ error: { code, message?, details? } }` response envelope into
// a typed HttpRequestError. Domain mapping of `serverCode` is a caller concern.

export interface IServerErrorDetail {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

export interface IServerErrorBody {
  readonly code?: string;
  readonly message?: string;
  readonly details?: ReadonlyArray<IServerErrorDetail>;
}

// Returns an empty object when the body is missing, not JSON, or lacks an `error` key —
// callers then fall back to status-based classification.
export function parseServerError(rawBody: string): IServerErrorBody {
  if (!rawBody) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawBody) as { error?: IServerErrorBody };
    return parsed.error ?? {};
  } catch {
    return {};
  }
}

// UI layers should branch on `serverCode` / `status`, never regex `.message`.
export class HttpRequestError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly serverCode?: string;
  readonly serverMessage?: string;
  readonly details?: ReadonlyArray<IServerErrorDetail>;

  constructor(operation: string, status: number, statusText: string, rawBody: string) {
    const parsed = parseServerError(rawBody);
    const tail = rawBody ? `: ${rawBody.slice(0, 200)}` : '';
    super(`${operation} → ${status} ${statusText}${tail}`);
    this.name = 'HttpRequestError';
    this.status = status;
    this.statusText = statusText;
    if (parsed.code !== undefined) {
      this.serverCode = parsed.code;
    }
    if (parsed.message !== undefined) {
      this.serverMessage = parsed.message;
    }
    if (parsed.details !== undefined) {
      this.details = parsed.details;
    }
  }
}
