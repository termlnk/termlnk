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

import type { IAgentTool, IAgentToolRegistryService } from '@termlnk/agent';
import type { IDisposable, ILogService } from '@termlnk/core';
import { buildGuidelines, WIDGET_GUIDELINE_MODULES } from './widget-guidelines';

export const TERMLNK_WIDGET_README_TOOL = 'termlnk_widget_readme';
export const TERMLNK_WIDGET_RENDERER_TOOL = 'termlnk_widget_renderer';
export const TERMLNK_PIE_CHART_TOOL = 'termlnk_pie_chart';
export const TERMLNK_BAR_CHART_TOOL = 'termlnk_bar_chart';

/**
 * Tools that participate in the Generative UI Block protocol.
 * The host (`mcp.controller`) bypasses session-level tool selection for these names so
 * the LLM always has them available, mirroring alma's unconditional injection.
 */
export const WIDGET_TOOL_NAMES = [
  TERMLNK_WIDGET_README_TOOL,
  TERMLNK_WIDGET_RENDERER_TOOL,
  TERMLNK_PIE_CHART_TOOL,
  TERMLNK_BAR_CHART_TOOL,
] as const;

export function registerWidgetTools(
  toolRegistry: IAgentToolRegistryService,
  _logService: ILogService
): IDisposable[] {
  return [
    toolRegistry.registerTool(createWidgetReadmeTool()),
    toolRegistry.registerTool(createWidgetRendererTool()),
    toolRegistry.registerTool(createPieChartTool()),
    toolRegistry.registerTool(createBarChartTool()),
  ];
}

function createWidgetReadmeTool(): IAgentTool {
  return {
    name: TERMLNK_WIDGET_README_TOOL,
    label: 'Widget guidelines',
    category: 'other',
    isReadOnly: true,
    description:
      'Returns design guidelines for `termlnk_widget_renderer` (CSS variables, layout rules, examples). '
      + 'Call once before your first `termlnk_widget_renderer` call to learn the theming and bridge APIs. '
      + 'Pass `modules` matching the use case (`diagram`, `mockup`, `interactive`, `chart`, `art`) to load relevant detail. '
      + 'Do NOT mention this call to the user — it is an internal setup step.',
    inputSchema: {
      type: 'object',
      properties: {
        modules: {
          type: 'array',
          description: 'Guideline modules to load. Pick all that fit the use case.',
        },
      },
      required: [],
    },
    handler: async (args) => {
      const modules = Array.isArray(args.modules)
        ? (args.modules as unknown[]).filter((m): m is string => typeof m === 'string')
        : [];
      const valid = modules.filter((m) => (WIDGET_GUIDELINE_MODULES as readonly string[]).includes(m));
      const text = buildGuidelines(valid as ReadonlyArray<typeof WIDGET_GUIDELINE_MODULES[number]>);
      return { content: [{ type: 'text', text }] };
    },
  };
}

function createWidgetRendererTool(): IAgentTool {
  return {
    name: TERMLNK_WIDGET_RENDERER_TOOL,
    label: 'Widget renderer',
    category: 'other',
    isReadOnly: true,
    description:
      'Render an interactive HTML/SVG widget inline in the chat. '
      + 'IMPORTANT: Call `termlnk_widget_readme` once before your first call to load design guidelines. '
      + 'Use this tool whenever the user asks to visualize, diagram, illustrate, simulate, or interact with content. '
      + 'Great for: algorithm visualizations, architecture diagrams, flowcharts, interactive explainers, dashboards, weather cards, comparison cards, math/animation demos. '
      + 'The HTML runs in a sandboxed iframe with the host theme. Use base46 CSS variables (`var(--tm-blue)`, `var(--tm-one-bg)`, etc.) for colors. '
      + 'Scripts run only after streaming completes, so interactive controls work correctly. '
      + 'Always prefer this over describing visuals in plain text or code blocks.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the widget, e.g. "Hangzhou Weather" or "Binary Search".',
        },
        description: {
          type: 'string',
          description: 'One-sentence summary of what this widget shows. Optional.',
        },
        html: {
          type: 'string',
          description:
            'Self-contained HTML fragment (no DOCTYPE/html/head/body tags). Inline <style> and <script> are allowed. '
            + 'Use base46 CSS variables for theming. Bridge APIs available inside: window.sendPrompt(text), window.openLink(url).',
        },
      },
      required: ['title', 'html'],
    },
    handler: async () => ({
      content: [{ type: 'text', text: '{"rendered":true}' }],
    }),
  };
}

function createPieChartTool(): IAgentTool {
  return {
    name: TERMLNK_PIE_CHART_TOOL,
    label: 'Pie chart',
    category: 'other',
    isReadOnly: true,
    description:
      'Render an interactive pie chart inline in the chat. '
      + 'Provide a flat data series; the client renders a theme-aware SVG with hover tooltips. '
      + 'Use this for proportional breakdowns (time allocation, market share, error type distribution). '
      + 'For non-proportional data use `termlnk_bar_chart`.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Chart title.' },
        description: { type: 'string', description: 'Brief subtitle. Optional.' },
        data: {
          type: 'array',
          description: 'Array of { label: string, value: number, color?: string } items. Colors are auto-assigned if omitted.',
        },
      },
      required: ['title', 'data'],
    },
    handler: async () => ({
      content: [{ type: 'text', text: '{"rendered":true}' }],
    }),
  };
}

function createBarChartTool(): IAgentTool {
  return {
    name: TERMLNK_BAR_CHART_TOOL,
    label: 'Bar chart',
    category: 'other',
    isReadOnly: true,
    description:
      'Render an interactive bar chart inline in the chat. '
      + 'Provide a flat data series; the client renders a theme-aware SVG with hover tooltips. '
      + 'Use this for comparisons across categories (rank, count, score).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Chart title.' },
        description: { type: 'string', description: 'Brief subtitle. Optional.' },
        data: {
          type: 'array',
          description: 'Array of { label: string, value: number, color?: string } items.',
        },
      },
      required: ['title', 'data'],
    },
    handler: async () => ({
      content: [{ type: 'text', text: '{"rendered":true}' }],
    }),
  };
}
