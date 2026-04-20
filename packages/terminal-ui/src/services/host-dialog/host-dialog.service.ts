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

import type { Nullable } from '@termlnk/core';
import type { HostItem, IProxy } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import type { HostFormItem, IHostDialogState } from '../../models/host-dialog.state';
import { Disposable } from '@termlnk/core';
import { IHostManagerService } from '@termlnk/rpc-client';
import { DEFAULT_HOST_ROOT } from '@termlnk/terminal';
import { createDefaultHostItem, DEFAULT_HOST_SETTINGS, HostDialogMode, HostDialogStateModel } from '../../models/host-dialog.state';

export class HostDialogService extends Disposable {
  private readonly _model = new HostDialogStateModel();

  get stateUpdate$(): Observable<Partial<IHostDialogState>> {
    return this._model.stateUpdate$;
  }

  get state$(): Observable<IHostDialogState> {
    return this._model.state$;
  }

  get state(): IHostDialogState {
    return this._model.state;
  }

  constructor(
    @IHostManagerService private readonly _hostManagerService: IHostManagerService
  ) {
    super();
  }

  async start(options: Partial<Omit<IHostDialogState, 'item'> & { hostId?: string }>): Promise<void> {
    const {
      open = false,
      parentId = DEFAULT_HOST_ROOT,
      mode = HostDialogMode.CREATE,
      hostId,
    } = options;

    let item: HostFormItem = createDefaultHostItem();
    if (mode === HostDialogMode.EDIT) {
      const hostItem: Nullable<HostItem> = await this._hostManagerService.getInfo(hostId!);
      if (!hostItem) {
        throw new Error(`Host ${hostId} not found.`);
      }
      item = hostItem as HostFormItem;
      item.settings = { ...DEFAULT_HOST_SETTINGS, ...item.settings };
    } else {
      item.pid = parentId;
    }

    this._model.changeState({
      open,
      parentId,
      mode,
      item,
    });
  }

  changeState(newState: Partial<IHostDialogState>) {
    this._model.changeState(newState);
  }

  async confirm(): Promise<void> {
    const { item, mode } = this._model.state;
    const hostItem = { ...item } as HostItem & { proxy?: Partial<IProxy> | null };
    hostItem.proxy = this._normalizeProxy(hostItem.proxy);

    if (mode === HostDialogMode.CREATE) {
      await this._hostManagerService.create(hostItem);
    } else {
      await this._hostManagerService.update(hostItem);
    }
  }

  private _normalizeProxy(proxy?: Partial<IProxy> | null): IProxy | null {
    if (!proxy) return null;
    if (!proxy.enabled) return null;

    return {
      enabled: true,
      type: proxy.type ?? 'socks5',
      host: proxy.host?.trim() ?? '',
      port: typeof proxy.port === 'number' && Number.isFinite(proxy.port) ? proxy.port : 0,
      ...(proxy.username?.trim() && { username: proxy.username.trim() }),
      ...(proxy.password?.trim() && { password: proxy.password.trim() }),
    };
  }

  terminate() {
    this._model.changeState({ open: false });
  }
}
