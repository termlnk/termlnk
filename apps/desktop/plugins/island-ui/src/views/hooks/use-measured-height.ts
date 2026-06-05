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

import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

/**
 * Observe an element's layout height (ceil'd to whole px) and report it. Reads
 * the observer's `borderBoxSize` — the untransformed layout box, reflow-free —
 * rather than `getBoundingClientRect`, so an ancestor `transform: scale()`
 * can't distort the value. Callback held in a ref to avoid re-subscribing on
 * identity change.
 */
export function useMeasuredHeight(onHeight: (height: number) => void): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const onHeightRef = useRef(onHeight);
  onHeightRef.current = onHeight;

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].borderBoxSize?.[0];
      onHeightRef.current(Math.ceil(box ? box.blockSize : entries[0].contentRect.height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
