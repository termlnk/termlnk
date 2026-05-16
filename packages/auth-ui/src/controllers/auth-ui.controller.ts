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

import { Disposable, ICommandService } from '@termlnk/core';
import { AUTH_COMMANDS } from '../commands/auth.commands';

export class AuthUIController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService
  ) {
    super();

    for (const command of AUTH_COMMANDS) {
      this.disposeWithMe(this._commandService.registerCommand(command));
    }
  }
}
