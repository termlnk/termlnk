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

export interface IFileAtomicReadOptions {

  /**
   * The optional `atomic` flag can be used to make sure
   * the `readFile` method is not running in parallel with
   * any `write` operations in the same process.
   *
   * Typically you should not need to use this flag but if
   * for example you are quickly reading a file right after
   * a file event occurred and the file changes a lot, there
   * is a chance that a read returns an empty or partial file
   * because a pending write has not finished yet.
   *
   * Note: this does not prevent the file from being written
   * to from a different process. If you need such atomic
   * operations, you better use a real database as storage.
   */
  readonly atomic: boolean;
}

export interface IFileAtomicOptions {

  /**
   * The postfix is used to create a temporary file based
   * on the original resource. The resulting temporary
   * file will be in the same folder as the resource and
   * have `postfix` appended to the resource name.
   *
   * Example: given a file resource `file:///some/path/foo.txt`
   * and a postfix `.vsctmp`, the temporary file will be
   * created as `file:///some/path/foo.txt.vsctmp`.
   */
  readonly postfix: string;
}

export interface IFileAtomicWriteOptions {

  /**
   * The optional `atomic` flag can be used to make sure
   * the `writeFile` method updates the target file atomically
   * by first writing to a temporary file in the same folder
   * and then renaming it over the target.
   */
  readonly atomic: IFileAtomicOptions | false;
}

export interface IFileAtomicDeleteOptions {

  /**
   * The optional `atomic` flag can be used to make sure
   * the `delete` method deletes the target atomically by
   * first renaming it to a temporary resource in the same
   * folder and then deleting it.
   */
  readonly atomic: IFileAtomicOptions | false;
}

export interface IFileOverwriteOptions {

  /**
   * Set to `true` to overwrite a file if it exists. Will
   * throw an error otherwise if the file does exist.
   */
  readonly overwrite: boolean;
}

export interface IFileUnlockOptions {

  /**
   * Set to `true` to try to remove any write locks the file might
   * have. A file that is write locked will throw an error for any
   * attempt to write to unless `unlock: true` is provided.
   */
  readonly unlock: boolean;
}

export interface IFileWriteOptions extends IFileOverwriteOptions, IFileUnlockOptions, IFileAtomicWriteOptions {

  /**
   * Set to `true` to create a file when it does not exist. Will
   * throw an error otherwise if the file does not exist.
   */
  readonly create: boolean;
}

export interface IFileOpenForReadOptions {

  /**
   * A hint that the file should be opened for reading only.
   */
  readonly create: false;
}

export interface IFileOpenForWriteOptions extends IFileUnlockOptions {

  /**
   * A hint that the file should be opened for reading and writing.
   */
  readonly create: true;
}

export interface IFileDeleteOptions {

  /**
   * Set to `true` to recursively delete any children of the file. This
   * only applies to folders and can lead to an error unless provided
   * if the folder is not empty.
   */
  readonly recursive: boolean;

  /**
   * The optional `atomic` flag can be used to make sure
   * the `delete` method deletes the target atomically by
   * first renaming it to a temporary resource in the same
   * folder and then deleting it.
   *
   * This option maybe not be supported on all providers.
   */
  readonly atomic: IFileAtomicOptions | false;
}

export type IFileOpenOptions = IFileOpenForReadOptions | IFileOpenForWriteOptions;

export enum FileType {

  /**
   * File is unknown (neither file, directory nor symbolic link).
   */
  Unknown = 0,

  /**
   * File is a normal file.
   */
  File = 1,

  /**
   * File is a directory.
   */
  Directory = 2,

  /**
   * File is a symbolic link.
   *
   * Note: even when the file is a symbolic link, you can test for
   * `FileType.File` and `FileType.Directory` to know the type of
   * the target the link points to.
   */
  SymbolicLink = 64,
}

export enum FilePermission {

  /**
   * File is readonly. Components like editors should not
   * offer to edit the contents.
   */
  Readonly = 1,

  /**
   * File is locked. Components like editors should offer
   * to edit the contents and ask the user upon saving to
   * remove the lock.
   */
  Locked = 2,
}

export interface IStat {

  /**
   * The file type.
   */
  readonly type: FileType;

  /**
   * The last modification date represented as millis from unix epoch.
   */
  readonly mtime: number;

  /**
   * The creation date represented as millis from unix epoch.
   */
  readonly ctime: number;

  /**
   * The size of the file in bytes.
   */
  readonly size: number;

  /**
   * The file permissions.
   */
  readonly permissions?: FilePermission;
}
