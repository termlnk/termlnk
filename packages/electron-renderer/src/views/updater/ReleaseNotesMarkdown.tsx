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

import type { Components } from 'react-markdown';
import { cn } from '@termlnk/design';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface IReleaseNotesMarkdownProps {
  content: string;
  className?: string;
}

interface INativeShellWindow {
  nativeShell?: {
    openExternal?: (target: string) => Promise<void> | void;
  };
}

function openExternal(url: string): void {
  const win = window as Window & INativeShellWindow;
  if (win.nativeShell?.openExternal) {
    void win.nativeShell.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1
      className="
        tm:mt-3 tm:mb-2 tm:text-base tm:font-semibold
        tm:first:mt-0
      "
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="
        tm:mt-3 tm:mb-2 tm:text-sm tm:font-semibold
        tm:first:mt-0
      "
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="
        tm:mt-2 tm:mb-1 tm:text-xs tm:font-medium tm:text-white
        tm:first:mt-0
      "
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
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
  ul: ({ children }) => (
    <ul className="tm:my-1 tm:list-disc tm:pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="tm:my-1 tm:list-decimal tm:pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="tm:my-0.5">{children}</li>,
  a: ({ href, children }) => {
    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (href) {
        openExternal(href);
      }
    };
    return (
      <a
        href={href}
        onClick={handleClick}
        className="
          tm:text-blue tm:underline tm:underline-offset-2
          tm:hover:text-nord-blue
        "
      >
        {children}
      </a>
    );
  },
  code: ({ children }) => (
    <code
      className="tm:rounded-sm tm:bg-one-bg2 tm:px-1 tm:py-0.5 tm:font-mono tm:text-[0.85em] tm:text-white"
    >
      {children}
    </code>
  ),
  strong: ({ children }) => <strong className="tm:font-semibold">{children}</strong>,
  em: ({ children }) => <em className="tm:italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote
      className="tm:my-2 tm:border-l-2 tm:border-one-bg3 tm:pl-3 tm:text-white"
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="tm:my-3 tm:border-line" />,
};

export function ReleaseNotesMarkdown({ content, className }: IReleaseNotesMarkdownProps) {
  const plugins = useMemo(() => [remarkGfm], []);

  return (
    <div className={cn('tm:text-xs/relaxed tm:text-white', className)}>
      <ReactMarkdown components={COMPONENTS} remarkPlugins={plugins}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
