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

import type { IDisposable } from '@termlnk/core';
import type { z } from 'zod';
import type { IExtensionDescription } from '../models/extension-description';

export interface IExtensionPointContribution<T> {
  readonly description: IExtensionDescription;
  readonly value: T;
}

export interface IExtensionPointDelta<T> {
  readonly added: ReadonlyArray<IExtensionPointContribution<T>>;
  readonly removed: ReadonlyArray<IExtensionPointContribution<T>>;
}

export type IExtensionPointHandler<T> = (
  delta: IExtensionPointDelta<T>
) => void | Promise<void>;

export interface IExtensionPointDescriptor<T> {
  readonly name: string;
  readonly schema: z.ZodType<T>;
}

export interface IExtensionPoint<T> {
  readonly name: string;
  readonly schema: z.ZodType<T>;

  setHandler(handler: IExtensionPointHandler<T>): IDisposable;

  push(added: ReadonlyArray<IExtensionPointContribution<T>>): void;
  pop(removed: ReadonlyArray<IExtensionPointContribution<T>>): void;
}
