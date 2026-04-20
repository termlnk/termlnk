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

import type { IDisposable, ILogService } from '@termlnk/core';
import type { ISSHSessionService, ITerminalSessionNotifyService } from '@termlnk/rpc';
import type { IPTYSessionService } from '@termlnk/terminal';
import { ISystemPromptService, PLATFORM_SSH_SECTION, PROMPT_PRIORITY, PROMPT_SECTION } from '@termlnk/agent';
import { Disposable, ILogService as ILogServiceId } from '@termlnk/core';
import { ISSHSessionService as ISSHSessionServiceId, ITerminalSessionNotifyService as ITerminalSessionNotifyServiceId, SSHSessionStatus } from '@termlnk/rpc';
import { IPTYSessionService as IPTYSessionServiceId, PTYSessionStatus } from '@termlnk/terminal';
import { merge } from 'rxjs';

export class TerminalSessionPromptController extends Disposable {
  private _sshSectionDisposable: IDisposable | null = null;

  constructor(
    @ISSHSessionServiceId private readonly _sshSessionService: ISSHSessionService,
    @IPTYSessionServiceId private readonly _ptySessionService: IPTYSessionService,
    @ITerminalSessionNotifyServiceId private readonly _notifyService: ITerminalSessionNotifyService,
    @ISystemPromptService private readonly _systemPromptService: ISystemPromptService,
    @ILogServiceId private readonly _logService: ILogService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    this.disposeWithMe(
      this._systemPromptService.registerSection({
        id: PROMPT_SECTION.TERMINAL_SESSIONS,
        priority: PROMPT_PRIORITY.TERMINAL_SESSIONS,
        cacheable: false,
        getContent: () => this._buildSessionSection(),
      })
    );

    this.disposeWithMe(
      merge(
        this._notifyService.sessionCreated$,
        this._notifyService.sessionClosed$,
        this._notifyService.sessionStatusChanged$,
        this._notifyService.focusedSessionId$
      ).subscribe(() => {
        this._updateSshPlatformSection();
        this._systemPromptService.rebuild();
      })
    );

    this._updateSshPlatformSection();
  }

  private _buildSessionSection(): string {
    const sessions: Array<{
      sessionId: string;
      type: 'ssh' | 'local';
      shell?: string;
      hostLabel?: string;
    }> = [];

    try {
      const sshSessions = this._sshSessionService.getAllSessions();
      for (const session of sshSessions) {
        if (session.status === SSHSessionStatus.READY) {
          sessions.push({
            sessionId: session.sessionId,
            type: 'ssh',
            hostLabel: session.label ?? session.hostId,
          });
        }
      }
    } catch (err) {
      this._logService.warn('[TerminalSessionPromptController]', 'Failed to collect SSH sessions:', err);
    }

    try {
      const ptySessions = this._ptySessionService.getAllSessions();
      for (const session of ptySessions) {
        if (session.status === PTYSessionStatus.READY) {
          sessions.push({
            sessionId: session.sessionId,
            type: 'local',
            shell: session.shellPath,
          });
        }
      }
    } catch (err) {
      this._logService.warn('[TerminalSessionPromptController]', 'Failed to collect PTY sessions:', err);
    }

    if (sessions.length === 0) {
      return '# Terminal Sessions\n\nNo active terminal sessions.';
    }

    const focusedId = this._notifyService.getFocusedSessionId();
    const lines = [
      '# Terminal Sessions',
      '',
      `Active sessions: ${sessions.length}`,
      '',
    ];

    for (const session of sessions) {
      const parts: string[] = [session.type];
      if (session.shell) {
        parts.push(`shell: ${session.shell}`);
      }
      if (session.hostLabel) {
        parts.push(`host: ${session.hostLabel}`);
      }
      const focused = focusedId === session.sessionId ? ' **[focused]**' : '';
      lines.push(`- \`${session.sessionId}\` (${parts.join(', ')})${focused}`);
    }

    return lines.join('\n');
  }

  private _updateSshPlatformSection(): void {
    const sshSessions = this._sshSessionService.getAllSessions();
    const hasSshSession = sshSessions.some((s) => s.status === SSHSessionStatus.READY);

    if (hasSshSession && !this._sshSectionDisposable) {
      this._sshSectionDisposable = this._systemPromptService.registerSection({
        id: PROMPT_SECTION.PLATFORM_SSH,
        priority: PROMPT_PRIORITY.PLATFORM_SPECIFIC + 2,
        cacheable: false,
        getContent: () => PLATFORM_SSH_SECTION,
      });
    } else if (!hasSshSession && this._sshSectionDisposable) {
      this._sshSectionDisposable.dispose();
      this._sshSectionDisposable = null;
    }
  }

  override dispose(): void {
    super.dispose();
    this._sshSectionDisposable?.dispose();
    this._sshSectionDisposable = null;
  }
}
