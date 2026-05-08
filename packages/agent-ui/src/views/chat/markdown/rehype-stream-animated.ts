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

import type { Element, ElementContent, Properties, Root } from 'hast';
import type { BuildVisitor } from 'unist-util-visit';
import { visit } from 'unist-util-visit';

export interface IStreamAnimatedOptions {
  births?: number[];
  fadeDuration?: number;
  nowMs?: number;
  revealed?: boolean;
}

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);
const SKIP_TAGS = new Set(['pre', 'code', 'table', 'svg']);

function hasClass(node: Element, cls: string): boolean {
  const cn = node.properties?.className;
  if (Array.isArray(cn)) {
    return cn.some((c) => String(c).includes(cls));
  }
  if (typeof cn === 'string') {
    return cn.includes(cls);
  }
  return false;
}

// Wraps each char in a paragraph-style block in <span class="stream-char">.
// Negative animation-delay seeks in-flight chars to their current position,
// so a burst of input cascades instead of all chars appearing at once.
// Code blocks / tables / SVGs are skipped — they appear atomically.
export function rehypeStreamAnimated(options: IStreamAnimatedOptions = {}) {
  const { births, fadeDuration = 280, nowMs, revealed = false } = options;
  const hasBirths = !revealed && Array.isArray(births) && typeof nowMs === 'number';

  return (tree: Root) => {
    let globalCharIndex = 0;

    const shouldSkip = (node: Element): boolean => {
      return SKIP_TAGS.has(node.tagName) || hasClass(node, 'katex');
    };

    const wrapText = (node: Element) => {
      const newChildren: ElementContent[] = [];
      for (const child of node.children) {
        if (child.type === 'text') {
          for (const char of child.value) {
            let className = 'stream-char';
            let delay: number | undefined;

            if (revealed) {
              className = 'stream-char stream-char-revealed';
            } else if (hasBirths) {
              const birthTs = births![globalCharIndex];
              if (birthTs === undefined) {
                className = 'stream-char stream-char-revealed';
              } else {
                const elapsed = (nowMs as number) - birthTs;
                if (elapsed >= fadeDuration) {
                  className = 'stream-char stream-char-revealed';
                } else {
                  // Negative = mid-fade seek; positive = staggered into future.
                  delay = -elapsed;
                }
              }
            }

            const properties: Properties = { className };
            if (delay !== undefined && delay !== 0) {
              properties.style = `animation-delay:${delay}ms`;
            }
            newChildren.push({
              children: [{ type: 'text', value: char }],
              properties,
              tagName: 'span',
              type: 'element',
            });
            globalCharIndex++;
          }
        } else if (child.type === 'element') {
          if (!shouldSkip(child)) {
            wrapText(child);
          }
          newChildren.push(child);
        } else {
          newChildren.push(child);
        }
      }
      node.children = newChildren;
    };

    visit(tree, 'element', ((node: Element) => {
      if (shouldSkip(node)) {
        return 'skip';
      }
      if (BLOCK_TAGS.has(node.tagName)) {
        wrapText(node);
        return 'skip';
      }
    }) as BuildVisitor<Root, 'element'>);
  };
}
