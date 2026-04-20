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

/* eslint-disable no-console */
import { createIdentifier } from '../../common/di';
import { Disposable } from '../../common/lifecycle';

export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  VERBOSE = 4,
}

type ArgsType = any[];

type ConsoleType = typeof console.log | typeof console.error | typeof console.warn | typeof console.debug;

export interface ILogService {
  debug(...args: ArgsType): void;
  log(...args: ArgsType): void;
  warn(...args: ArgsType): void;
  error(...args: ArgsType): void;
  deprecate(...args: ArgsType): void;

  setLogLevel(enabled: LogLevel): void;
}
export const ILogService = createIdentifier<ILogService>('core.log-service');

export class DesktopLogService extends Disposable implements ILogService {
  private _logLevel: LogLevel = LogLevel.INFO;
  private _deduction = new Set<string>();

  override dispose(): void {
    super.dispose();

    this._logLevel = LogLevel.INFO;
    this._deduction.clear();
  }

  debug(...args: ArgsType): void {
    if (this._logLevel >= LogLevel.VERBOSE) {
      this._log(console.debug, ...args);
    }
  }

  log(...args: ArgsType): void {
    if (this._logLevel >= LogLevel.INFO) {
      this._log(console.log, ...args);
    }
  }

  warn(...args: ArgsType): void {
    if (this._logLevel >= LogLevel.WARN) {
      this._log(console.warn, ...args);
    }
  }

  error(...args: ArgsType): void {
    if (this._logLevel >= LogLevel.ERROR) {
      this._log(console.error, ...args);
    }
  }

  deprecate(...args: ArgsType): void {
    if (this._logLevel >= LogLevel.WARN) {
      this._logWithDeduplication(console.error, ...args);
    }
  }

  setLogLevel(logLevel: LogLevel): void {
    this._logLevel = logLevel;
  }

  private _log(
    method: ConsoleType,
    ...args: ArgsType
  ): void {
    const firstArg = args[0];
    const withTag = /^\[(.*?)\]/g.test(firstArg);
    if (withTag) {
      method(`\x1B[97;104m${firstArg}\x1B[0m`, ...args.slice(1));
    } else {
      method(...args);
    }
  }

  private _logWithDeduplication(
    method: ConsoleType,
    ...args: ArgsType
  ): void {
    const hashed = hashLogContent(...args);
    if (this._deduction.has(hashed)) {
      return;
    }

    this._deduction.add(hashed);
    this._log(method, ...args);
  }
}

function hashLogContent(...args: ArgsType): string {
  return args.map((a) => JSON.stringify(a)).join('');
}
