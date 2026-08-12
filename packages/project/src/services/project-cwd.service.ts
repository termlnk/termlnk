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
import { createIdentifier } from '@termlnk/core';

export interface IProjectCwdChange {
  sessionId: string;
  cwd: string;
}

/**
 * Push signal for `cd` in any tracked terminal session, sourced from shell
 * integration (OSC 633;P;Cwd / OSC 7) in the main process.
 *
 * Exists so the project panels can react to directory changes instead of
 * polling getCurrentCwd on a timer — polling cost scales with open sessions and
 * each remote tick costs an SSH round trip.
 */
export interface IProjectCwdService {
  readonly cwdChanged$: Observable<IProjectCwdChange>;
}

export const IProjectCwdService = createIdentifier<IProjectCwdService>(
  'project.project-cwd-service'
);
