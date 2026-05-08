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

import type { IBlockAnimationMeta } from './stream-animation-meta';
import type { IStreamingBlocksContextValue } from './streaming-blocks-context';
import type { IStreamSmoothingPreset } from './use-smooth-stream-content';
import type { IBlockInfo, IBlockState } from './use-stream-queue';
import { cn } from '@termlnk/design';
import { memo, useEffect, useMemo, useRef } from 'react';
import remend from 'remend';
import { parseMarkdownIntoBlocks, Streamdown } from 'streamdown';
import { resolveBlockAnimationMeta } from './stream-animation-meta';
import { StreamingBlocksContext } from './streaming-blocks-context';
import { StreamingMarkdownBlock } from './StreamingMarkdownBlock';
import { useSmoothStreamContent } from './use-smooth-stream-content';
import { useStreamQueue } from './use-stream-queue';

export type { IStreamSmoothingPreset } from './use-smooth-stream-content';

export interface IMarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
  preset?: IStreamSmoothingPreset;
}

const STREAM_FADE_DURATION = 280;

// Override only paragraph-style elements; <code>/<pre>/<table> are left to
// streamdown defaults so Shiki / Mermaid / table-copy controls stay live.
const CHAT_MARKDOWN_COMPONENTS = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="tm:text-blue tm:underline">
      {children}
    </a>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="tm:my-1 tm:list-disc tm:pl-5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="tm:my-1 tm:list-decimal tm:pl-5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="tm:my-0.5">{children}</li>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p
      className="
        tm:my-1.5
        tm:first:mt-0
        tm:last:mb-0
      "
    >
      {children}
    </p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="tm:mt-3 tm:mb-2 tm:text-base tm:font-semibold">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="tm:mt-3 tm:mb-2 tm:text-sm tm:font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="tm:mt-2 tm:mb-1 tm:text-sm tm:font-medium">{children}</h3>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="tm:my-2 tm:border-l-2 tm:border-one-bg3 tm:pl-3 tm:text-light-grey">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="tm:my-3 tm:border-line" />,
};

function getNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function countChars(text: string): number {
  return [...text].length;
}

function buildBlocks(processed: string): IBlockInfo[] {
  const raws = parseMarkdownIntoBlocks(processed);
  let offset = 0;
  return raws.map((c) => {
    const block: IBlockInfo = { content: c, startOffset: offset };
    offset += c.length;
    return block;
  });
}

function buildBirthsByOffset(args: {
  blocks: IBlockInfo[];
  charDelay: number;
  fadeDuration: number;
  getBlockState: (index: number) => IBlockState;
  prevBirths: Map<number, number[]>;
  renderNow: number;
}): Map<number, number[]> {
  const { blocks, charDelay, fadeDuration, getBlockState, prevBirths, renderNow } = args;
  const next = new Map<number, number[]>();

  for (const [index, block] of blocks.entries()) {
    // Defer queued blocks: assign births only when they enter animating/streaming.
    if (getBlockState(index) === 'queued') {
      continue;
    }

    const charCount = countChars(block.content);
    const prev = prevBirths.get(block.startOffset);
    let arr: number[];

    if (prev && prev.length === charCount) {
      arr = prev;
    } else if (prev && prev.length > charCount) {
      arr = prev.slice(0, charCount);
    } else {
      arr = prev ? prev.slice() : [];
      const startIdx = arr.length;
      // Chain new chars monotonically; cap the queue at renderNow + fadeDuration
      // so tails never accumulate invisible backlog when cps > fade rate.
      const cap = renderNow + fadeDuration;
      for (let i = startIdx; i < charCount; i++) {
        const prevBirth = i > 0 ? (arr[i - 1] as number) : renderNow - charDelay;
        const chained = prevBirth + charDelay;
        arr.push(Math.min(cap, Math.max(chained, renderNow)));
      }
    }

    next.set(block.startOffset, arr);
  }

  return next;
}

