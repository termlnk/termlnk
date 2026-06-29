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

import type { MenuAction } from '@react-native-menu/menu';
import type { IMenuAction, IMenuItem } from './menu-types';

export function isMenuAction(item: IMenuItem): item is IMenuAction {
  return !('divider' in item);
}

// Group adjacent actions and emit one inline subaction group per divider boundary
// so the iOS context menu draws separators between them. A single group flattens
// back to a flat MenuAction[] (no synthetic wrapper needed).
export function toNativeMenuActions(items: readonly IMenuItem[]): MenuAction[] {
  const groups: IMenuAction[][] = [];
  let current: IMenuAction[] = [];
  for (const item of items) {
    if ('divider' in item) {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(item);
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }

  if (groups.length <= 1) {
    return groups.flatMap((g) => g.map(toNativeMenuAction));
  }

  return groups.map((group, i) => ({
    id: `__group_${i}`,
    title: '',
    displayInline: true,
    subactions: group.map(toNativeMenuAction),
  }));
}

export function toNativeMenuAction(item: IMenuAction): MenuAction {
  return {
    id: item.key,
    title: item.label,
    image: item.sfSymbol,
    attributes: {
      destructive: item.destructive,
    },
  };
}
