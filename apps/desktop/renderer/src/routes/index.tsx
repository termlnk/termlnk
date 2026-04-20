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

import type { Core } from '@termlnk/core';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { createCore } from '../components/core';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<Core>(null);

  useEffect(() => {
    coreRef.current = createCore(containerRef.current!);

    return () => {
      if (coreRef.current) {
        coreRef.current.dispose();
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="tm:flex-1" />
  );
}
