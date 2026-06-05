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

import type { IKnownHost } from '@termlnk/terminal';
import { LocaleService } from '@termlnk/core';
import { Badge, Button, useDependency } from '@termlnk/design';
import { IKeychainManagerService } from '@termlnk/rpc-client';
import { TooltipWrapper } from '@termlnk/ui';
import { Eraser, ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { KnownHostDetailDialog } from './KnownHostDetailDialog';

export function KnownHostsExplorer() {
  const localeService = useDependency(LocaleService);
  const keychain = useDependency(IKeychainManagerService);
  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  const [rows, setRows] = useState<IKnownHost[]>([]);
  const [detail, setDetail] = useState<IKnownHost | null>(null);

  const reload = useCallback(() => {
    keychain.listKnownHosts().then(setRows).catch(() => {});
  }, [keychain]);

  useEffect(() => {
    reload();
    const sub = keychain.onKnownHostsChanged$().subscribe(reload);
    return () => sub.unsubscribe();
  }, [keychain, reload]);

  const remove = useCallback((id: string) => {
    keychain.deleteKnownHost(id).catch(() => {});
  }, [keychain]);

  const clearAll = useCallback(() => {
    keychain.deleteKnownHosts(rows.map((r) => r.id)).catch(() => {});
  }, [keychain, rows]);

  return (
    <div className="tm:flex tm:size-full tm:flex-col tm:text-light-grey">
      <div
        className={`
          tm:box-border tm:flex tm:h-10 tm:w-full tm:flex-row tm:items-center tm:px-2 tm:text-[12px] tm:font-normal
          tm:select-none
        `}
      >
        <div className="tm:flex tm:size-full tm:items-center tm:truncate tm:overflow-hidden tm:text-white">
          {t('terminal-ui.knownHosts.title')}
        </div>
        {rows.length > 0 && (
          <TooltipWrapper side="bottom" labelKey="terminal-ui.knownHosts.action.clearAll">
            <Button variant="ghost" size="icon-xs" onClick={clearAll}>
              <Eraser strokeWidth={1.5} size={14} />
            </Button>
          </TooltipWrapper>
        )}
      </div>

      <div className="tm:min-h-0 tm:flex-1 tm:overflow-auto tm:px-2 tm:pb-2">
        {rows.length === 0
          ? (
            <div className="tm:flex tm:flex-col tm:items-center tm:gap-2 tm:py-12 tm:text-center tm:text-grey-fg">
              <ShieldCheck size={26} strokeWidth={1.4} />
              <span className="tm:px-2 tm:text-[12px]">{t('terminal-ui.knownHosts.empty')}</span>
            </div>
          )
          : (
            <ul className="tm:flex tm:flex-col tm:gap-1.5">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={`
                    tm:group
                    tm:flex tm:cursor-pointer tm:items-center tm:gap-2 tm:rounded-md tm:border tm:border-line
                    tm:bg-one-bg tm:p-2
                    tm:hover:bg-one-bg2
                  `}
                  onClick={() => setDetail(row)}
                >
                  <div className="tm:min-w-0 tm:flex-1">
                    <div className="tm:truncate tm:text-[12px] tm:text-white">
                      {row.host}
                      :
                      {row.port}
                    </div>
                    <div className="tm:truncate tm:text-[10px] tm:text-grey-fg">{row.fingerprint}</div>
                  </div>
                  <Badge variant="secondary" className="tm:text-[10px]">{row.keyType}</Badge>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="
                      tm:hidden
                      tm:group-hover:flex
                      tm:hover:bg-red/10 tm:hover:text-red
                    "
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(row.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
      </div>

      {detail && <KnownHostDetailDialog host={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
