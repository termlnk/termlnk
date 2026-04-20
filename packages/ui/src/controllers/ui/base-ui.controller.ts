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

import type { IDisposable, IInstanceService, ILifecycleService, Injector } from '@termlnk/core';
import type { ILayoutService } from '../../services/layout/layout.service';
import type { IRenderManagerService } from '../../services/render/render-manager.service';
import type { IUIConfig } from '../config.schema';
import { Disposable, LifecycleStages, LifecycleUnreachableError } from '@termlnk/core';
import { injectUIFontToDOM } from '../../common/inject-ui-font';
import { DEFAULT_UI_FONT_SIZE } from '../config.schema';

const STEADY_TIMEOUT = 1000;

export abstract class BaseUIController extends Disposable {
  protected _steadyTimeout: number;
  protected _renderTimeout: number;

  constructor(
    protected readonly _config: IUIConfig,
    protected readonly _injector: Injector,
    protected readonly _instanceService: IInstanceService,
    protected readonly _layoutService: ILayoutService,
    protected readonly _lifecycleService: ILifecycleService,
    protected readonly _renderManagerService: IRenderManagerService
  ) {
    super();

    this._init();
  }

  private _init() {
    injectUIFontToDOM(this._config.fontFamily ?? '', this._config.fontSize ?? DEFAULT_UI_FONT_SIZE);
  }

  override dispose(): void {
    super.dispose();

    clearTimeout(this._steadyTimeout);
    clearTimeout(this._renderTimeout);
  }

  private _onRenderer = async (contentElement: HTMLElement, containerElement: HTMLElement): Promise<void> => {
    if (this._layoutService) {
      this.disposeWithMe(this._layoutService.registerRootContainerElement(containerElement));
      this.disposeWithMe(this._layoutService.registerContentElement(contentElement));
    }

    try {
      await this._lifecycleService.onStage(LifecycleStages.Ready);
      this._renderTimeout = window.setTimeout(() => {
        // First render.
        const allRenders = this._renderManagerService.getRenderAll();
        for (const [key] of allRenders) {
          if (this._changeRender(key, contentElement)) break;
        }

        // Render as focus shifts.
        this.disposeWithMe(this._instanceService.focused$.subscribe((unit) => {
          if (unit) this._changeRender(unit, contentElement);
        }));

        // When renderer created, check if matches the focused.
        this.disposeWithMe(this._renderManagerService.created$.subscribe((render) => {
          if (render.id === this._instanceService.getFocusedUnit()?.getId()) this._changeRender(render.id, contentElement);
        }));

        this.disposeWithMe(this._renderManagerService.disposed$.subscribe((render) => {
          if (this._currentRenderId === render) this._currentRenderId = null;
        }));

        this._lifecycleService.setStage(LifecycleStages.Rendered);
        this._steadyTimeout = window.setTimeout(() => {
          this._lifecycleService.setStage(LifecycleStages.Steady);
        }, STEADY_TIMEOUT);
      }, 300);
    } catch (error) {
      if (error instanceof LifecycleUnreachableError) {
        return;
      }

      throw error;
    }
  };

  protected _bootstrapWorkbench() {
    this.disposeWithMe(this.bootstrap(this._onRenderer));
  }

  private _currentRenderId: string | null = null;
  private _changeRender(renderId: string, _contentElement: HTMLElement): boolean {
    if (this._currentRenderId === renderId) return false;

    const render = this._renderManagerService.getRenderById(renderId)!;
    if (!render || !render.id) return false;

    const currentRenderer = this._currentRenderId ? this._renderManagerService.getRenderById(this._currentRenderId) : null;
    currentRenderer?.deactivate();
    render.activate();
    this._currentRenderId = renderId;
    return true;
  }

  abstract bootstrap(callback: (contentElement: HTMLElement, containerElement: HTMLElement) => void): IDisposable;
}
