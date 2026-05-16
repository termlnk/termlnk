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

import type { IDisposable, URI } from '@termlnk/core';
import type { Stats } from 'fs';
import type { IFileAtomicReadOptions, IFileDeleteOptions, IFileOpenOptions, IFileOverwriteOptions, IFileWriteOptions, IStat } from './types';
import { constants, promises } from 'node:fs';
import { Barrier, basename, defaultUriKit, dirname, Disposable, DisposableCollection, getComparisonKey, ILogService, isLinux, isRootOrDriveLetter, isWindows, normalize, toDisposable } from '@termlnk/core';
import { stat } from '../../common/symlink';
import { DiskFileError, DiskFileErrorCode } from './file-error';
import { Promisify } from './promisify';
import { FilePermission, FileType } from './types';

export class DiskFileService extends Disposable {
  private readonly _resourceLocks = new Map<string, Barrier>();
  private readonly _mapHandleToLock = new Map<number, IDisposable>();

  private _canFlush = true;

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._resourceLocks.clear();
    this._mapHandleToLock.clear();
  }

  configureFlushOnWrite(enabled: boolean): void {
    this._canFlush = enabled;
  }

  async readFile(resource: URI, options?: IFileAtomicReadOptions): Promise<Uint8Array> {
    let lock: IDisposable | undefined;
    try {
      if (options?.atomic) {
        lock = await this._createResourceLock(resource);
      }

      const filePath = this.toFilePath(resource);

      return await promises.readFile(filePath);
    } finally {
      lock?.dispose();
    }
  }

  async writeFile(resource: URI, content: Uint8Array, opts: IFileWriteOptions): Promise<void> {
    if (opts?.atomic !== false && opts?.atomic?.postfix && await this._canWriteFileAtomic(resource)) {
      return this._doWriteFileAtomic(
        resource,
        defaultUriKit.joinPath(defaultUriKit.dirname(resource), `${defaultUriKit.dirname(resource)}${opts.atomic.postfix}`),
        content,
        opts
      );
    } else {
      return this._doWriteFile(resource, content, opts);
    }
  }

  async open(resource: URI, opts: IFileOpenOptions, disableWriteLock?: boolean): Promise<number> {
    const filePath = this.toFilePath(resource);

    let lock: IDisposable | undefined;
    if (opts?.create && !disableWriteLock) {
      lock = await this._createResourceLock(resource);
    }

    let fd: number | undefined;
    try {
      // Determine whether to unlock the file (write only)
      if (opts.create && opts.unlock) {
        try {
          const stats = await stat(filePath);
          if (!(stats.stat.mode & 0o200 /* File mode indicating writable by owner */)) {
            await promises.chmod(filePath, stats.stat.mode | 0o200);
          }
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            this._logService.warn(error);
          }
        }
      }

      // Windows gets special treatment (write only)
      if (isWindows && opts.create) {
        try {
          // We try to use 'r+' for opening (which will fail if the file does not exist)
          // to prevent issues when saving hidden files or preserving alternate data streams.
          fd = await Promisify.open(filePath, 'r+');

          // The flag 'r+' will not truncate the file, so we have to do this manually
          await Promisify.ftruncate(fd, 0);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            this._logService.warn(error);
          }

          // Make sure to close the file handle if we have one
          if (typeof fd === 'number') {
            try {
              await Promisify.close(fd);
            } catch (error) {
              this._logService.warn(error);
            }

            // Reset `fd` to be able to try again with 'w'
            fd = undefined;
          }
        }
      }

      if (typeof fd === 'undefined') {
        const flag = opts.create ?
          // We take `opts.create` as a hint that the file is opened for writing
          // as such we use 'w' to truncate an existing or create the
          // file otherwise. we do not allow reading.
          'w' :
          // Otherwise we assume the file is opened for reading
          // as such we use 'r' to neither truncate, nor create
          // the file.
          'r';
        fd = await Promisify.open(filePath, flag);
      }
    } catch (error: any) {
      lock?.dispose();

      throw error;
    }

    if (lock) {
      const previousLock = this._mapHandleToLock.get(fd);

      // Remember that this handle has an associated lock
      this._mapHandleToLock.set(fd, lock);

      // There is a slight chance that a resource lock for a
      // handle was not yet disposed when we acquire a new
      // lock, so we must ensure to dispose the previous lock
      // before storing a new one for the same handle, other
      // wise we end up in a deadlock situation
      if (previousLock) {
        previousLock.dispose();
      }
    }

    return fd;
  }

  async close(fd: number): Promise<void> {
    const lockForHandle = this._mapHandleToLock.get(fd);

    try {
      if (this._canFlush) {
        try {
          await Promisify.fdatasync(fd);
        } catch (error) {
          this.configureFlushOnWrite(false);
          this._logService.error(error);
        }
      }

      return await Promisify.close(fd);
    } finally {
      if (lockForHandle) {
        if (this._mapHandleToLock.get(fd) === lockForHandle) {
          this._mapHandleToLock.delete(fd);
        }

        lockForHandle.dispose();
      }
    }
  }

  async rename(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);

    if (fromFilePath === toFilePath) {
      return;
    }

    try {
      // Validate the move operation can perform
      await this._validateMoveCopy(from, to, 'move', opts.overwrite);

      // Rename
      await promises.rename(fromFilePath, toFilePath);
    } catch (error: any) {
      // Rewrite some typical errors that can happen especially around symlinks
      // to something the user can better understand
      if (error.code === 'EINVAL' || error.code === 'EBUSY' || error.code === 'ENAMETOOLONG') {
        // eslint-disable-next-line no-ex-assign
        error = new Error(`Unable to move ${basename(fromFilePath)} into ${basename(dirname(toFilePath))} (${error.toString()}).`);
      }

      throw error;
    }
  }

  async copy(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);

    if (fromFilePath === toFilePath) {
      return;
    }

    try {
      // Validate the copy operation can perform
      await this._validateMoveCopy(from, to, 'copy', opts.overwrite);

      // Copy
      await promises.copyFile(fromFilePath, toFilePath, constants.COPYFILE_EXCL);
    } catch (error: any) {
      // Rewrite some typical errors that can happen especially around symlinks
      // to something the user can better understand
      if (error.code === 'EINVAL' || error.code === 'EBUSY' || error.code === 'ENAMETOOLONG') {
        // eslint-disable-next-line no-ex-assign
        error = new Error(`Unable to copy ${basename(fromFilePath)} into ${basename(dirname(toFilePath))} (${error.toString()}).`);
      }

      throw error;
    }
  }

  async mkdir(resource: URI): Promise<void> {
    return promises.mkdir(this.toFilePath(resource));
  }

  async delete(resource: URI, opts: IFileDeleteOptions): Promise<void> {
    const filePath = this.toFilePath(resource);
    if (opts.recursive) {
      if (isRootOrDriveLetter(filePath)) {
        throw new Error('rimraf - will refuse to recursively delete root');
      }

      await promises.rm(filePath, { recursive: true, force: true, maxRetries: 3 });
    } else {
      try {
        await promises.unlink(filePath);
      } catch (unlinkError: any) {
        // `fs.unlink` will throw when used on directories
        // we try to detect this error and then see if the
        // provided resource is actually a directory. in that
        // case we use `fs.rmdir` to delete the directory.

        if (unlinkError.code === 'EPERM' || unlinkError.code === 'EISDIR') {
          let isDirectory = false;
          try {
            const stats = await stat(filePath);
            isDirectory = stats.stat.isDirectory() && !stats.symbolicLink;
          } catch (statError) {
            // ignore
          }

          if (isDirectory) {
            await promises.rmdir(filePath);
          } else {
            throw unlinkError;
          }
        } else {
          throw unlinkError;
        }
      }
    }
  }

  async exists(path: string): Promise<boolean> {
    return Promisify.exists(path);
  }

  async stat(resource: URI): Promise<IStat> {
    const stats = await stat(this.toFilePath(resource));

    return {
      type: this._toType(stats.stat, stats.symbolicLink),
      ctime: stats.stat.birthtime.getTime(),
      mtime: stats.stat.mtime.getTime(),
      size: stats.stat.size,
      permissions: (stats.stat.mode & 0o200) === 0 ? FilePermission.Locked : undefined,
    };
  }

  async realpath(resource: URI): Promise<string> {
    const filePath = this.toFilePath(resource);
    return promises.realpath(filePath);
  }

  private async _doWriteFileAtomic(resource: URI, tempResource: URI, content: Uint8Array, opts: IFileWriteOptions): Promise<void> {
    const locks = new DisposableCollection();
    try {
      locks.add(await this._createResourceLock(resource));
      locks.add(await this._createResourceLock(tempResource));

      // Write to temp resource first
      await this._doWriteFile(tempResource, content, opts, true);

      try {
        // Rename over existing to ensure atomic replace
        await this.rename(tempResource, resource, { overwrite: true });
      } catch (error) {
        // Cleanup in case of rename error
        try {
          await this.delete(tempResource, { recursive: false, atomic: false });
        } catch (error) {
          // ignore - we want the outer error to bubble up
        }

        throw error;
      }
    } finally {
      locks.dispose();
    }
  }

  private async _doWriteFile(resource: URI, content: Uint8Array, opts: IFileWriteOptions, disableWriteLock?: boolean): Promise<void> {
    let handle: number | undefined;
    try {
      const filePath = this.toFilePath(resource);

      // Validate target unless { create: true, overwrite: true }
      if (!opts.create || !opts.overwrite) {
        const fileExists = await this.exists(filePath);
        if (fileExists) {
          if (!opts.overwrite) {
            throw DiskFileError.create('File already exists', DiskFileErrorCode.FileExists);
          }
        } else {
          if (!opts.create) {
            throw DiskFileError.create('File does not exist', DiskFileErrorCode.FileNotFound);
          }
        }
      }

      // Open
      handle = await this.open(resource, { create: true, unlock: opts.unlock }, disableWriteLock);

      // Write content at once
      await Promisify.write(handle, content, 0, content.byteLength, 0);
    } finally {
      if (typeof handle !== 'undefined') {
        await this.close(handle);
      }
    }
  }

  protected toFilePath(resource: URI): string {
    return normalize(resource.fsPath);
  }

  private async _canWriteFileAtomic(resource: URI): Promise<boolean> {
    try {
      const filePath = this.toFilePath(resource);
      const { symbolicLink } = await stat(filePath);
      if (symbolicLink) {
        // atomic writes are unsupported for symbolic links because
        // we need to ensure that the `rename` operation is atomic
        // and that only works if the link is on the same disk.
        // Since we do not know where the symbolic link points to
        // we refuse to write atomically.
        return false;
      }
    } catch (error) {
      // ignore stat errors here and just proceed trying to write
    }

    return true; // atomic writing supported
  }

  private async _createResourceLock(resource: URI): Promise<IDisposable> {
    const filePath = this.toFilePath(resource);
    const lockKey = getComparisonKey(resource);

    // Await pending locks for resource. It is possible for a new lock being
    // added right after opening, so we have to loop over locks until no lock
    // remains.
    let existingLock: Barrier | undefined;
    while (existingLock = this._resourceLocks.get(lockKey)) {
      await existingLock.wait();
    }

    // Store new
    const newLock = new Barrier();
    this._resourceLocks.set(lockKey, newLock);

    return toDisposable(() => {
      // Delete lock if it is still ours
      if (this._resourceLocks.get(lockKey) === newLock) {
        this._resourceLocks.delete(lockKey);
      }

      // Open lock
      newLock.open();
    });
  }

  private async _validateMoveCopy(from: URI, to: URI, mode: 'move' | 'copy', overwrite?: boolean): Promise<void> {
    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);

    let isSameResourceWithDifferentPathCase = false;
    if (!isLinux) {
      isSameResourceWithDifferentPathCase = fromFilePath.toLowerCase() === toFilePath.toLowerCase();
    }

    if (isSameResourceWithDifferentPathCase) {
      // You cannot copy the same file to the same location with different
      // path case unless you are on a case sensitive file system
      if (mode === 'copy') {
        throw DiskFileError.create('File cannot be copied to same path with different path case', DiskFileErrorCode.FileExists);
      }

      // You can move the same file to the same location with different
      // path case on case insensitive file systems
      if (mode === 'move') {
        return;
      }
    }

    // Here we have to see if the target to move/copy to exists or not.
    // We need to respect the `overwrite` option to throw in case the
    // target exists.

    const fromStat = await this._statIgnoreError(from);
    if (!fromStat) {
      throw DiskFileError.create('File to move/copy does not exist', DiskFileErrorCode.FileNotFound);
    }

    const toStat = await this._statIgnoreError(to);
    if (!toStat) {
      return; // target does not exist so we are good
    }

    if (!overwrite) {
      throw DiskFileError.create('File at target already exists and thus will not be moved/copied to unless overwrite is specified', DiskFileErrorCode.FileExists);
    }

    // Handle existing target for move/copy
    if ((fromStat.type & FileType.File) !== 0 && (toStat.type & FileType.File) !== 0) {
       // node.js can move/copy a file over an existing file without having to delete it first
    } else {
      await this.delete(to, { recursive: true, atomic: false });
    }
  }

  private async _statIgnoreError(resource: URI): Promise<IStat | undefined> {
    try {
      return await this.stat(resource);
    } catch (error) {
      return undefined;
    }
  }

  private _toType(entry: Stats, symbolicLink?: { dangling: boolean }): FileType {
    // Determine base file type
    // - symbolic links pointing to nonexistent files are Unknown
    // - files that are neither file nor directory are Unknown
    let type = FileType.Unknown;

    if (symbolicLink?.dangling) {
      type = FileType.Unknown;
    } else if (entry.isFile()) {
      type = FileType.File;
    } else if (entry.isDirectory()) {
      type = FileType.Directory;
    }

    // Always signal symbolic link as file type additionally
    if (symbolicLink) {
      type |= FileType.SymbolicLink;
    }

    return type;
  }
}
