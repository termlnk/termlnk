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

import type { IHost, IHostSettings, IProxy } from '@termlnk/terminal';
import { DEFAULT_CONNECT_HEARTBEAT, DEFAULT_CONNECT_TIMEOUT, DEFAULT_ENCODE, DEFAULT_FONT_SIZE, DEFAULT_HOST_ROOT, DEFAULT_TERM_TYPE, HostType } from '@termlnk/terminal';
import { BehaviorSubject, Subject } from 'rxjs';

export enum HostDialogMode {
  CREATE = 'create',
  EDIT = 'edit',
}

export type HostFormItem = Omit<IHost, 'proxy' | 'sort'> & { proxy?: Partial<IProxy> | null };

export const DEFAULT_HOST_SETTINGS: IHostSettings = {
  connectTimeout: DEFAULT_CONNECT_TIMEOUT,
  connectHeartbeat: DEFAULT_CONNECT_HEARTBEAT,
  encode: DEFAULT_ENCODE,
  runScript: '',
  x11Forward: false,
  termType: DEFAULT_TERM_TYPE,
  fontFamily: '',
  fontSize: DEFAULT_FONT_SIZE,
};

export interface IHostDialogState {
  open: boolean;
  mode: HostDialogMode;
  parentId?: string;
  item: HostFormItem;
}

export function createDefaultHostDialogState(): IHostDialogState {
  return {
    open: false,
    mode: HostDialogMode.CREATE,
    parentId: DEFAULT_HOST_ROOT,
    item: createDefaultHostItem(),
  };
}

export function createDefaultHostItem(): HostFormItem {
  return {
    id: '',
    pid: DEFAULT_HOST_ROOT,
    label: '',
    addr: '',
    port: 22,
    type: HostType.HOST,
    credential: { type: 'password', username: 'root', password: '' },
    settings: { ...DEFAULT_HOST_SETTINGS },
  };
}

export class HostDialogStateModel {
  private readonly _stateUpdate$ = new Subject<Partial<IHostDialogState>>();
  readonly stateUpdate$ = this._stateUpdate$.asObservable();

  private readonly _state$ = new BehaviorSubject<IHostDialogState>(createDefaultHostDialogState());
  readonly state$ = this._state$.asObservable();
  get state(): IHostDialogState {
    return this._state$.getValue();
  }

  changeState(changes: Partial<IHostDialogState>) {
    let changed = false;
    const changedState: Partial<IHostDialogState> = {};
    const currentState = this.state;

    const keys = Object.keys(changes) as Array<keyof IHostDialogState>;
    keys.forEach((key) => {
      const newValue = changes[key];
      if (typeof newValue !== 'undefined' && newValue !== currentState[key]) {
        (changedState as Record<string, unknown>)[key] = newValue;
        changed = true;
      }
    });

    if (changed) {
      this._state$.next({ ...currentState, ...changedState });
      this._stateUpdate$.next(changedState);
    }
  }
}
