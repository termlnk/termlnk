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

import type { ITextPart } from '@termlnk/agent';
import { memo } from 'react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { useSmoothStream } from '../use-smooth-stream';

interface ITextPartProps {
  part: ITextPart;
  isStreaming: boolean;
  showStreamingCursor: boolean;
}

export const TextPart = memo(function TextPart({ part, isStreaming, showStreamingCursor }: ITextPartProps) {
  const displayed = useSmoothStream(part.text, isStreaming);

  return (
    <div className="tm:text-white">
      <MarkdownRenderer content={displayed} isStreaming={isStreaming} />
      {showStreamingCursor && (
        <span className="tm-stream-cursor tm:text-nord-blue" aria-hidden />
      )}
    </div>
  );
});
