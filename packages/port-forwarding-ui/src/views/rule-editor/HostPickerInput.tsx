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

import type { HostTree } from '@termlnk/terminal';
import { LocaleService } from '@termlnk/core';
import { Field, FieldContent, FieldLabel, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useDependency } from '@termlnk/design';
import { IHostManagerService } from '@termlnk/rpc-client';
import { HostType } from '@termlnk/terminal';
import { useEffect, useState } from 'react';

export interface IHostPickerInputProps {
  hostId: string | null;
  label: string;
  onChange: (hostId: string) => void;
}

interface IHostOption {
  id: string;
  label: string;
  addr: string;
  port: number;
}

function flatten(tree: HostTree[]): IHostOption[] {
  const out: IHostOption[] = [];
  const walk = (nodes: HostTree[]): void => {
    for (const node of nodes) {
      if (node.type === HostType.HOST) {
        out.push({
          id: node.id,
          label: node.label,
          addr: (node as { addr?: string }).addr ?? '',
          port: (node as { port?: number }).port ?? 22,
        });
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(tree);
  return out;
}

export function HostPickerInput({ hostId, label, onChange }: IHostPickerInputProps) {
  const localeService = useDependency(LocaleService);
  const hostManager = useDependency(IHostManagerService);
  const [hosts, setHosts] = useState<IHostOption[]>([]);

  useEffect(() => {
    let alive = true;
    void hostManager.tree().then((tree) => {
      if (alive) {
        setHosts(flatten(tree));
      }
    });
    return () => {
      alive = false;
    };
  }, [hostManager]);

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldContent>
        <Select value={hostId ?? undefined} onValueChange={onChange}>
          <SelectTrigger className="tm:w-full">
            <SelectValue placeholder={localeService.t('port-forwarding-ui.editor.addHost')} />
          </SelectTrigger>
          <SelectContent>
            {hosts.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.label}
                {' '}
                <span className="tm:text-[11px] tm:text-grey-fg">
                  (
                  {h.addr}
                  :
                  {h.port}
                  )
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
  );
}
