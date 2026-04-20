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
import type { ITermlnkWorkbenchProps } from '../../views/workbench/Workbench';
import type { IUIConfig } from '../config.schema';
import type { IWorkbenchOptions } from './ui.controller';
import { IInstanceService, ILifecycleService, Inject, Injector, toDisposable } from '@termlnk/core';
import { connectInjector, render as createRoot, unmount } from '@termlnk/design';
import { ComponentManagerService } from '../../services/component/component-manager.service';
import { ILayoutService } from '../../services/layout/layout.service';
import { BuiltInUIPart, IUIPartsService } from '../../services/parts/parts.service';
import { IRenderManagerService } from '../../services/render/render-manager.service';
import { LeftSidebarToggle } from '../../views/components/left-sidebar/LeftSidebarToggle';
import { ResizablePanel } from '../../views/components/resizable/ResizablePanel';
import { RightSidebarToggle } from '../../views/components/right-sidebar/RightSidebarToggle';
import { DesktopWorkbench } from '../../views/workbench/Workbench';
import { BaseUIController } from './base-ui.controller';

export class DesktopUIController extends BaseUIController {
  constructor(
    protected override readonly _config: IUIConfig,
    @Inject(Injector) injector: Injector,
    @ILifecycleService lifecycleService: ILifecycleService,
    @ILayoutService layoutService: ILayoutService,
    @IInstanceService instanceService: IInstanceService,
    @IUIPartsService uiPartsService: IUIPartsService,
    @IRenderManagerService renderManagerService: IRenderManagerService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService
  ) {
    super(_config, injector, instanceService, layoutService, lifecycleService, renderManagerService);

    this._initBuiltinComponents(uiPartsService);
    this._bootstrapWorkbench();
  }

  override dispose(): void {
    super.dispose();
    this._componentManagerService.dispose();
  }

  override bootstrap(callback: (contentElement: HTMLElement, containerElement: HTMLElement) => void): IDisposable {
    return bootstrap(this._injector, this._config, callback);
  }

  private _initBuiltinComponents(uiPartsService: IUIPartsService): void {
    this.disposeWithMe(uiPartsService.registerComponent(BuiltInUIPart.CONTAINER, () => connectInjector(ResizablePanel, this._injector)));
    this.disposeWithMe(uiPartsService.registerComponent(BuiltInUIPart.HEADER_ACTION, () => connectInjector(LeftSidebarToggle, this._injector)));
    this.disposeWithMe(uiPartsService.registerComponent(BuiltInUIPart.HEADER_TRAILING, () => connectInjector(RightSidebarToggle, this._injector)));
  }
}

function bootstrap(injector: Injector, options: IWorkbenchOptions, callback: (contentEl: HTMLElement, containerElement: HTMLElement) => void): IDisposable {
  let mountContainer: HTMLElement;

  const container = options.container;
  if (typeof container === 'string') {
    const containerElement = document.getElementById(container);
    if (!containerElement) {
      mountContainer = createContainer(container);
    } else {
      mountContainer = containerElement;
    }
  } else if (container instanceof HTMLElement) {
    mountContainer = container;
  } else {
    mountContainer = createContainer('termlnk');
  }

  const ConnectedApp = connectInjector(DesktopWorkbench, injector) as ComponentType<ITermlnkWorkbenchProps>;
  const onRendered = (contentElement: HTMLElement) => callback(contentElement, mountContainer);

  function render() {
    createRoot(
      <ConnectedApp
        {...options}
        mountContainer={mountContainer}
        onRendered={onRendered}
      />,
      mountContainer
    );
  }

  render();

  return toDisposable(() => {
    // https://github.com/facebook/react/issues/26031
    createRoot(<div />, mountContainer);
    setTimeout(() => createRoot(<div />, mountContainer), 200);
    setTimeout(unmount, 500, mountContainer);
  });
}

function createContainer(id: string): HTMLElement {
  const element = document.createElement('div');
  element.id = id;
  return element;
}
