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

import type { Pluggable, PluggableList } from 'unified';
import { memo, useMemo } from 'react';
import { Block, defaultRehypePlugins, defaultRemarkPlugins } from 'streamdown';
import { rehypeStreamAnimated } from './rehype-stream-animated';
import { useStreamingBlocks } from './streaming-blocks-context';

type IBlockComponentProps = React.ComponentProps<typeof Block>;

// Module-level constant so streamdown's <Block> memo short-circuits on settled blocks.
const REVEALED_STREAM_PLUGIN: Pluggable = [rehypeStreamAnimated, { revealed: true }];

// LaTeX (katex / math) is intentionally dropped — terminal-side chat does not need it.
const SHARED_REHYPE_BASE: PluggableList = Object.entries(defaultRehypePlugins)
  .filter(([key]) => key !== 'katex')
  .map(([, plugin]) => plugin);

const SHARED_REMARK_BASE: PluggableList = Object.entries(defaultRemarkPlugins)
  .filter(([key]) => key !== 'math')
  .map(([, plugin]) => plugin);

const SHARED_REVEALED_REHYPE: PluggableList = [...SHARED_REHYPE_BASE, REVEALED_STREAM_PLUGIN];

const MERMAID_FENCE_RE = /^\s*```mermaid\b/;

// Half-written mermaid would crash streamdown's lazy renderer every frame —
// fall back to plain code while the block is still streaming.
function PlainPre({ children, ...rest }: React.HTMLAttributes<HTMLPreElement>) {
  return (
    <pre {...rest} className="tm:my-2 tm:overflow-x-auto tm:rounded-md tm:bg-darker-black tm:p-3 tm:text-xs">
      {children}
    </pre>
  );
}

function PlainCode({ children, className, ...rest }: React.HTMLAttributes<HTMLElement> & { className?: string }) {
  return (
    <code {...rest} className={className}>
      {children}
    </code>
  );
}

const PLAIN_FENCE_COMPONENTS = {
  pre: PlainPre,
  code: PlainCode,
} as const;

export const StreamingMarkdownBlock = memo(function StreamingMarkdownBlock(
  props: IBlockComponentProps
) {
  const { content, index } = props as { content: string; index: number };
  const ctx = useStreamingBlocks();
  const block = ctx.blocks[index];
  const state = block ? ctx.getBlockState(index) : 'queued';
  const startOffset = block?.startOffset ?? 0;
  const meta = ctx.animationMetaByOffset.get(startOffset);
  const births = ctx.birthsByOffset.get(startOffset);

  const rehypePlugins = useMemo<PluggableList>(() => {
    if (meta?.settled) {
      return SHARED_REVEALED_REHYPE;
    }
    return [
      ...SHARED_REHYPE_BASE,
      [
        rehypeStreamAnimated,
        { births, fadeDuration: ctx.fadeDuration, nowMs: ctx.renderNow },
      ],
    ];
  }, [meta?.settled, births, ctx.fadeDuration, ctx.renderNow]);

  const isStreamingMermaid = state === 'streaming' && !!content && MERMAID_FENCE_RE.test(content);
  const components = useMemo(() => {
    if (!isStreamingMermaid) {
      return props.components;
    }
    return { ...(props.components ?? {}), ...PLAIN_FENCE_COMPONENTS };
  }, [isStreamingMermaid, props.components]);

  return (
    <Block
      {...props}
      components={components}
      rehypePlugins={rehypePlugins}
      remarkPlugins={SHARED_REMARK_BASE}
    />
  );
});
