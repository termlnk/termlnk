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

import type { IMobileHost } from '../storage/types';
import { useEffect, useState } from 'react';
import { useSyncService } from '../core/core-context';

export interface IHostChildren {
  readonly groups: readonly IMobileHost[];
  readonly hosts: readonly IMobileHost[];
}

const EMPTY: IHostChildren = { groups: [], hosts: [] };

// Sort within a bucket: primary key `sort` (ascending), tie-break by label.
function compareSort(a: IMobileHost, b: IMobileHost): number {
  const left = a.sort ?? 0;
  const right = b.sort ?? 0;
  if (left !== right) {
    return left - right;
  }
  return a.label.localeCompare(b.label);
}

// Derive the immediate children of `parentId` ('root' or a group id) from the
// flat hosts$ stream. The repository keeps the full tree as a single list, so
// the UI does its own bucketing on every emission. This is O(n) per pull and
// O(1) per render past the initial subscription — fine for the host counts we
// expect on mobile (low hundreds at most).
export function useHostChildren(parentId: string): IHostChildren {
  const pull = useSyncService();
  const [children, setChildren] = useState<IHostChildren>(EMPTY);

  useEffect(() => {
    const sub = pull.hosts$.subscribe((hosts) => {
      const groups: IMobileHost[] = [];
      const leaves: IMobileHost[] = [];
      for (const host of hosts) {
        if (host.pid !== parentId) {
          continue;
        }
        if (host.type === 'group') {
          groups.push(host);
        } else {
          leaves.push(host);
        }
      }
      groups.sort(compareSort);
      leaves.sort(compareSort);
      setChildren({ groups, hosts: leaves });
    });
    return () => sub.unsubscribe();
  }, [pull, parentId]);

  return children;
}

// Recursive count for the group label ("12 items" subtitle). Counts all
// descendants — hosts and nested groups — under `groupId`.
export function useDescendantCount(groupId: string): number {
  const pull = useSyncService();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sub = pull.hosts$.subscribe((hosts) => {
      const byParent = new Map<string, IMobileHost[]>();
      for (const host of hosts) {
        const bucket = byParent.get(host.pid);
        if (bucket) {
          bucket.push(host);
        } else {
          byParent.set(host.pid, [host]);
        }
      }
      const stack = [groupId];
      let total = 0;
      while (stack.length > 0) {
        const current = stack.pop()!;
        const children = byParent.get(current);
        if (!children) {
          continue;
        }
        for (const child of children) {
          total++;
          if (child.type === 'group') {
            stack.push(child.id);
          }
        }
      }
      setCount(total);
    });
    return () => sub.unsubscribe();
  }, [pull, groupId]);

  return count;
}

export function useHostById(hostId: string): IMobileHost | null {
  const pull = useSyncService();
  const [host, setHost] = useState<IMobileHost | null>(null);

  useEffect(() => {
    const sub = pull.hosts$.subscribe((hosts) => {
      setHost(hosts.find((h) => h.id === hostId) ?? null);
    });
    return () => sub.unsubscribe();
  }, [pull, hostId]);

  return host;
}
