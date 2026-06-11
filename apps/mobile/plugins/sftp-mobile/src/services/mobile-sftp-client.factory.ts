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

import type { IMobileSshSession } from '@termlnk/terminal-mobile';
import { createIdentifier } from '@termlnk/core';
import { MobileSftpClientService } from './mobile-sftp-client.service';

// SFTP clients are per-session — each lives alongside one SSH connection and shares its
// auth/host-key handshake. DI registers a factory rather than a singleton so the screen
// layer can spawn / dispose clients in sync with the SSH session lifecycle.
export interface IMobileSftpClientFactory {
  create(session: IMobileSshSession): MobileSftpClientService;
}

export const IMobileSftpClientFactory = createIdentifier<IMobileSftpClientFactory>('mobile.sftp-client-factory');

export class MobileSftpClientFactory implements IMobileSftpClientFactory {
  create(session: IMobileSshSession): MobileSftpClientService {
    return new MobileSftpClientService(session);
  }
}
