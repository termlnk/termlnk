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

import type { IAgentTool, IAgentToolRegistryService, IAgentToolResult } from '@termlnk/agent';
import type { IDisposable, ILogService } from '@termlnk/core';
import type { FetchLike } from '../services/mcp/proxy-fetch';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOST_REASON = 'Fetching private, loopback, link-local or metadata addresses is not allowed.';

export type GetFetchFn = () => Promise<FetchLike>;

export function registerWebFetchTool(
  toolRegistry: IAgentToolRegistryService,
  logService: ILogService,
  getFetch: GetFetchFn
): IDisposable {
  return toolRegistry.registerTool(createWebFetchTool(logService, getFetch));
}

function createWebFetchTool(logService: ILogService, getFetch: GetFetchFn): IAgentTool {
  return {
    name: 'termlnk_web_fetch',
    label: 'Web Fetch',
    category: 'network',
    description: 'Fetch content from a URL and return it as clean text. HTTP/HTTPS only — private/internal network addresses are blocked. HTML is automatically stripped to plain text. Content is truncated at maxChars (default 50000, max 200000). Use for reading documentation, API responses, or web page content. For searching the web, use termlnk_web_search instead.',
    isReadOnly: true,
    maxResultChars: 200000,
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch (http/https only).' },
        maxChars: { type: 'number', description: 'Maximum characters to return. Default: 50000.' },
      },
      required: ['url'],
    },
    handler: async (args) => {
      const url = String(args.url ?? '');
      const maxChars = Math.min(Math.max(Number(args.maxChars) || 50000, 1000), 200000);

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return jsonError('Invalid URL format.');
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return jsonError('Only http and https URLs are supported.');
      }

      const blockReason = await resolveAndCheckHost(parsed.hostname);
      if (blockReason) {
        return jsonError(blockReason);
      }

      try {
        const fetchFn = await getFetch();
        const response = await fetchFn(url, {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'Termlnk/1.0' },
        });

        if (!response.ok) {
          return jsonError(`HTTP ${response.status}: ${response.statusText}`);
        }

        let text = await response.text();
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('html')) {
          text = stripHtml(text);
        }
        if (text.length > maxChars) {
          text = `${text.substring(0, maxChars)}\n... (truncated)`;
        }

        return jsonOk({ url, length: text.length, content: text });
      } catch (err) {
        logService.error('[WebFetchTool]', 'fetch failed:', err);
        return jsonError(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

/**
 * Resolve hostname and reject any IP that falls in a blocked range.
 * Closes the DNS-rebinding gap left by literal-only checks: an attacker-controlled
 * hostname pointing at a private/loopback/metadata IP is rejected before fetch.
 */
async function resolveAndCheckHost(hostname: string): Promise<string | null> {
  if (hostname.toLowerCase() === 'localhost') {
    return BLOCKED_HOST_REASON;
  }

  const literalKind = isIP(hostname);
  if (literalKind !== 0) {
    return isBlockedAddress(literalKind, hostname) ? BLOCKED_HOST_REASON : null;
  }

  try {
    const records = await lookup(hostname, { all: true });
    for (const { family, address } of records) {
      if (isBlockedAddress(family, address)) {
        return `Hostname "${hostname}" resolves to a blocked address (${address}).`;
      }
    }
  } catch {
    return `Hostname "${hostname}" could not be resolved.`;
  }
  return null;
}

function isBlockedAddress(family: number, address: string): boolean {
  if (family === 4) {
    return isBlockedIPv4(address);
  }
  if (family === 6) {
    return isBlockedIPv6(address);
  }
  return false;
}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return true;
  }
  const [a, b] = parts;
  // 0.0.0.0/8 — "this network"
  if (a === 0) {
    return true;
  }
  // 10.0.0.0/8 — RFC1918 private
  if (a === 10) {
    return true;
  }
  // 100.64.0.0/10 — CGNAT
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  // 127.0.0.0/8 — loopback
  if (a === 127) {
    return true;
  }
  // 169.254.0.0/16 — link-local + cloud metadata (169.254.169.254)
  if (a === 169 && b === 254) {
    return true;
  }
  // 172.16.0.0/12 — RFC1918 private
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  // 192.168.0.0/16 — RFC1918 private
  if (a === 192 && b === 168) {
    return true;
  }
  // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  if (a >= 224) {
    return true;
  }
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // ::1 — loopback (and forms like 0000:0000:...:1)
  if (lower === '::1' || /^(0+:){7}0*1$/.test(lower)) {
    return true;
  }
  // :: — unspecified
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') {
    return true;
  }
  // fe80::/10 — link-local
  if (/^fe[89ab][0-9a-f]?:/.test(lower)) {
    return true;
  }
  // fc00::/7 — unique local (fc.. or fd..)
  if (/^f[cd][0-9a-f]{0,2}:/.test(lower)) {
    return true;
  }
  // ff00::/8 — multicast
  if (lower.startsWith('ff')) {
    return true;
  }
  // ::ffff:0:0/96 — IPv4-mapped — extract embedded v4 and re-check
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) {
    return isBlockedIPv4(v4Mapped[1]);
  }
  return false;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonOk(data: Record<string, unknown>): IAgentToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function jsonError(message: string): IAgentToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}
