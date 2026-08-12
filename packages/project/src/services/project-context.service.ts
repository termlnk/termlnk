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

import type { Nullable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { IProjectContext } from '../models/project-context';
import { createIdentifier } from '@termlnk/core';

export interface IProjectContextService {
  readonly activeContext$: Observable<Nullable<IProjectContext>>;
  get activeContext(): Nullable<IProjectContext>;
  /** Manually pin a context, decoupling panels from tab switching. */
  pinContext(context: IProjectContext | null): void;
}

export const IProjectContextService = createIdentifier<IProjectContextService>(
  'project.project-context-service'
);
