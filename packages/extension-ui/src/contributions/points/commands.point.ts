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

import type { IContributedCommand, IContributionPoint, IExtensionDescription, IExtensionService } from '@termlnk/extension';
import type { Subscription } from 'rxjs';
import type { z } from 'zod';
import { DisposableCollection, ICommandService, ILogService, Inject, Injector, toDisposable } from '@termlnk/core';
import {
  contributedCommandsSchema,
  IExtensionService as IExtensionServiceId,
} from '@termlnk/extension';
import { filter } from 'rxjs';

/**
 * `commands` contribution point.
 *
 * For every command declared under `contributes.commands[]`, the point
 * installs a **placeholder** command that — when first invoked —
 * activates the owning extension and re-dispatches to the real handler
 * registered during `activate()`. When the extension activates through any
 * other channel the placeholders self-destruct immediately so subsequent
 * `commands.register()` calls from the extension do not collide.
 *
 * Each call to `apply()` returns a disposable that removes **only** the
 * placeholders owned by that extension — concurrent contributions from
 * other extensions are unaffected.
 */
export class CommandsPoint implements IContributionPoint<IContributedCommand[]> {
  readonly name = 'commands';
  readonly schema: z.ZodType<IContributedCommand[]> = contributedCommandsSchema;

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @ICommandService private readonly _commandService: ICommandService,
    @IExtensionServiceId private readonly _extensionService: IExtensionService,
    @ILogService private readonly _logService: ILogService
  ) {}

  apply(description: IExtensionDescription, commands: IContributedCommand[]): ReturnType<IContributionPoint<IContributedCommand[]>['apply']> {
    const collection = new DisposableCollection();

    for (const cmd of commands) {
      if (this._commandService.hasCommand(cmd.command)) {
        // Already registered either by a previous contribution or by the
        // extension itself (e.g. activation ran before contribution apply).
        continue;
      }

      collection.add(this._commandService.registerCommand({
        id: cmd.command,
        handler: async (_accessor, params, options) => {
          // The placeholder may still be wired when the user triggers the
          // command directly — dispose so the real handler can take over.
          collection.dispose();
          try {
            await this._extensionService.activateByEvent(`onCommand:${cmd.command}`);
          } catch (err) {
            this._logService.error('[CommandsContributionPoint]', `Failed to activate for "${cmd.command}"`, err);
            return false;
          }
          if (this._commandService.hasCommand(cmd.command)) {
            return this._commandService.executeCommand(cmd.command, params, options);
          }
          return false;
        },
      }));
    }

    // Self-tear-down when the extension activates through any other route.
    const subscription: Subscription = this._extensionService.onChange$
      .pipe(filter((event) => event.kind === 'activated' && event.extensionId === description.id))
      .subscribe(() => collection.dispose());

    return toDisposable(() => {
      subscription.unsubscribe();
      collection.dispose();
    });
  }
}
