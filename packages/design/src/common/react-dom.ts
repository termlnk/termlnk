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

import type { ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';

const rootMap = new WeakMap<Element | DocumentFragment, Root>();

export function render(node: ReactElement, container: Element | DocumentFragment) {
  let root = rootMap.get(container);

  if (!root) {
    root = createRoot(container);
    rootMap.set(container, root);
  }

  root.render(node);
}

export function unmount(container: Element | DocumentFragment) {
  const root = rootMap.get(container);
  if (root) {
    root.unmount();
    rootMap.delete(container);
  }
}
