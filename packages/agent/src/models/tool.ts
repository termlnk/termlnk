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

export type AgentToolCategory = 'network' | 'terminal' | 'file' | 'mcp' | 'other';

export interface IAgentToolPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  /** Required when type === 'array' — providers reject untyped arrays. */
  items?: IAgentToolPropertySchema;
  /** Nested fields when type === 'object'. */
  properties?: Record<string, IAgentToolPropertySchema>;
  /** Required nested field names when type === 'object'. */
  required?: string[];
}

export interface IAgentToolInputSchema {
  type: 'object';
  properties?: Record<string, IAgentToolPropertySchema>;
  required?: string[];
}

export interface IAgentToolContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface IAgentToolResult {
  content: IAgentToolContent[];
  isError?: boolean;
}

export interface IAgentTool {
  name: string;
  /** Human-readable display label for UI. Falls back to name if not set. */
  label?: string;
  description: string;
  inputSchema: IAgentToolInputSchema;
  handler: (args: Record<string, unknown>) => Promise<IAgentToolResult>;

  /** Tool category for UI grouping. */
  category?: AgentToolCategory;
  /** Tool only reads state, never modifies it. Used for permission classification. */
  isReadOnly?: boolean;
  /** Tool can cause irreversible changes. Used for safety warnings. */
  isDestructive?: boolean;
  /** Maximum characters in tool result. Results exceeding this are truncated. */
  maxResultChars?: number;
}
