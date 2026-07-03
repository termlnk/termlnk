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
import { Disposable, ILogService, Optional, toDisposable } from '@termlnk/core';
import { createElement, useEffect, useRef } from 'react';

type ComponentFramework = string;

export interface IComponentOptions {
  framework?: ComponentFramework;
}

export interface IComponent<T = any> {
  framework: string;
  component: T;
}

export type ComponentType = any;

export type ComponentList = Map<string, IComponent>;

export class ComponentManagerService extends Disposable {
  private _components: ComponentList = new Map();
  private _componentsReverse = new Map<ComponentType, string>();

  constructor(
    @Optional(ILogService) private readonly _logService?: ILogService
  ) {
    super();
  }

  register(name: string, component: ComponentType, options?: IComponentOptions): IDisposable {
    const { framework = 'react' } = options || {};

    if (this._components.has(name)) {
      this._logService?.warn(`Component ${name} already exists.`);
    }

    this._components.set(name, {
      framework,
      component,
    });
    this._componentsReverse.set(component, name);

    return toDisposable(() => {
      this._components.delete(name);
      this._componentsReverse.delete(component);
    });
  }

  getKey(component: ComponentType) {
    return this._componentsReverse.get(component);
  }

  reactUtils: {
    createElement: typeof createElement;
    useEffect: typeof useEffect;
    useRef: typeof useRef;
  } = {
    createElement,
    useEffect,
    useRef,
  };

  private _handler: Record<string, (component: IComponent['component'], name?: string) => any> = {
    react: (component: IComponent['component']) => {
      return component;
    },
  };

  setHandler(framework: string, handler: (component: IComponent['component'], name?: string) => any) {
    this._handler[framework] = handler;
  }

  get(name: string) {
    if (!name) {
      return;
    }

    const value = this._components.get(name);

    if (!value) {
      return;
    }

    const frameworkHandler = this._handler[value.framework];

    if (!frameworkHandler) {
      throw new Error(`[ComponentManager] No handler found for framework: ${value.framework}`);
    }

    return frameworkHandler(value.component, name);
  }

  delete(name: string) {
    this._components.delete(name);
  }
}
