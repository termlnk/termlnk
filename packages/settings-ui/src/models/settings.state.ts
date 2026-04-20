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

import { BehaviorSubject, Subject } from 'rxjs';

export enum SettingsTab {
  APPEARANCE = 'appearance',
  INTERFACE = 'interface',
  TERMINAL = 'terminal',
  COLOR_SCHEME = 'color-scheme',
  NETWORK = 'network',
  MCP = 'mcp',
  AI_PROVIDER = 'ai-provider',
  CHAT = 'chat',
  SKILL = 'skill',
  ISLAND = 'island',
  SHORTCUTS = 'shortcuts',
  ABOUT = 'about',
}

export interface ISettingsState {
  open: boolean;
  activeTab: SettingsTab;
}

export function createDefaultSettingsState(): ISettingsState {
  return {
    open: false,
    activeTab: SettingsTab.APPEARANCE,
  };
}

export class SettingsStateModel {
  private readonly _stateUpdate$ = new Subject<Partial<ISettingsState>>();
  readonly stateUpdate$ = this._stateUpdate$.asObservable();

  private readonly _state$ = new BehaviorSubject<ISettingsState>(createDefaultSettingsState());
  readonly state$ = this._state$.asObservable();

  get state(): ISettingsState {
    return this._state$.getValue();
  }

  changeState(changes: Partial<ISettingsState>) {
    let changed = false;
    const changedState: Partial<ISettingsState> = {};
    const currentState = this.state;

    const keys = Object.keys(changes) as Array<keyof ISettingsState>;
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
