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

import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';

const RootLayout = () => {
  // Prevent the browser from navigating away when files are dragged onto the
  // window — guards against the default browser file-open behaviour.
  useEffect(() => {
    const preventDefault = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', preventDefault);
    return () => {
      document.removeEventListener('dragover', preventDefault);
      document.removeEventListener('drop', preventDefault);
    };
  }, []);

  return (
    <div className="tm:flex tm:size-full tm:bg-black">
      <Outlet />
    </div>
  );
};

export const Route = createRootRoute({ component: RootLayout });
