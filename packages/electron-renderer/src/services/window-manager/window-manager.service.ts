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

import type { ICreateWindowOptions, IWindowManagerService, IWindowState, WindowEvent } from '@termlnk/electron';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '@termlnk/rpc-client';
import { EMPTY } from 'rxjs';

export class WindowManagerService extends Disposable implements IWindowManagerService {
  readonly windowState$: Observable<Map<number, IWindowState>> = EMPTY;
  readonly windowEvent$: Observable<Map<number, WindowEvent>> = EMPTY;
  readonly windowCreated$: Observable<number> = EMPTY;
  readonly windowClosed$: Observable<number> = EMPTY;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    const client = this._rpcClientService.getClient() as any;
    return client.window;
  }

  async getCurrentWindowId(): Promise<number> {
    return this._client.getCurrentWindowId.query();
  }

  async createWindow(url: string, options?: ICreateWindowOptions): Promise<number> {
    return this._client.createWindow.mutate({ url, options: options as any });
  }

  async hasWindow(id: number): Promise<boolean> {
    return this._client.hasWindow.query(id);
  }

  async showWindow(id: number): Promise<void> {
    return this._client.showWindow.mutate(id);
  }

  async hideWindow(id: number): Promise<void> {
    return this._client.hideWindow.mutate(id);
  }

  async maximizeWindow(id: number): Promise<void> {
    return this._client.maximizeWindow.mutate(id);
  }

  async toggleMaximizeWindow(id: number): Promise<void> {
    return this._client.toggleMaximizeWindow.mutate(id);
  }

  async toggleFullScreen(id: number): Promise<void> {
    return this._client.toggleFullScreen.mutate(id);
  }

  async minimizeWindow(id: number): Promise<void> {
    return this._client.minimizeWindow.mutate(id);
  }

  async closeWindow(id: number): Promise<void> {
    return this._client.closeWindow.mutate(id);
  }

  async destroyWindow(id: number): Promise<void> {
    return this._client.destroyWindow.mutate(id);
  }

  async setAlwaysOnTop(id: number, flag: boolean): Promise<void> {
    return this._client.setAlwaysOnTop.mutate({ id, flag });
  }

  async setOpacity(id: number, opacity: number): Promise<void> {
    return this._client.setOpacity.mutate({ id, opacity });
  }

  async setVibrancy(id: number, type: string | null): Promise<void> {
    return this._client.setVibrancy.mutate({ id, type });
  }

  async setBackgroundMaterial(id: number, material: string): Promise<void> {
    return this._client.setBackgroundMaterial.mutate({ id, material });
  }

  async getWindowState(id: number): Promise<IWindowState> {
    const result = await this._client.getWindowState.query(id);
    return result as unknown as IWindowState;
  }

  getWindowState$(id: number): Observable<IWindowState> {
    return trpcSubscriptionToObservable((opts) =>
      this._client.getWindowState$.subscribe(id, opts)
    );
  }

  onWindowEvent$(id: number, event?: WindowEvent): Observable<WindowEvent> {
    return trpcSubscriptionToObservable((opts) =>
      this._client.onWindowEvent$.subscribe({ id, event }, opts)
    );
  }
}
