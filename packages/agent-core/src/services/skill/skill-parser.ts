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

import type { ISkillFrontmatter } from '@termlnk/agent';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

export function parseSkillFrontmatter(content: string): { frontmatter: ISkillFrontmatter; body: string } | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return null;
  }

  const yamlStr = match[1];
  const body = content.slice(match[0].length).trim();
  const frontmatter = parseSimpleYaml(yamlStr);

  if (!frontmatter.name || !frontmatter.description) {
    return null;
  }

  return { frontmatter: frontmatter as unknown as ISkillFrontmatter, body };
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }

    // Array item continuation
    if (currentKey && currentArray !== null && /^\s+-\s+/.test(line)) {
      const value = line.replace(/^\s+-\s+/, '').trim();
      currentArray.push(unquote(value));
      result[currentKey] = currentArray;
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\S[\w-]*)\s*:\s*(.*)/);
    if (kvMatch) {
      // Flush previous array
      if (currentKey && currentArray !== null) {
        result[currentKey] = currentArray;
      }

      const key = kvMatch[1];
      const rawValue = kvMatch[2].trim();

      if (rawValue === '') {
        // Start of array or empty value
        currentKey = key;
        currentArray = [];
        continue;
      }

      currentKey = null;
      currentArray = null;

      if (rawValue === 'true') {
        result[key] = true;
      } else if (rawValue === 'false') {
        result[key] = false;
      } else if (/^\d+$/.test(rawValue)) {
        result[key] = Number.parseInt(rawValue, 10);
      } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        // Inline array
        result[key] = rawValue
          .slice(1, -1)
          .split(',')
          .map((s) => unquote(s.trim()))
          .filter(Boolean);
      } else {
        result[key] = unquote(rawValue);
      }
    }
  }

  // Flush final array
  if (currentKey && currentArray !== null) {
    result[currentKey] = currentArray;
  }

  return result;
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('\'') && s.endsWith('\''))) {
    return s.slice(1, -1);
  }
  return s;
}