function buildAnimationMetaByOffset(args: {
  blocks: IBlockInfo[];
  birthsByOffset: Map<number, number[]>;
  charDelay: number;
  fadeDuration: number;
  getBlockState: (index: number) => IBlockState;
  prevCharDelay: Map<number, number>;
  renderNow: number;
}): Map<number, IBlockAnimationMeta> {
  const {
    blocks,
    birthsByOffset,
    charDelay,
    fadeDuration,
    getBlockState,
    prevCharDelay,
    renderNow,
  } = args;
  const next = new Map<number, IBlockAnimationMeta>();

  for (const [index, block] of blocks.entries()) {
    const state = getBlockState(index);
    const births = birthsByOffset.get(block.startOffset);
    const lastBirthTs = births && births.length > 0 ? (births.at(-1) ?? renderNow) : renderNow;
    const lastElapsedMs = renderNow - lastBirthTs;
    const meta = resolveBlockAnimationMeta({
      currentCharDelay: charDelay,
      fadeDuration,
      lastElapsedMs,
      previousCharDelay: prevCharDelay.get(block.startOffset),
      state,
    });
    next.set(block.startOffset, meta);
  }

  return next;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isStreaming = false,
  className,
  preset = 'balanced',
}: IMarkdownRendererProps) {
  const smoothed = useSmoothStreamContent(content, { enabled: isStreaming, preset });
  const processed = useMemo(() => remend(smoothed), [smoothed]);

  const blocks = useMemo<IBlockInfo[]>(() => buildBlocks(processed), [processed]);

  const { getBlockState, charDelay } = useStreamQueue(blocks);

  const birthsRef = useRef<Map<number, number[]>>(new Map());
  const charDelayRef = useRef<Map<number, number>>(new Map());

  const renderNow = getNow();

  const birthsByOffset = useMemo(
    () =>
      buildBirthsByOffset({
        blocks,
        charDelay,
        fadeDuration: STREAM_FADE_DURATION,
        getBlockState,
        prevBirths: birthsRef.current,
        renderNow,
      }),
    [blocks, charDelay, getBlockState, renderNow]
  );

  const animationMetaByOffset = useMemo(
    () =>
      buildAnimationMetaByOffset({
        blocks,
        birthsByOffset,
        charDelay,
        fadeDuration: STREAM_FADE_DURATION,
        getBlockState,
        prevCharDelay: charDelayRef.current,
        renderNow,
      }),
    [blocks, birthsByOffset, charDelay, getBlockState, renderNow]
  );

  // Persist per-offset state across renders; rebuild from current blocks each
  // time so removed offsets drop out (prevents unbounded map growth).
  useEffect(() => {
    birthsRef.current = birthsByOffset;
    const nextCharDelay = new Map<number, number>();
    for (const [offset, meta] of animationMetaByOffset) {
      nextCharDelay.set(offset, meta.charDelay);
    }
    charDelayRef.current = nextCharDelay;
  }, [birthsByOffset, animationMetaByOffset]);

  const ctxValue = useMemo<IStreamingBlocksContextValue>(
    () => ({
      animationMetaByOffset,
      birthsByOffset,
      blocks,
      fadeDuration: STREAM_FADE_DURATION,
      getBlockState,
      renderNow,
    }),
    [animationMetaByOffset, birthsByOffset, blocks, getBlockState, renderNow]
  );

  return (
    <StreamingBlocksContext.Provider value={ctxValue}>
      <Streamdown
        BlockComponent={StreamingMarkdownBlock}
        className={cn('tm:text-sm/relaxed tm:text-white', className)}
        components={CHAT_MARKDOWN_COMPONENTS}
        controls={{ table: true, code: true, mermaid: true }}
        isAnimating={isStreaming}
        mode={isStreaming ? 'streaming' : 'static'}
        parseMarkdownIntoBlocksFn={parseMarkdownIntoBlocks}
        shikiTheme={['github-light', 'github-dark-dimmed']}
      >
        {processed}
      </Streamdown>
    </StreamingBlocksContext.Provider>
  );
});
