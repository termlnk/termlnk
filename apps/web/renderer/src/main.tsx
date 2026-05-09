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

import { createRoot } from 'react-dom/client';

/**
 * termlnk-web renderer entrypoint (skeleton).
 *
 * Per docs/agent/cloud-sync-architecture.md §3.2 / §7.2.3 / §8.0 P7.4,
 * this entrypoint will mirror apps/desktop/renderer/src/components/core.tsx
 * minus the Electron triplet (ElectronPlugin / ElectronRendererPlugin /
 * UpdaterUIPlugin) plus WebRendererPlugin from @termlnk/web-renderer.
 *
 * Implementation lands in P7.2 (`@termlnk/web-renderer` package) + P7.4 (this entrypoint).
 */

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Termlnk Web</h1>
      <p>Renderer skeleton — implementation lands in P7.2 + P7.4.</p>
      <p>
        See
        {' '}
        <code>docs/agent/cloud-sync-architecture.md</code>
        {' '}
        §3.2 / §7.2 / §8.0 Phase 7.
      </p>
    </div>
  );
}
