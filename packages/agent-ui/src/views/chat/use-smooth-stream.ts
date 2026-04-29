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

const FRAME_DURATION_MS = 1000 / 60;
const CHARS_PER_SECOND_FAST = 360;
const CHARS_PER_SECOND_SLOW = 60;
const DECAY_FACTOR = 0.18;

/**
 * RAF-driven smooth text reveal. Maintains a `displayed` cursor that chases the
 * `target` length each frame; chase speed is proportional to remaining gap with
 * a decay factor, so the cursor accelerates when far behind and decelerates as
 * it approaches the tail. When `isStreaming` flips to false the entire content
 * is committed immediately so the user is not blocked on animation finishing.
 */
export function useSmoothStream(content: string, isStreaming: boolean): string {
  const [displayed, setDisplayed] = useState(content);
  const targetRef = useRef(content);
  const cursorRef = useRef(content.length);
  const rafRef = useRef(0);

  targetRef.current = content;

  useEffect(() => {
    if (!isStreaming) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      cursorRef.current = content.length;
      setDisplayed(content);
      return;
    }

    if (content.length < cursorRef.current) {
      cursorRef.current = content.length;
      setDisplayed(content);
    }

    let lastFrame = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = now - lastFrame;
      lastFrame = now;

      const target = targetRef.current.length;
      const current = cursorRef.current;
      const remaining = target - current;

      if (remaining <= 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const baseRate = CHARS_PER_SECOND_SLOW;
      const proportionalRate = remaining * DECAY_FACTOR * (1000 / FRAME_DURATION_MS);
      const charsPerSec = Math.min(CHARS_PER_SECOND_FAST, Math.max(baseRate, proportionalRate));
      const advance = Math.max(1, Math.ceil(charsPerSec * (dt / 1000)));
      const next = Math.min(current + advance, target);

      cursorRef.current = next;
      setDisplayed(targetRef.current.slice(0, next));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [isStreaming, content]);

  useEffect(() => {
    if (content === '') {
      cursorRef.current = 0;
      setDisplayed('');
    }
  }, [content]);

  return isStreaming ? displayed : content;
}
