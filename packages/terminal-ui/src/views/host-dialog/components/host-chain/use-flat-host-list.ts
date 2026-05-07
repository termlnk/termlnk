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

import type { HostTree, IHost } from '@termlnk/terminal';
import { useDependency } from '@termlnk/design';
import { IHostManagerService } from '@termlnk/rpc-client';
import { HostType } from '@termlnk/terminal';
import { useEffect, useMemo, useState } from 'react';

export interface IFlatHostInfo {
  id: string;
  label: string;
  addr: string;
  port: number;
}

function flattenTree(nodes: HostTree[]): IFlatHostInfo[] {
  const result: IFlatHostInfo[] = [];
  const walk = (list: HostTree[]) => {
    for (const node of list) {
      if (node.type === HostType.HOST) {
        const host = node as HostTree & IHost;
        result.push({
          id: host.id,
          label: host.label,
          addr: host.addr,
          port: host.port,
        });
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return result;
}

export interface IUseFlatHostListResult {
  allHosts: IFlatHostInfo[];
  hostMap: Map<string, IFlatHostInfo>;
  loaded: boolean;
}

export function useFlatHostList(): IUseFlatHostListResult {
  const hostManagerService = useDependency(IHostManagerService);
  const [allHosts, setAllHosts] = useState<IFlatHostInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hostManagerService.tree().then((tree) => {
      if (cancelled) {
        return;
      }
      setAllHosts(flattenTree(tree));
      setLoaded(true);
    }).catch(() => {
      if (cancelled) {
        return;
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hostManagerService]);

  const hostMap = useMemo(() => {
    const map = new Map<string, IFlatHostInfo>();
    allHosts.forEach((h) => map.set(h.id, h));
    return map;
  }, [allHosts]);

  return { allHosts, hostMap, loaded };
}
