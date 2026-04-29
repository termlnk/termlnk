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

import { cn } from '@termlnk/design';
import { memo } from 'react';
import { Streamdown } from 'streamdown';

interface IMarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  isStreaming = false,
}: IMarkdownRendererProps) {
  return (
    <Streamdown
      mode={isStreaming ? 'streaming' : 'static'}
      isAnimating={isStreaming}
      shikiTheme={['github-dark-dimmed', 'github-light']}
      controls={{ table: true, code: true, mermaid: true }}
      className={cn('tm:text-sm/relaxed tm:text-white', className)}
      components={{
        pre: ({ children }) => (
          <pre className="tm:my-2 tm:overflow-x-auto tm:rounded-md tm:bg-darker-black tm:p-3 tm:text-xs">
            {children}
          </pre>
        ),
        code: ({ children, className: codeClassName }) => {
          const isInline = !codeClassName;
          if (isInline) {
            return (
              <code className="tm:rounded-sm tm:bg-one-bg2 tm:px-1.5 tm:py-0.5 tm:text-xs tm:text-sun">
                {children}
              </code>
            );
          }
          return <code className={codeClassName}>{children}</code>;
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="tm:text-blue tm:underline">
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="tm:my-1 tm:list-disc tm:pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="tm:my-1 tm:list-decimal tm:pl-5">{children}</ol>,
        li: ({ children }) => <li className="tm:my-0.5">{children}</li>,
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
        h1: ({ children }) => <h1 className="tm:mt-3 tm:mb-2 tm:text-base tm:font-semibold">{children}</h1>,
        h2: ({ children }) => <h2 className="tm:mt-3 tm:mb-2 tm:text-sm tm:font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="tm:mt-2 tm:mb-1 tm:text-sm tm:font-medium">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="tm:my-2 tm:border-l-2 tm:border-one-bg3 tm:pl-3 tm:text-light-grey">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="tm:my-2 tm:overflow-x-auto">
            <table className="tm:w-full tm:text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="tm:border tm:border-line tm:bg-one-bg tm:px-2 tm:py-1 tm:text-left tm:font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="tm:border tm:border-line tm:px-2 tm:py-1">{children}</td>
        ),
        hr: () => <hr className="tm:my-3 tm:border-line" />,
      }}
    >
      {content}
    </Streamdown>
  );
});
