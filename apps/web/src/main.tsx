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

import { createRouter, RouterProvider } from '@tanstack/react-router';
import { connectInjector } from '@termlnk/design';
import { createRoot } from 'react-dom/client';
import { createWebCore } from './core';
import { routeTree } from './routeTree.gen';
import './index.css';

const core = createWebCore();
const injector = core.getInjector();

const router = createRouter({
  routeTree,
  trailingSlash: 'preserve',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const App = connectInjector(() => <RouterProvider router={router} />, injector);

const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
