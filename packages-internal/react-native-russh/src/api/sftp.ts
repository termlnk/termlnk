/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// Idiomatic TS wrapper for SftpSession. Upload/download return a *synchronous*
// handle so the UI can paint a Cancel button immediately without awaiting
// the long-running transfer; the underlying Rust call runs as `done` Promise.

import * as GeneratedRussh from '../index';
import { callRusshAsync, callRusshSync } from './errors';
import type {
  ISftpEntry,
  ISftpStat,
  ISftpTransferHandle,
  ISftpTransferOptions,
  ISftpTransferProgress,
} from './types';

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

function toEntry(e: GeneratedRussh.SftpEntry): ISftpEntry {
  return {
    filename: e.filename,
    isDirectory: e.isDirectory,
    isSymlink: e.isSymlink,
    size: e.size,
    mode: e.mode,
    modifiedAtMs: e.modifiedAtMs,
    accessedAtMs: e.accessedAtMs,
  };
}

function toStat(s: GeneratedRussh.SftpStat): ISftpStat {
  return {
    isDirectory: s.isDirectory,
    isSymlink: s.isSymlink,
    size: s.size,
    mode: s.mode,
    modifiedAtMs: s.modifiedAtMs,
    accessedAtMs: s.accessedAtMs,
  };
}

// Lightweight uuid (RFC 4122 v4 best-effort). The transfer_id only needs to
// be unique within the session — we use a 128-bit hex random; the runtime
// guarantees crypto.getRandomValues via react-native-get-random-values which
// the mobile-app already imports at boot.
function uuid(): string {
  const bytes = new Uint8Array(16);
  // global crypto is polyfilled in the RN context; if running outside of
  // RN (unit tests) the test runner provides it via node:crypto webcrypto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoApi = (globalThis as any).crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Set RFC 4122 version 4 + variant bits. The `?? 0` keeps strict
  // noUncheckedIndexedAccess happy — bytes[i] is always defined for i<16
  // but the typesystem doesn't know the Uint8Array length statically.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function makeTransferHandle(
  transferId: string,
  remotePath: string,
  localPath: string,
  donePromise: Promise<GeneratedRussh.SftpTransferInfo>,
  sftp: GeneratedRussh.SftpSessionLike,
): ISftpTransferHandle {
  return {
    transferId,
    remotePath,
    localPath,
    total: undefined,
    cancel: () => callRusshSync(() => sftp.cancelTransfer(transferId)),
    done: callRusshAsync(() =>
      donePromise.then(() => {
        // discard the SftpTransferInfo — caller already has remotePath/localPath
        // and we expose total via progress callback. The handle's `done` is
        // void so a missing transfer doesn't leak Rust types into the UI.
      }),
    ),
  };
}

function toProgressCallback(
  onProgress: ((p: ISftpTransferProgress) => void) | undefined,
): GeneratedRussh.SftpProgressCallback | undefined {
  if (!onProgress) {
    return undefined;
  }
  return {
    onProgress: (transferId, bytesDone, total) =>
      onProgress({ transferId, bytesDone, total }),
  };
}

export function wrapSftpSession(sftp: GeneratedRussh.SftpSessionLike): ISftpSession {
  const info = callRusshSync(() => sftp.getInfo());
  return {
    sessionId: info.sessionId,
    list: (path) =>
      callRusshAsync(async () => (await sftp.list(path)).map(toEntry)),
    stat: (path) => callRusshAsync(async () => toStat(await sftp.stat(path))),
    mkdir: (path, mode) => callRusshAsync(() => sftp.mkdir(path, mode)),
    rmdir: (path) => callRusshAsync(() => sftp.rmdir(path)),
    remove: (path) => callRusshAsync(() => sftp.remove(path)),
    rename: (from, to) => callRusshAsync(() => sftp.rename(from, to)),
    chmod: (path, mode) => callRusshAsync(() => sftp.chmod(path, mode)),
    realpath: (path) => callRusshAsync(() => sftp.realpath(path)),
    upload: (localPath, remotePath, opts) => {
      const transferId = uuid();
      const donePromise = sftp.upload(
        transferId,
        localPath,
        remotePath,
        opts?.chunkSize,
        toProgressCallback(opts?.onProgress),
      );
      return makeTransferHandle(transferId, remotePath, localPath, donePromise, sftp);
    },
    download: (remotePath, localPath, opts) => {
      const transferId = uuid();
      const donePromise = sftp.download(
        transferId,
        remotePath,
        localPath,
        opts?.chunkSize,
        toProgressCallback(opts?.onProgress),
      );
      return makeTransferHandle(transferId, remotePath, localPath, donePromise, sftp);
    },
    close: () => callRusshAsync(() => sftp.close()),
  };
}
