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
import { Button, cn, Popover, PopoverContent, PopoverTrigger, useDependency } from '@termlnk/design';
import { IHostManagerService } from '@termlnk/rpc-client';
import { HostType } from '@termlnk/terminal';
import { ChevronDown, Server } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface IHostSelectorProps {
  selectedHostId: string | null;
  selectedHostName: string;
  onSelect: (hostId: string, hostName: string, hostAddress: string) => void;
}

interface IFlatHost {
  id: string;
  name: string;
  address: string;
  port: number;
}

function flattenHosts(tree: HostTree[]): IFlatHost[] {
  const result: IFlatHost[] = [];
  for (const node of tree) {
    if (node.type === HostType.HOST) {
      const host = node as IHost & { children: HostTree[] };
      result.push({
        id: host.id,
        name: host.label,
        address: host.addr,
        port: host.port,
      });
    }
    if (node.children?.length) {
      result.push(...flattenHosts(node.children));
    }
  }
  return result;
}

export function HostSelector({ selectedHostId, selectedHostName, onSelect }: IHostSelectorProps) {
  const hostManager = useDependency(IHostManagerService);
  const [hosts, setHosts] = useState<IFlatHost[]>([]);
  const [open, setOpen] = useState(false);

  const loadHosts = useCallback(async () => {
    try {
      const tree = await hostManager.tree();
      setHosts(flattenHosts(tree));
    } catch {
      setHosts([]);
    }
  }, [hostManager]);

  useEffect(() => {
    if (open) {
      loadHosts();
    }
  }, [open, loadHosts]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="
            tm:gap-1.5 tm:px-3 tm:text-white
            tm:hover:text-white
            tm:aria-expanded:text-white
          "
        >
          <Server size={14} strokeWidth={1.6} className="tm:text-white" />
          <span className="tm:truncate tm:text-white">
            {selectedHostId ? selectedHostName : 'Select Host'}
          </span>
          <ChevronDown
            size={14}
            className={cn('tm:text-light-grey tm:transition-transform', open && 'tm:rotate-180')}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="tm:w-64 tm:p-1">
        {hosts.length === 0 && (
          <div className="tm:px-3 tm:py-4 tm:text-center tm:text-[12px] tm:text-grey-fg">
            No hosts available
          </div>
        )}
        <div className="tm:max-h-[280px] tm:overflow-y-auto">
          {hosts.map((host) => (
            <div
              key={host.id}
              className={cn(
                `
                  tm:flex tm:items-center tm:gap-2 tm:rounded-md tm:px-2.5 tm:py-2 tm:text-[13px]
                  tm:hover:bg-one-bg2
                `,
                {
                  'tm:bg-one-bg2 tm:text-blue': selectedHostId === host.id,
                }
              )}
              onClick={() => {
                onSelect(host.id, host.name, `${host.address}:${host.port}`);
                setOpen(false);
              }}
            >
              <Server size={14} strokeWidth={1.4} className="tm:shrink-0 tm:text-white" />
              <div className="tm:flex tm:min-w-0 tm:flex-col">
                <span className="tm:truncate tm:text-white">{host.name}</span>
                <span className="tm:truncate tm:text-[11px] tm:text-light-grey">
                  {host.address}
                  {host.port !== 22 ? `:${host.port}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
