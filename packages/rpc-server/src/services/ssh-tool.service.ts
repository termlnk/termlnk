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

import type { ISSHToolService, IToolHostInfo, IToolSessionInfo } from '@termlnk/rpc';
import type { HostTree } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import { Disposable, Inject } from '@termlnk/core';
import { HostRepository } from '@termlnk/database';
import { ISSHSessionService, SSHSessionStatus } from '@termlnk/rpc';
import { HostType, getCredentialUsername } from '@termlnk/terminal';

export class SSHToolService extends Disposable implements ISSHToolService {
  constructor(
    @Inject(HostRepository) private readonly _hostRepository: HostRepository,
    @ISSHSessionService private readonly _sshSessionService: ISSHSessionService
  ) {
    super();
  }

  async listHosts(parentId?: string, flat?: boolean): Promise<IToolHostInfo[]> {
    if (flat) {
      const items = await this._hostRepository.getListByPid(parentId);
      return items.map((item) => {
        const base: IToolHostInfo = {
          id: item.id,
          label: item.label,
          type: item.type,
          parentId: item.pid,
        };

        if (item.type === HostType.HOST && 'addr' in item) {
          base.addr = item.addr;
          base.port = item.port ?? 22;
          if ('credential' in item && item.credential) {
            base.username = getCredentialUsername(item.credential);
          }
        }

        return base;
      });
    }

    const tree = await this._hostRepository.getTree(parentId);
    return sanitizeTree(tree);
  }

  async connectHost(hostId: string, cols?: number, rows?: number): Promise<{ sessionId: string; hostId: string; hostLabel: string }> {
    const host = await this._hostRepository.getInfoById(hostId);
    if (!host) {
      throw new Error(`Host "${hostId}" not found.`);
    }

    if (host.type !== HostType.HOST) {
      throw new Error(`"${hostId}" is a group, not a connectable host.`);
    }

    const sessionId = await this._sshSessionService.createSession(hostId, {
      cols: cols ?? 80,
      rows: rows ?? 24,
    });

    return {
      sessionId,
      hostId,
      hostLabel: host.label ?? hostId,
    };
  }

  async closeSession(sessionId: string): Promise<void> {
    await this._sshSessionService.closeSession(sessionId);
  }

  async listSessions(statusFilter?: string): Promise<IToolSessionInfo[]> {
    const sshSessions = this._sshSessionService.getAllSessions();
    const results: IToolSessionInfo[] = [];

    for (const session of sshSessions) {
      const status = session.status;
      if (statusFilter && status !== statusFilter) {
        continue;
      }

      results.push({
        sessionId: session.sessionId,
        type: 'ssh',
        hostId: session.hostId,
        hostLabel: session.label,
        status,
        isConnected: status === SSHSessionStatus.READY,
      });
    }

    return results;
  }

  async writeToSession(sessionId: string, data: string): Promise<void> {
    const session = this._sshSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`SSH session "${sessionId}" not found.`);
    }
    await this._sshSessionService.write(sessionId, data);
  }

  getSessionData$(sessionId: string): Observable<Uint8Array | string> | null {
    const session = this._sshSessionService.getSession(sessionId);
    if (!session) return null;
    return session.data$ as Observable<Uint8Array | string>;
  }

  getSessionStatus(sessionId: string): string | null {
    const session = this._sshSessionService.getSession(sessionId);
    if (!session) return null;
    return session.status;
  }
}

function sanitizeTree(tree: HostTree[]): IToolHostInfo[] {
  return tree.map((node) => {
    const result: IToolHostInfo = {
      id: node.id,
      label: node.label,
      type: node.type,
    };

    if (node.type === HostType.HOST && 'addr' in node) {
      result.addr = node.addr;
      result.port = node.port ?? 22;
      if ('credential' in node && node.credential) {
        result.username = getCredentialUsername(node.credential);
        result.authType = node.credential.type;
      }
    }

    if (node.children && node.children.length > 0) {
      result.children = sanitizeTree(node.children);
    }

    return result;
  });
}
