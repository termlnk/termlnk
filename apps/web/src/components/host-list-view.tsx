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

import type { IBrowserHost } from '../services/browser-vault.service';
import { Quantity } from '@termlnk/core';
import { useDependency, useObservable } from '@termlnk/design';
import { HostType } from '@termlnk/terminal';
import { BrowserVaultStatus, IBrowserVaultService } from '../services/browser-vault.service';

/**
 * 浏览器端主机列表——only-when-authenticated。
 *
 * 数据通路：BrowserVaultService.hosts$ → 解密 + 内存维护
 * 状态通路：BrowserVaultService.status$（Pulling / Idle / Error / Disabled）
 * 错误通路：BrowserVaultService.lastError$（最近一次 pull 失败 message）
 */
export function HostListView() {
  const vault = useDependency(IBrowserVaultService, Quantity.OPTIONAL);

  if (!vault) {
    return (
      <p className="tm:mt-6 tm:text-sm tm:text-grey-fg">
        Cloud sync is not configured. Set
        {' '}
        <code className="tm:rounded tm:bg-one-bg tm:px-1 tm:py-0.5 tm:text-light-grey">VITE_TERMLNK_CLOUD_URL</code>
        {' '}
        to a running termlnk-server endpoint and reload.
      </p>
    );
  }

  const hosts = useObservable(vault.hosts$, []) ?? [];
  const status = useObservable(vault.status$, BrowserVaultStatus.Disabled) ?? BrowserVaultStatus.Disabled;
  const lastError = useObservable(vault.lastError$, null) ?? null;

  return (
    <section className="tm:mt-8 tm:flex tm:flex-col tm:gap-3">
      <header className="tm:flex tm:items-center tm:justify-between">
        <h2 className="tm:text-base tm:font-semibold tm:text-light-grey">Hosts</h2>
        <StatusBadge status={status} />
      </header>

      {lastError !== null
        ? (
            <p className="tm:rounded tm:border tm:border-red tm:bg-red/10 tm:px-3 tm:py-2 tm:text-xs tm:text-red">
              {lastError}
            </p>
          )
        : null}

      {status !== BrowserVaultStatus.Disabled && hosts.length === 0
        ? (
            <p className="tm:text-sm tm:text-grey-fg">
              No hosts in your vault yet. Add one from the desktop app—changes sync here.
            </p>
          )
        : null}

      <ul className="tm:flex tm:flex-col tm:gap-1">
        {hosts.map((host) => <HostRow key={host.id} host={host} />)}
      </ul>
    </section>
  );
}

function HostRow({ host }: { host: IBrowserHost }) {
  return (
    <li className="tm:flex tm:items-center tm:justify-between tm:rounded tm:bg-one-bg tm:px-3 tm:py-2 tm:text-sm tm:hover:bg-one-bg2">
      <div className="tm:flex tm:flex-col">
        <span className="tm:font-medium tm:text-light-grey">{host.label}</span>
        {host.type === HostType.HOST && host.addr
          ? <span className="tm:text-xs tm:text-grey-fg">{host.addr}{host.port ? `:${host.port}` : ''}</span>
          : null}
      </div>
      <span className="tm:rounded tm:bg-one-bg2 tm:px-2 tm:py-0.5 tm:text-[10px] tm:uppercase tm:tracking-wide tm:text-grey-fg">{host.type}</span>
    </li>
  );
}

function StatusBadge({ status }: { status: BrowserVaultStatus }) {
  const { label, className } = describeStatus(status);
  return (
    <span className={`tm:rounded tm:px-2 tm:py-0.5 tm:text-[10px] tm:uppercase tm:tracking-wide ${className}`}>
      {label}
    </span>
  );
}

function describeStatus(status: BrowserVaultStatus): { label: string; className: string } {
  switch (status) {
    case BrowserVaultStatus.Pulling:
      return { label: 'Syncing', className: 'tm:bg-yellow/15 tm:text-yellow' };
    case BrowserVaultStatus.Idle:
      return { label: 'Up to date', className: 'tm:bg-green/15 tm:text-green' };
    case BrowserVaultStatus.Error:
      return { label: 'Error', className: 'tm:bg-red/15 tm:text-red' };
    case BrowserVaultStatus.Disabled:
    default:
      return { label: 'Idle', className: 'tm:bg-one-bg2 tm:text-grey-fg' };
  }
}
