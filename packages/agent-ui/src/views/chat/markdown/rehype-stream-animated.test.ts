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

import type { Element, Root } from 'hast';
import { describe, expect, it } from 'vitest';
import { rehypeStreamAnimated } from './rehype-stream-animated';

function makeBlock(tagName: string, text: string): Element {
  return {
    children: [{ type: 'text', value: text }],
    properties: {},
    tagName,
    type: 'element',
  };
}

function makeTree(...nodes: Element[]): Root {
  return { children: nodes, type: 'root' };
}

function collectSpans(node: Element): Element[] {
  const out: Element[] = [];
  for (const child of node.children) {
    if (child.type === 'element' && child.tagName === 'span') {
      out.push(child);
    }
  }
  return out;
}

describe('rehypeStreamAnimated', () => {
  it('wraps every text char inside paragraph-style block elements with stream-char span', () => {
    const tree = makeTree(makeBlock('p', 'ab'));
    rehypeStreamAnimated({ revealed: true })(tree);
    const spans = collectSpans(tree.children[0] as Element);
    expect(spans).toHaveLength(2);
    expect((spans[0].children[0] as { value: string }).value).toBe('a');
    expect((spans[1].children[0] as { value: string }).value).toBe('b');
    expect(spans[0].properties?.className).toBe('stream-char stream-char-revealed');
  });

  it('emits stream-char-revealed (no animation-delay) when revealed=true', () => {
    const tree = makeTree(makeBlock('p', 'x'));
    rehypeStreamAnimated({ revealed: true })(tree);
    const span = collectSpans(tree.children[0] as Element)[0];
    expect(span.properties?.className).toBe('stream-char stream-char-revealed');
    expect(span.properties?.style).toBeUndefined();
  });

  it('produces a negative animation-delay for chars currently inside their fade window', () => {
    const now = 1000;
    const tree = makeTree(makeBlock('p', 'xy'));
    rehypeStreamAnimated({
      births: [now - 100, now - 50],
      fadeDuration: 280,
      nowMs: now,
    })(tree);
    const spans = collectSpans(tree.children[0] as Element);
    expect(spans[0].properties?.style).toBe('animation-delay:-100ms');
    expect(spans[1].properties?.style).toBe('animation-delay:-50ms');
    expect(spans[0].properties?.className).toBe('stream-char');
  });

  it('marks chars whose fade window already expired as stream-char-revealed', () => {
    const now = 1000;
    const tree = makeTree(makeBlock('p', 'xy'));
    rehypeStreamAnimated({
      births: [now - 500, now - 50],
      fadeDuration: 280,
      nowMs: now,
    })(tree);
    const spans = collectSpans(tree.children[0] as Element);
    expect(spans[0].properties?.className).toBe('stream-char stream-char-revealed');
    expect(spans[0].properties?.style).toBeUndefined();
    expect(spans[1].properties?.className).toBe('stream-char');
  });

  it('counts chars by code point so emoji and CJK do not split mid-character', () => {
    const tree = makeTree(makeBlock('p', '中文😀'));
    rehypeStreamAnimated({ revealed: true })(tree);
    const spans = collectSpans(tree.children[0] as Element);
    expect(spans).toHaveLength(3);
    expect((spans[2].children[0] as { value: string }).value).toBe('😀');
  });

  it('does NOT wrap text inside SKIP_TAGS (pre, code, table, svg)', () => {
    const tree = makeTree(makeBlock('pre', 'abc'), makeBlock('code', 'xyz'));
    rehypeStreamAnimated({ revealed: true })(tree);
    for (const node of tree.children as Element[]) {
      expect(node.children[0]?.type).toBe('text');
      expect(collectSpans(node)).toHaveLength(0);
    }
  });

  it('only wraps inside BLOCK_TAGS (p, h1-h6, li); leaves plain divs alone', () => {
    const tree = makeTree(
      makeBlock('div', 'untouched'),
      makeBlock('h2', 'wrapped'),
      makeBlock('li', 'wrapped')
    );
    rehypeStreamAnimated({ revealed: true })(tree);
    expect(collectSpans(tree.children[0] as Element)).toHaveLength(0);
    expect(collectSpans(tree.children[1] as Element)).toHaveLength(7);
    expect(collectSpans(tree.children[2] as Element)).toHaveLength(7);
  });

  it('uses stream-char-revealed when births array runs short of the char count', () => {
    const tree = makeTree(makeBlock('p', 'abc'));
    rehypeStreamAnimated({
      births: [Date.now()],
      fadeDuration: 280,
      nowMs: Date.now() + 1000,
    })(tree);
    const spans = collectSpans(tree.children[0] as Element);
    // index 0 born long ago → revealed; index 1/2 have no birth → fall back to revealed too
    expect(spans[1].properties?.className).toBe('stream-char stream-char-revealed');
    expect(spans[2].properties?.className).toBe('stream-char stream-char-revealed');
  });
});
