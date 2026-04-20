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
        return createErrorResult('Invalid URL format.');
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return createErrorResult('Only http and https URLs are supported.');
      }

      if (isPrivateHost(parsed.hostname)) {
        return createErrorResult('Fetching private/internal URLs is not allowed.');
      }

      try {
        const fetchFn = await getFetch();
        const response = await fetchFn(url, {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'Termlnk/1.0' },
        });

        if (!response.ok) {
          return createErrorResult(`HTTP ${response.status}: ${response.statusText}`);
        }

        let text = await response.text();

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('html')) {
          text = stripHtml(text);
        }

        if (text.length > maxChars) {
          text = `${text.substring(0, maxChars)}\n... (truncated)`;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ url, length: text.length, content: text }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[WebFetchTool]', 'fetch failed:', err);
        return createErrorResult(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }
  const parts = hostname.split('.').map(Number);
  if (parts[0] === 10) {
    return true;
  }
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
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

function createErrorResult(message: string): IAgentToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
