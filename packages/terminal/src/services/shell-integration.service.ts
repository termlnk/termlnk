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

import type { Observable } from 'rxjs';
import type { ITerminalCommand } from '../models/shell-integration';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

const MAX_COMMAND_HISTORY = 100;

export interface IShellIntegrationService {
  /** Observable of all commands in the session */
  readonly commands$: Observable<ITerminalCommand[]>;
  /** Observable of current working directory changes */
  readonly currentCwd$: Observable<string>;
  /** Observable of prompt state (true when at prompt) */
  readonly isAtPrompt$: Observable<boolean>;
  /** Observable that emits when a command finishes */
  readonly commandFinished$: Observable<ITerminalCommand>;
  /** Observable of the most recent command */
  readonly lastCommand$: Observable<ITerminalCommand | null>;

  /** Push a completed command (from CommandTracker) */
  addCommand(command: ITerminalCommand): void;
  /** Set current working directory */
  setCwd(cwd: string): void;
  /** Set whether the terminal is at a prompt */
  setIsAtPrompt(value: boolean): void;
  /** Get recent commands */
  getRecentCommands(count: number): ITerminalCommand[];
  /** Get command output by ID */
  getCommandOutput(commandId: string): string;
}

export const IShellIntegrationService = createIdentifier<IShellIntegrationService>('osc.shell-integration-service');

export class ShellIntegrationService extends Disposable implements IShellIntegrationService {
  private readonly _commands$ = new BehaviorSubject<ITerminalCommand[]>([]);
  readonly commands$: Observable<ITerminalCommand[]> = this._commands$.asObservable();

  private readonly _currentCwd$ = new BehaviorSubject<string>('');
  readonly currentCwd$: Observable<string> = this._currentCwd$.asObservable();

  private readonly _isAtPrompt$ = new BehaviorSubject<boolean>(false);
  readonly isAtPrompt$: Observable<boolean> = this._isAtPrompt$.asObservable();

  private readonly _commandFinished$ = new Subject<ITerminalCommand>();
  readonly commandFinished$: Observable<ITerminalCommand> = this._commandFinished$.asObservable();

  private readonly _lastCommand$ = new BehaviorSubject<ITerminalCommand | null>(null);
  readonly lastCommand$: Observable<ITerminalCommand | null> = this._lastCommand$.asObservable();

  addCommand(command: ITerminalCommand): void {
    this.ensureNotDisposed();

    const current = this._commands$.getValue();
    const updated = [...current, command];

    // Trim to max history
    if (updated.length > MAX_COMMAND_HISTORY) {
      updated.splice(0, updated.length - MAX_COMMAND_HISTORY);
    }

    this._commands$.next(updated);
    this._lastCommand$.next(command);
    this._commandFinished$.next(command);
  }

  setCwd(cwd: string): void {
    this.ensureNotDisposed();
    if (cwd && cwd !== this._currentCwd$.getValue()) {
      this._currentCwd$.next(cwd);
    }
  }

  setIsAtPrompt(value: boolean): void {
    this.ensureNotDisposed();
    this._isAtPrompt$.next(value);
  }

  getRecentCommands(count: number): ITerminalCommand[] {
    const commands = this._commands$.getValue();
    return commands.slice(-count);
  }

  getCommandOutput(commandId: string): string {
    const commands = this._commands$.getValue();
    const cmd = commands.find((c) => c.id === commandId);
    return cmd?.output ?? '';
  }

  override dispose(): void {
    this._commands$.complete();
    this._currentCwd$.complete();
    this._isAtPrompt$.complete();
    this._commandFinished$.complete();
    this._lastCommand$.complete();
    super.dispose();
  }
}
