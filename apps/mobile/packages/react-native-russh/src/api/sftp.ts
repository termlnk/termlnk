/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// P6.9-2 placeholder. SFTP API lives on top of the same SSH connection — the
// implementation in P6.9-5 routes through SshConnection.startSftp() which
// opens an 'sftp' subsystem on a fresh channel via russh-sftp.

import type { ISftpEntry, ISftpStat, ISftpTransferHandle, ISftpTransferOptions } from './types';

export interface ISftpSession {
  readonly sessionId: string;
  list: (path: string) => Promise<readonly ISftpEntry[]>;
  stat: (path: string) => Promise<ISftpStat>;
  mkdir: (path: string, mode?: number) => Promise<void>;
  rmdir: (path: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  chmod: (path: string, mode: number) => Promise<void>;
  realpath: (path: string) => Promise<string>;
  upload: (
    localPath: string,
    remotePath: string,
    opts?: ISftpTransferOptions,
  ) => ISftpTransferHandle;
  download: (
    remotePath: string,
    localPath: string,
    opts?: ISftpTransferOptions,
  ) => ISftpTransferHandle;
  close: () => Promise<void>;
}
