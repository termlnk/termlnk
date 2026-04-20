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

import type { IPendingInteractionPayload } from '@termlnk/agent';
import type { IElectronMainConfig } from './config.schema';
import process from 'node:process';
import { is } from '@electron-toolkit/utils';
import { IAgentHookServerService } from '@termlnk/agent';
import { Disposable, IConfigService, ILifecycleService, ILogService, Inject, LifecycleStages, toDisposable } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { IWindowManagerService, WindowEvent } from '@termlnk/electron';
import { IIslandStateService, ISLAND_WINDOW_HEIGHT, ISLAND_WINDOW_WIDTH } from '@termlnk/island';
import { BrowserWindow, powerMonitor, screen } from 'electron';
import { distinctUntilChanged, filter, map } from 'rxjs';
import { ELECTRON_MAIN_PLUGIN_CONFIG_KEY } from './config.schema';

/** Config key for island settings (shared with settings-ui) */
const ISLAND_SETTINGS_CONFIG_KEY = 'island.settings';

interface IIslandSettingsStored {
  enabled?: boolean;
}

export class DynamicIslandController extends Disposable {
  private _islandBrowserWindow: BrowserWindow | null = null;
  private _isVisible = false;
  private _isEnabled = true;

  /** Per-window before-input-event handlers for permission keyboard shortcuts. */
  private readonly _beforeInputHandlers = new Map<number, (event: Electron.Event, input: Electron.Input) => void>();

  constructor(
    @IIslandStateService private readonly _islandStateService: IIslandStateService,
    @IAgentHookServerService private readonly _hookServerService: IAgentHookServerService,
    @IWindowManagerService private readonly _windowManagerService: IWindowManagerService,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @ILifecycleService private readonly _lifecycleService: ILifecycleService
  ) {
    super();

    // macOS only
    if (process.platform !== 'darwin') {
      return;
    }

    this._initConfigListener();
    this._initListeners();
    this._initDisplayListener();
    this._initPowerMonitorListener();
    this._initAppQuitListener();
    this._initPermissionKeyboard();
  }

  // ---------------------------------------------------------------------------
  // Config listener
  // ---------------------------------------------------------------------------

  private _initConfigListener(): void {
    void this._loadConfigEnabled().catch((err: any) => {
      this._logService.error(`[DynamicIsland] Failed to load config: ${err.message}`);
    });

    this.disposeWithMe(
      this._configRepository.changed$.pipe(
        filter((event) => event.key === ISLAND_SETTINGS_CONFIG_KEY)
      ).subscribe(() => {
        void this._onConfigChanged();
      })
    );
  }

  private async _loadConfigEnabled(): Promise<void> {
    await this._lifecycleService.onStage(LifecycleStages.Ready);
    const stored = await this._configRepository.getField<IIslandSettingsStored>(ISLAND_SETTINGS_CONFIG_KEY, 'settings');
    this._isEnabled = stored?.enabled !== false;
    this._logService.log('[DynamicIsland]', `Config loaded, enabled=${this._isEnabled}`);

    if (this._isEnabled) {
      void this._showIsland();
    }
  }

  private async _onConfigChanged(): Promise<void> {
    const stored = await this._configRepository.getField<IIslandSettingsStored>(ISLAND_SETTINGS_CONFIG_KEY, 'settings');
    const wasEnabled = this._isEnabled;
    this._isEnabled = stored?.enabled !== false;

    if (wasEnabled && !this._isEnabled) {
      this._destroyIslandWindow();
    } else if (!wasEnabled && this._isEnabled) {
      void this._showIsland();
    }
  }

  // ---------------------------------------------------------------------------
  // State listeners
  // ---------------------------------------------------------------------------

  private _initListeners(): void {
    // Show the island whenever a new session appears and the window hasn't been
    // created yet (e.g. first session after app launch before config finishes loading).
    this.disposeWithMe(
      this._islandStateService.state$.pipe(
        map((state) => state.sessions.length > 0),
        distinctUntilChanged(),
        filter((hasActive) => hasActive)
      ).subscribe(() => {
        void this._showIsland();
      })
    );
  }

