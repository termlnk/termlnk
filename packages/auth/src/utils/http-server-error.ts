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

/**
 * Shared HTTP transport error decoding for termlnk-server's response envelope.
 *
 * Wire format (mirrors @termlnk/protocol errorResponseSchema):
 *   { "error": { "code": string, "message"?: string, "details"?: [...] } }
 *
 * This module is intentionally neutral about which domain enum (AuthErrorCode,
 * SyncErrorCode, ...) a given `serverCode` should map to — that's a caller-side
 * concern. The job here is only to (1) parse the envelope safely and (2) carry
 * the typed result through `throw`.
 */

export interface IServerErrorDetail {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

export interface IServerErrorBody {
  readonly code?: string;
  readonly message?: string;
  readonly details?: ReadonlyArray<IServerErrorDetail>;
}

/**
 * Parse a raw response body into the envelope's `error` object.
 * Returns an empty object when the body is missing, not JSON, or doesn't carry
 * an `error` key — caller falls back to status-based classification.
 */
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

/**
 * Typed error raised by transports when an HTTP call returned non-2xx.
 *
 * Carries the parsed envelope (`serverCode`, `serverMessage`, `details`) plus
 * the raw HTTP `status` so callers can branch precisely. The `Error.message`
 * is a short diagnostic suitable for logs; UI layers should branch on
 * `serverCode` / `status`, never regex `.message`.
 */
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
