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

import type { IACPSessionInfo } from '@termlnk/acp';
import type { Observable } from 'rxjs';
import { ACP_SESSION_TYPE, IACPDiscoveryService, IACPSessionService } from '@termlnk/acp';
import { createIdentifier, Disposable, generateRandomId, ILogService, Inject, INotificationService, LocaleService } from '@termlnk/core';
import { ILastCwdService, ITerminalUIService } from '@termlnk/terminal-ui';
import { BehaviorSubject } from 'rxjs';

export interface IACPSessionLauncher {
  /**
   * Why a tab has no session, keyed by tab id. The main process drops a session
   * that fails to hand shake, so this is the only place the reason survives —
   * a toast alone leaves the opened tab blank and unexplained.
   */
  readonly launchFailures$: Observable<ReadonlyMap<string, string>>;

  launch(providerId: string, cwd?: string): Promise<IACPSessionInfo>;
  /** Re-runs a failed launch in the same tab. */
  retry(sessionId: string): Promise<void>;
}

export const IACPSessionLauncher = createIdentifier<IACPSessionLauncher>(
  'acp-ui.acp-session-launcher'
);

interface IFailedLaunch {
  providerId: string;
  cwd: string;
  message: string;
}

export class ACPSessionLauncher extends Disposable implements IACPSessionLauncher {
  private readonly _failures = new Map<string, IFailedLaunch>();
  private readonly _launchFailures$ = new BehaviorSubject<ReadonlyMap<string, string>>(new Map());
  readonly launchFailures$: Observable<ReadonlyMap<string, string>> = this._launchFailures$.asObservable();

  constructor(
    @IACPSessionService private readonly _sessionService: IACPSessionService,
    @IACPDiscoveryService private readonly _discovery: IACPDiscoveryService,
    @ITerminalUIService private readonly _terminalUI: ITerminalUIService,
    @ILastCwdService private readonly _lastCwd: ILastCwdService,
    @INotificationService private readonly _notificationService: INotificationService,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async launch(providerId: string, cwd?: string): Promise<IACPSessionInfo> {
    const lastCwd = await this._lastCwd.getLastCwd();
    const resolvedCwd = cwd || lastCwd || '';

    const title = this._titleOf(providerId);

    // The tab is opened before the agent handshake, not after: spawning and
    // negotiating ACP takes seconds, and if it fails there would otherwise be
    // no surface at all to report the failure on — the click would look ignored.
    const sessionId = `acp_${generateRandomId()}`;
    this._terminalUI.addSession({
      id: sessionId,
      type: ACP_SESSION_TYPE,
      // hostId/hostName carry provider identity until ITerminalSession is generalized (E7).
      hostId: providerId,
      hostName: title,
      title,
      status: 'connecting',
    });
    this._terminalUI.setActiveSession(sessionId);

    return this._connect(sessionId, providerId, resolvedCwd);
  }

  async retry(sessionId: string): Promise<void> {
    const failed = this._failures.get(sessionId);
    if (!failed) {
      return;
    }
    this._clearFailure(sessionId);
    this._terminalUI.updateSessionStatus(sessionId, 'connecting');
    await this._connect(sessionId, failed.providerId, failed.cwd).catch(() => {
      // _connect already reported it.
    });
  }

  override dispose(): void {
    super.dispose();
    this._failures.clear();
    this._launchFailures$.complete();
  }

  private async _connect(
    sessionId: string,
    providerId: string,
    cwd: string
  ): Promise<IACPSessionInfo> {
    try {
      const info = await this._sessionService.createSession({ sessionId, providerId, cwd });
      this._terminalUI.updateSessionStatus(
        sessionId,
        info.status === 'ready' ? 'ready' : 'connecting'
      );
      if (info.title) {
        this._terminalUI.updateSessionTitle(sessionId, info.title);
      }
      this._logService.log(`[ACPSessionLauncher] launched ${providerId} at ${cwd || '(default)'} → ${sessionId}`);
      return info;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._terminalUI.updateSessionStatus(sessionId, 'error');
      this._failures.set(sessionId, { providerId, cwd, message });
      this._publishFailures();
      this._notificationService.notify({
        title: this._localeService.t('acp-ui.launch.failed-title', this._titleOf(providerId)),
        body: message,
        type: 'error',
        source: 'application',
        groupId: sessionId,
      });
      this._logService.error(`[ACPSessionLauncher] launch ${providerId} failed: ${message}`);
      throw err;
    }
  }

  private _titleOf(providerId: string): string {
    return this._discovery.getProvider(providerId)?.descriptor.title ?? providerId;
  }

  private _clearFailure(sessionId: string): void {
    if (this._failures.delete(sessionId)) {
      this._publishFailures();
    }
  }

  private _publishFailures(): void {
    this._launchFailures$.next(
      new Map([...this._failures].map(([id, f]) => [id, f.message]))
    );
  }
}
