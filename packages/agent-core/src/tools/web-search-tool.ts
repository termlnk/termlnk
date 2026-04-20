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
import type { GetFetchFn } from './web-fetch-tool';

export function registerWebSearchTool(
  toolRegistry: IAgentToolRegistryService,
  logService: ILogService,
  getFetch: GetFetchFn
): IDisposable {
  return toolRegistry.registerTool(createWebSearchTool(logService, getFetch));
}

function createWebSearchTool(logService: ILogService, getFetch: GetFetchFn): IAgentTool {
  return {
    name: 'termlnk_web_search',
    label: 'Web Search',
    category: 'network',
    description: 'Search the web using DuckDuckGo and return results with titles, URLs, and snippets. No API key required. Use for finding documentation, troubleshooting error messages, or looking up command syntax. For best results, use specific and descriptive queries rather than single keywords. Returns up to 10 results (default 5). To read the full content of a result, follow up with termlnk_web_fetch using the result URL.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
        numResults: { type: 'number', description: 'Maximum number of results to return. Default: 5.' },
      },
      required: ['query'],
    },
    handler: async (args) => {
      const query = String(args.query ?? '').trim();
      const numResults = Math.min(Math.max(Number(args.numResults) || 5, 1), 10);

      if (!query) {
        return createErrorResult('Query is required.');
      }

      try {
        const fetchFn = await getFetch();
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

        const response = await fetchFn(searchUrl, {
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'Termlnk/1.0',
            Accept: 'text/html',
          },
        });

        if (!response.ok) {
          return createErrorResult(`Search failed: HTTP ${response.status}`);
        }

        const html = await response.text();
        const results = parseDuckDuckGoResults(html, numResults);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ query, results, count: results.length }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[WebSearchTool]', 'search failed:', err);
        return createErrorResult(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

interface ISearchResult {
  title: string;
  url: string;
  snippet: string;
}

function parseDuckDuckGoResults(html: string, maxResults: number): ISearchResult[] {
  const results: ISearchResult[] = [];

  const resultPattern = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
    const url = decodeURIComponent(match[1].replace(/.*uddg=/, '').replace(/&.*/, ''));
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    const snippet = match[3].replace(/<[^>]+>/g, '').trim();

    if (url && title) {
      results.push({ title, url, snippet });
    }
  }

  if (results.length === 0) {
    const linkPattern = /<a[^>]+class="result__url"[^>]*href="([^"]*)"[^>]*>/gi;
    const titlePattern = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;

    let linkMatch;
    let titleMatch;
    while (
      (linkMatch = linkPattern.exec(html)) !== null
      && (titleMatch = titlePattern.exec(html)) !== null
      && results.length < maxResults
    ) {
      results.push({
        title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
        url: linkMatch[1].trim(),
        snippet: '',
      });
    }
  }

  return results;
}

function createErrorResult(message: string): IAgentToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
