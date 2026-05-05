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
import type { ComponentType } from 'react';
import { createIdentifier, Disposable, toDisposable } from '@termlnk/core';

/**
 * A component definition registered against a tool name. When the assistant invokes that
 * tool, the chat surface looks the component up here and renders it with the tool's
 * input as props (plus an `isStreaming` flag).
 */
export interface IGenerativeUIComponentDef {
  readonly name: string;
  readonly render: ComponentType<Record<string, unknown> & { isStreaming?: boolean }>;
}

export interface IGenerativeUIRegistryService {
  register(def: IGenerativeUIComponentDef): IDisposable;
  get(toolName: string): IGenerativeUIComponentDef | undefined;
  has(toolName: string): boolean;
}

export const IGenerativeUIRegistryService = createIdentifier<IGenerativeUIRegistryService>('agent-ui.generative-ui-registry-service');

export class GenerativeUIRegistryService extends Disposable implements IGenerativeUIRegistryService {
  private readonly _registry = new Map<string, IGenerativeUIComponentDef>();

  register(def: IGenerativeUIComponentDef): IDisposable {
    this._registry.set(def.name, def);
    return toDisposable(() => {
      const current = this._registry.get(def.name);
      if (current === def) {
        this._registry.delete(def.name);
      }
    });
  }

  get(toolName: string): IGenerativeUIComponentDef | undefined {
    return this._registry.get(toolName);
  }

  has(toolName: string): boolean {
    return this._registry.has(toolName);
  }

  override dispose(): void {
    super.dispose();
    this._registry.clear();
  }
}
