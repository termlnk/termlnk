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

import type { Observable } from 'rxjs';
import { createIdentifier } from '@termlnk/core';

export type ShellType = 'bash' | 'zsh' | 'fish' | 'powershell' | 'pwsh' | 'cmd' | 'sh' | 'unknown';
export type PlatformType = 'macos' | 'windows' | 'linux' | 'wsl' | 'unknown';

/**
 * Terminal session env reported via OSC 633;P Remote{OS,Shell,Distro}.
 * Fields stay undefined until the remote shell hits its first prompt.
 */
export interface IRemoteSessionEnv {
  remoteOS?: PlatformType;
  remoteShell?: ShellType;
  remoteDistro?: string;
}

export interface IActiveSessionContext extends IRemoteSessionEnv {
  sessionId: string;
  type: 'local' | 'ssh';
  shell: ShellType;
  cwd: string;
  isAtPrompt: boolean;
  hostLabel?: string;
}

export interface IPlatformContext {
  /** Local operating system */
  platform: PlatformType | string;
  /** CPU architecture (x64, arm64, etc.) */
  arch: string;
  /** Default shell */
  defaultShell: ShellType;
  /** OS version description */
  osVersion: string;
  /** User home directory */
  homeDir: string;
  /** Current date (YYYY-MM-DD) */
  currentDate: string;
  /** User's configured language/locale (e.g. 'enUS', 'zhCN') */
  locale: string;
  /** All active terminal sessions */
  activeSessions: IActiveSessionContext[];
  /** Currently focused terminal session */
  focusedSession: IActiveSessionContext | null;
}

export interface IPlatformContextService {
  readonly context$: Observable<IPlatformContext>;

  getContext(): IPlatformContext;
}

export const IPlatformContextService = createIdentifier<IPlatformContextService>('agent.platform-context-service');