  /**
   * When all non-island windows close, destroy the island window
   * so Electron's `window-all-closed` event fires and the app can quit.
   */
  private _initAppQuitListener(): void {
    this.disposeWithMe(
      this._windowManagerService.windowEvent$.subscribe((eventMap) => {
        for (const [windowId, event] of eventMap) {
          if (event !== WindowEvent.Close) {
            continue;
          }
          if (this._islandBrowserWindow && windowId === this._islandBrowserWindow.id) {
            continue;
          }
          setTimeout(() => {
            const remaining = BrowserWindow.getAllWindows().filter(
              (w) => w !== this._islandBrowserWindow && !w.isDestroyed()
            );
            if (remaining.length === 0) {
              this._destroyIslandWindow();
            }
          }, 200);
        }
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Show / Hide
  // ---------------------------------------------------------------------------

  private async _showIsland(): Promise<void> {
    if (!this._isEnabled) {
      return;
    }

    if (!this._islandBrowserWindow) {
      await this._createIslandWindow();
      if (!this._islandBrowserWindow) {
        return;
      }
    }

    if (this._isVisible) {
      return;
    }

    const { x, y } = this._computeNotchPosition();
    this._islandBrowserWindow.setPosition(x, y, false);
    this._islandBrowserWindow.showInactive();
    this._isVisible = true;

    // Stationary 必须在 showInactive() + 首次 paint 之后设置，
    // 否则 Chromium deferred Cocoa 操作会覆盖 collectionBehavior。
    this._applyStationaryBehavior(this._islandBrowserWindow);
    // 延时兜底，捕获偶发的 deferred reset
    setTimeout(() => {
      if (this._isVisible && this._islandBrowserWindow && !this._islandBrowserWindow.isDestroyed()) {
        this._applyStationaryBehavior(this._islandBrowserWindow);
      }
    }, 500);

    this._logService.log('[DynamicIsland]', 'Shown');
  }

  // ---------------------------------------------------------------------------
  // Window creation — bypasses WindowManagerService.createWindow() to avoid
  // merging DEFAULT_WINDOW_OPTIONS and platform defaults (vibrancy, titleBar)
  // that would pollute the island's transparent frameless configuration.
  // ---------------------------------------------------------------------------

  private async _createIslandWindow(): Promise<void> {
    if (this._islandBrowserWindow) {
      return;
    }

    const config = this._configService.getConfig<IElectronMainConfig>(ELECTRON_MAIN_PLUGIN_CONFIG_KEY);
    if (!config) {
      return;
    }

    const { x, y } = this._computeNotchPosition();

    const win = new BrowserWindow({
      width: ISLAND_WINDOW_WIDTH,
      height: ISLAND_WINDOW_HEIGHT,
      x,
      y,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      type: 'panel',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      webPreferences: {
        preload: config.preload,
        sandbox: false,
        devTools: is.dev,
      },
    });

    this._islandBrowserWindow = win;

    // 禁用此窗口的 constrainFrameRect:toScreen:（method swizzling），
    // 使 y=0 贴顶位置不受系统状态转换期间 window level 降级影响。
    this._disableFrameConstraint(win);

    win.setAlwaysOnTop(true, 'screen-saver');

    // Persist across all Spaces and fullscreen apps.
    // skipTransformProcessType 必须传 true：Electron 默认会把应用切到
    // UIElementApplication（accessory）以叠加全屏窗口，导致 Dock 图标消失、
    // 主窗口在切换应用后自动隐藏。这里直接跳过 process type 转换。
    win.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });

    // Click-through by default
    win.setIgnoreMouseEvents(true, { forward: true });

    this._setupIPC(win);
    this._setupAlwaysOnTopGuard(win);

    await win.loadURL(this._getIslandUrl());

    this._logService.log('[DynamicIsland]', `Window created at (${x}, ${y}), size ${ISLAND_WINDOW_WIDTH}x${ISLAND_WINDOW_HEIGHT}`);
  }

  // ---------------------------------------------------------------------------
  // IPC
  // ---------------------------------------------------------------------------

  private _setupIPC(win: BrowserWindow): void {
    win.webContents.ipc.on('island:set-interactive', (_, interactive: boolean) => {
      if (!win.isDestroyed()) {
        if (interactive) {
          win.setIgnoreMouseEvents(false);
        } else {
          win.setIgnoreMouseEvents(true, { forward: true });
        }
      }
    });
  }

  /** 当 macOS 将窗口的 alwaysOnTop 降级时，立即恢复层级和位置。 */
  private _setupAlwaysOnTopGuard(win: BrowserWindow): void {
    win.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
      if (!isAlwaysOnTop && this._isVisible && !win.isDestroyed()) {
        this._restoreIslandLevel();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Positioning
  // ---------------------------------------------------------------------------

  private _getBuiltInDisplay(): Electron.Display {
    const displays = screen.getAllDisplays();
    return displays.find((d) => (d as any).internal === true) ?? screen.getPrimaryDisplay();
  }

  private _computeNotchPosition(): { x: number; y: number } {
    const { bounds } = this._getBuiltInDisplay();

    return {
      x: Math.round(bounds.x + (bounds.width - ISLAND_WINDOW_WIDTH) / 2),
      y: bounds.y,
    };
  }

  private _initDisplayListener(): void {
    const handler = () => {
      if (this._isVisible && this._islandBrowserWindow) {
        const { x, y } = this._computeNotchPosition();
        this._islandBrowserWindow.setPosition(x, y, false);
      }
    };
    screen.on('display-metrics-changed', handler);
    this.disposeWithMe(toDisposable(() => {
      screen.off('display-metrics-changed', handler);
    }));
  }

  /**
   * 补充 _setupAlwaysOnTopGuard 的辅助防线：
   * 部分场景下 level 数值被降级但 alwaysOnTop 布尔值未翻转，
   * always-on-top-changed 不会触发，需通过电源事件补充覆盖。
   */
  private _initPowerMonitorListener(): void {
    const handler = () => {
      this._restoreIslandLevel();
    };
    powerMonitor.on('unlock-screen', handler);
    powerMonitor.on('resume', handler);
    this.disposeWithMe(toDisposable(() => {
      powerMonitor.off('unlock-screen', handler);
      powerMonitor.off('resume', handler);
    }));
  }

  /** 重新提升灵动岛窗口的层级和位置。先恢复 level，再设 position。 */
  private _restoreIslandLevel(): void {
    if (!this._isVisible || !this._islandBrowserWindow || this._islandBrowserWindow.isDestroyed()) {
      return;
    }
    this._islandBrowserWindow.setAlwaysOnTop(true, 'screen-saver');
    const { x, y } = this._computeNotchPosition();
    this._islandBrowserWindow.setPosition(x, y, false);
    this._applyStationaryBehavior(this._islandBrowserWindow);
  }

  /**
   * 通过原生 addon 设置 NSWindowCollectionBehaviorStationary，
   * 使灵动岛在 Mission Control / Spaces 动画中保持原地不动。
   * Electron 未暴露此 API，必须通过原生代码设置。
   */
  private _applyStationaryBehavior(win: BrowserWindow): void {
    try {
      // eslint-disable-next-line ts/no-require-imports
      const { makeStationary } = require('@termlnk/macos-utils') as typeof import('@termlnk/macos-utils');
      makeStationary(win.getNativeWindowHandle());
    } catch (err: any) {
      this._logService.error('[DynamicIsland]', `Failed to apply stationary behavior: ${err.message}`);
    }
  }

  /**
   * 通过原生 addon（method swizzling）禁用此窗口的 constrainFrameRect:toScreen:，
   * 使 y=0 不受 AppKit visibleFrame 约束。仅对标记的窗口生效。
   */
  private _disableFrameConstraint(win: BrowserWindow): void {
    try {
      // eslint-disable-next-line ts/no-require-imports
      const { disableFrameConstraint } = require('@termlnk/macos-utils') as typeof import('@termlnk/macos-utils');
      disableFrameConstraint(win.getNativeWindowHandle());
    } catch (err: any) {
      this._logService.error('[DynamicIsland]', `Failed to disable frame constraint: ${err.message}`);
    }
  }

  private _getIslandUrl(): string {
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      return `${process.env.ELECTRON_RENDERER_URL}/island.html`;
    }
    return 'app://termlnk/island.html';
  }

  // ---------------------------------------------------------------------------
  // Permission keyboard shortcuts (cross-window)
  // ---------------------------------------------------------------------------

  /**
   * 在所有非岛窗口上注册 before-input-event 监听，
   * 使用户在终端主窗口也能通过 ⌘Y/⌘N 响应权限请求。
   */
  private _initPermissionKeyboard(): void {
    this.disposeWithMe(
      this._islandStateService.state$.pipe(
        map((state) => state.pendingInteractions),
        distinctUntilChanged((a, b) =>
          a.length === b.length && a[0]?.requestId === b[0]?.requestId
        )
      ).subscribe((interactions) => {
        this._clearPermissionHandlers();
        if (interactions.length > 0) {
          this._registerPermissionHandlers(interactions);
        }
      })
    );
  }

  private _registerPermissionHandlers(interactions: IPendingInteractionPayload[]): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed() || win === this._islandBrowserWindow) {
        continue;
      }
      const handler = (event: Electron.Event, input: Electron.Input) => {
        if (input.type !== 'keyDown' || !input.meta) {
          return;
        }
        const request = interactions[0];
        if (!request) {
          return;
        }

        const key = input.key.toLowerCase();
        if (key === 'y') {
          event.preventDefault();
          this._hookServerService.respondPermission(request.requestId, { kind: 'allow' });
          return;
        }
        if (key === 'n') {
          event.preventDefault();
          this._hookServerService.respondPermission(request.requestId, { kind: 'deny' });
          return;
        }
        // ⌘1–⌘9: pick an AskUserQuestion option. The question is already
        // parsed server-side into request.question, so the handler just
        // indexes into it and sends the chosen label back through the
        // adapter's wire formatter (Claude Code → updatedInput.answers,
        // others → deny + message).
        const num = Number.parseInt(input.key, 10);
        if (num >= 1 && num <= 9 && request.kind === 'question') {
          event.preventDefault();
          const option = request.question.options[num - 1];
          if (option) {
            this._hookServerService.respondPermission(
              request.requestId,
              { kind: 'answer', label: option.label }
            );
          }
        }
      };
      win.webContents.on('before-input-event', handler);
      this._beforeInputHandlers.set(win.id, handler);
    }
  }

  private _clearPermissionHandlers(): void {
    for (const [winId, handler] of this._beforeInputHandlers) {
      const win = BrowserWindow.fromId(winId);
      if (win && !win.isDestroyed()) {
        win.webContents.off('before-input-event', handler);
      }
    }
    this._beforeInputHandlers.clear();
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  private _destroyIslandWindow(): void {
    const win = this._islandBrowserWindow;
    if (!win) {
      return;
    }

    this._islandBrowserWindow = null;
    this._isVisible = false;

    if (!win.isDestroyed()) {
      win.destroy();
    }
  }

  override dispose(): void {
    this._clearPermissionHandlers();
    this._destroyIslandWindow();
    super.dispose();
  }
}
