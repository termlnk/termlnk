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

import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly reveals streaming text with an ease-in acceleration curve.
 * Starts slow (1 char/frame) and gradually ramps up, giving a natural
 * typewriter-to-fast-stream feel.
 *
 * @param content - The full content string (may grow during streaming)
 * @param isStreaming - Whether content is still being streamed
 * @returns The portion of content to display
 */
export function useTypewriter(content: string, isStreaming: boolean): string {
  const [displayedLength, setDisplayedLength] = useState(0);
  const targetRef = useRef(content);
  const rafRef = useRef(0);
  const displayedRef = useRef(0);
  const frameCountRef = useRef(0);

  // Keep target ref in sync
  targetRef.current = content;

  // Animation loop using refs to avoid stale closures
  useEffect(() => {
    if (!isStreaming) {
      // When streaming ends, immediately show everything
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      frameCountRef.current = 0;
      displayedRef.current = content.length;
      setDisplayedLength(content.length);
      return;
    }

    frameCountRef.current = 0;

    const tick = () => {
      const target = targetRef.current.length;
      const current = displayedRef.current;
      const remaining = target - current;

      if (remaining <= 0) {
        // Caught up, wait for more content
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      frameCountRef.current++;

      // Ease-in acceleration: starts at 1, ramps up over ~90 frames (~1.5s)
      // speed = 1 + (frame / 30)^1.5, capped at 12
      const t = frameCountRef.current / 30;
      const speed = Math.min(Math.ceil(1 + t * t * Math.sqrt(t)), 12);

      displayedRef.current = Math.min(current + speed, target);
      setDisplayedLength(displayedRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [isStreaming]); // Only re-run when streaming state changes

  // Reset when content is cleared (new conversation)
  useEffect(() => {
    if (content === '') {
      displayedRef.current = 0;
      setDisplayedLength(0);
    }
  }, [content]);

  return isStreaming ? content.slice(0, displayedLength) : content;
}
