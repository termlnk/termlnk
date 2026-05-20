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

import type { IRemoteSessionEnv, IRemoteSessionEnvChange, ITerminalSessionEnvService, PlatformType, ShellType } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import type { IRawRemoteEnv } from './command-block-tracker';
import type { ICommandBlockService } from './command-block.service';
import { Disposable } from '@termlnk/core';
import { Subject } from 'rxjs';
import { ICommandBlockService as ICommandBlockServiceId } from './command-block.service';

function normalizeOS(raw: string): PlatformType | undefined {
  if (!raw) {
    return undefined;
  }
  const lower = raw.trim().toLowerCase();
  if (lower === 'darwin') {
    return 'macos';
  }
  if (lower === 'linux') {
    return 'linux';
  }
  if (lower.includes('mingw') || lower.includes('msys') || lower.includes('cygwin')) {
    return 'windows';
  }
  return 'unknown';
}

function normalizeShell(raw: string): ShellType | undefined {
  if (!raw) {
    return undefined;
  }
  const lower = raw.trim().toLowerCase();
  if (lower === 'bash' || lower === 'zsh' || lower === 'fish' || lower === 'pwsh' || lower === 'powershell' || lower === 'cmd' || lower === 'sh') {
    return lower as ShellType;
  }
  return 'unknown';
}

function normalize(raw: IRawRemoteEnv): IRemoteSessionEnv {
  return {
    remoteOS: normalizeOS(raw.remoteOS),
    remoteShell: normalizeShell(raw.remoteShell),
    remoteDistro: raw.remoteDistro || undefined,
  };
}

export class TerminalSessionEnvService extends Disposable implements ITerminalSessionEnvService {
  private readonly _env$ = new Subject<IRemoteSessionEnvChange>();
  readonly env$: Observable<IRemoteSessionEnvChange> = this._env$.asObservable();

  constructor(
    @ICommandBlockServiceId private readonly _commandBlockService: ICommandBlockService
  ) {
    super();

    this.disposeWithMe(
      this._commandBlockService.envChanged$.subscribe((raw) => {
        this._env$.next({ sessionId: raw.sessionId, env: normalize(raw.env) });
      })
    );
  }

  getEnv(sessionId: string): IRemoteSessionEnv {
    return normalize(this._commandBlockService.getRawEnv(sessionId));
  }

  override dispose(): void {
    this._env$.complete();
    super.dispose();
  }
}
