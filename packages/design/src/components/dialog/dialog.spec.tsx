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

import type { Root } from 'react-dom/client';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';

function setViewportSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: height,
  });
}

function createDomRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('Dialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    setViewportSize(1200, 700);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('keeps draggable dialogs inside the viewport after resize while closed', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.slot === 'dialog-content') {
        return this.isConnected ? createDomRect(960, 500) : createDomRect(0, 0);
      }

      return createDomRect(0, 0);
    });

    function renderDialog(open: boolean) {
      act(() => {
        root.render(
          <Dialog open={open} draggable width={960}>
            <div>content</div>
          </Dialog>
        );
      });
    }

    renderDialog(true);

    let dialogContent = document.body.querySelector('[data-slot="dialog-content"]') as HTMLDivElement | null;
    expect(dialogContent).not.toBeNull();
    expect(dialogContent?.style.left).toBe('120px');
    expect(dialogContent?.style.top).toBe('100px');

    renderDialog(false);

    setViewportSize(800, 600);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    renderDialog(true);

    dialogContent = document.body.querySelector('[data-slot="dialog-content"]') as HTMLDivElement | null;
    expect(dialogContent).not.toBeNull();
    expect(dialogContent?.style.left).toBe('16px');
    expect(dialogContent?.style.top).toBe('50px');
  });

  it('centers draggable dialogs in the full viewport regardless of workbench-content', () => {
    const workbenchContent = document.createElement('section');
    workbenchContent.dataset.uComp = 'workbench-content';
    document.body.appendChild(workbenchContent);

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.uComp === 'workbench-content') {
        return createDomRect(1200, 662);
      }

      if (this.dataset.slot === 'dialog-content') {
        return createDomRect(960, 500);
      }

      return createDomRect(0, 0);
    });

    Object.defineProperty(workbenchContent, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        ...createDomRect(1200, 662),
        top: 38,
        left: 0,
        right: 1200,
        bottom: 700,
      }),
    });

    act(() => {
      root.render(
        <Dialog open draggable width={960}>
          <div>content</div>
        </Dialog>
      );
    });

    const dialogContent = document.body.querySelector('[data-slot="dialog-content"]') as HTMLDivElement | null;
    expect(dialogContent).not.toBeNull();
    expect(dialogContent?.style.left).toBe('120px');
    expect(dialogContent?.style.top).toBe('100px');

    workbenchContent.remove();
  });

  it('detaches drag listeners and disconnects the resize observer when closed', () => {
    class MockResizeObserver {
      static instances: MockResizeObserver[] = [];
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      constructor() {
        MockResizeObserver.instances.push(this);
      }
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const addSpy = vi.spyOn(document, 'addEventListener');

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.slot === 'dialog-content') {
        return createDomRect(960, 500);
      }

      return createDomRect(0, 0);
    });

    function renderDialog(open: boolean) {
      act(() => {
        root.render(
          <Dialog open={open} draggable width={960}>
            <div>content</div>
          </Dialog>
        );
      });
    }

    renderDialog(true);

    // No document-level drag listeners while merely open (not dragging).
    expect(addSpy.mock.calls.some(([type]) => type === 'mousemove')).toBe(false);
    expect(MockResizeObserver.instances.length).toBeGreaterThan(0);
    for (const instance of MockResizeObserver.instances) {
      expect(instance.observe).toHaveBeenCalled();
    }

    renderDialog(false);

    // Content unmounted: every observer must be disconnected so it never
    // keeps a detached dialog DOM tree alive.
    for (const instance of MockResizeObserver.instances) {
      expect(instance.disconnect).toHaveBeenCalled();
    }

    vi.unstubAllGlobals();
  });

  it('registers drag listeners only while dragging and restores userSelect on unmount mid-drag', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.slot === 'dialog-content') {
        return createDomRect(960, 500);
      }

      return createDomRect(0, 0);
    });

    act(() => {
      root.render(
        <Dialog open draggable title="drag me" width={960}>
          <div>content</div>
        </Dialog>
      );
    });

    const handle = document.body.querySelector('[data-drag-handle="true"]') as HTMLElement | null;
    expect(handle).not.toBeNull();

    act(() => {
      handle?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 200, clientY: 120 }));
    });
    expect(document.body.style.userSelect).toBe('none');

    // Unmount mid-drag: effect teardown must remove listeners and restore
    // userSelect, since mouseup will never reach endDrag anymore.
    act(() => {
      root.render(null);
    });
    expect(document.body.style.userSelect).toBe('');
  });
});
