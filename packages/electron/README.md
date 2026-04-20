# @termlnk/electron

Electron 相关工具和服务，基于 `@termlnk/rpc` 实现进程间 RPC 通信。

## 功能特性

- ✅ **Electron IPC RPC**: 基于 IPC 的主进程和渲染进程 RPC 通信
- ✅ **多窗口支持**: 支持一个主进程管理多个渲染进程窗口
- ✅ **插件系统**: 通过插件轻松集成到 termlnk 应用
- ✅ **类型安全**: 完整的 TypeScript 类型定义
- ✅ **示例服务**: 提供文件系统、窗口管理、系统信息示例服务

## 安装

```bash
pnpm add @termlnk/electron
```

## 快速开始

### 1. 在 Preload 脚本中暴露 IPC 桥接

```typescript
// preload/index.ts
import { exposeIPCBridge } from '@termlnk/electron';

exposeIPCBridge();
```

### 2. 在主进程中注册 RPC 服务

```typescript
// main/index.ts
import { app, BrowserWindow } from 'electron';
import { Core } from '@termlnk/core';
import { ElectronIPCServerPlugin, FileSystemService } from '@termlnk/electron';
import { fromModule, IRPCChannelService } from '@termlnk/rpc';

// 创建窗口
const mainWindow = new BrowserWindow({
  width: 800,
  height: 600,
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.js'),
    nodeIntegration: false,
    contextIsolation: true,
  },
});

// 初始化 termlnk
const core = new Core();

// 注册 Electron IPC Server 插件
core.registerPlugin(ElectronIPCServerPlugin, {
  target: mainWindow, // 传入 BrowserWindow 或 WebContents
});

// 获取 RPC Channel Service
const rpcService = core.injector.get(IRPCChannelService);

// 注册文件系统服务
const fsService = new FileSystemService();
rpcService.registerChannel('fs', fromModule(fsService));
```

### 3. 在渲染进程中调用 RPC 服务

```typescript
// renderer/main.tsx
import { Core } from '@termlnk/core';
import { ElectronIPCClientPlugin } from '@termlnk/electron';
import { toModule, IRPCChannelService } from '@termlnk/rpc';
import type { FileSystemService } from '@termlnk/electron';

// 初始化 termlnk
const core = new Core();

// 注册 Electron IPC Client 插件
core.registerPlugin(ElectronIPCClientPlugin);

// 获取 RPC Channel Service
const rpcService = core.injector.get(IRPCChannelService);

// 请求文件系统服务
const fsChannel = rpcService.requestChannel('fs');
const fsService = toModule<FileSystemService>(fsChannel);

// 使用服务
async function readFile() {
  const content = await fsService.readFile('/path/to/file.txt');
  console.log(content);
}

// 订阅文件变化
fsService.watchFile$('/path/to/file.txt').subscribe((content) => {
  console.log('File changed:', content);
});
```

## 多窗口场景

使用 `WindowRPCManager` 管理多个窗口的 RPC 连接：

```typescript
// main/index.ts
import { WindowRPCManager, FileSystemService } from '@termlnk/electron';
import { fromModule } from '@termlnk/rpc';

// 创建窗口管理器
const windowManager = new WindowRPCManager(core.injector);

// 注册主窗口
const mainWindow = new BrowserWindow({ ... });
windowManager.registerWindow(mainWindow);

// 注册子窗口
const childWindow = new BrowserWindow({ ... });
windowManager.registerWindow(childWindow);

// 为所有窗口注册服务
const fsService = new FileSystemService();
windowManager.registerModuleForAllWindows('fs', fsService);

// 为特定窗口注册服务
windowManager.registerChannel(
  mainWindow.id,
  'special-service',
  fromModule(specialService),
);

// 窗口关闭时会自动清理（如果启用了 autoCleanup）
```

## 示例服务

### 文件系统服务

```typescript
import { FileSystemService } from '@termlnk/electron';

const fsService = new FileSystemService();

// 读写文件
await fsService.readFile('/path/to/file.txt');
await fsService.writeFile('/path/to/file.txt', 'content');

// 目录操作
const files = await fsService.readDir('/path/to/dir');
await fsService.createDir('/path/to/new-dir');

// 监听文件变化
fsService.watchFile$('/path/to/file.txt').subscribe((content) => {
  console.log('File content:', content);
});
```

### 窗口管理服务

```typescript
import { WindowManagerService } from '@termlnk/electron';

const windowService = new WindowManagerService();

// 创建窗口
const windowId = await windowService.createWindow({
  title: 'New Window',
  width: 800,
  height: 600,
});

// 窗口操作
await windowService.showWindow(windowId);
await windowService.hideWindow(windowId);
await windowService.maximizeWindow(windowId);
await windowService.closeWindow(windowId);

// 监听窗口状态
windowService.getWindowState$(windowId).subscribe((state) => {
  console.log('Window state:', state);
});
```

### 系统信息服务

```typescript
import { SystemInfoService } from '@termlnk/electron';

const systemService = new SystemInfoService();

// 获取系统信息
const systemInfo = await systemService.getSystemInfo();
console.log('Platform:', systemInfo.platform);
console.log('Total memory:', systemInfo.totalMemory);

// 获取应用信息
const appInfo = await systemService.getAppInfo();
console.log('App version:', appInfo.version);
console.log('Electron version:', appInfo.electronVersion);

// 监听 CPU 使用率
systemService.getCPUUsage$(1000).subscribe((usage) => {
  console.log('CPU usage:', usage.total, '%');
});

// 监听内存使用情况
systemService.getMemoryInfo$(1000).subscribe((memInfo) => {
  console.log('Memory used:', memInfo.usedPercent, '%');
});
```

## 自定义服务

### 创建自定义服务

```typescript
// main/services/custom.service.ts
import { Observable } from 'rxjs';

export class CustomService {
  // 普通异步方法
  async getData(id: string): Promise<any> {
    return { id, data: 'some data' };
  }

  // 事件流方法（以 $ 结尾）
  watchData$(id: string): Observable<any> {
    return new Observable((subscriber) => {
      // 发送数据
      subscriber.next({ id, value: 1 });

      // 模拟定时更新
      const timer = setInterval(() => {
        subscriber.next({ id, value: Math.random() });
      }, 1000);

      // 清理函数
      return () => clearInterval(timer);
    });
  }
}
```

### 注册自定义服务

```typescript
// main/index.ts
import { fromModule } from '@termlnk/rpc';
import { CustomService } from './services/custom.service';

const customService = new CustomService();
rpcService.registerChannel('custom', fromModule(customService));
```

### 在渲染进程中使用

```typescript
// renderer/main.tsx
import { toModule } from '@termlnk/rpc';
import type { CustomService } from '../main/services/custom.service';

const customChannel = rpcService.requestChannel('custom');
const customService = toModule<CustomService>(customChannel);

// 调用方法
const data = await customService.getData('123');

// 订阅事件流
customService.watchData$('123').subscribe((data) => {
  console.log('Data updated:', data);
});
```

## API 参考

### ElectronIPCServerPlugin

主进程端插件，用于创建 RPC Server。

**配置选项：**

```typescript
interface IElectronIPCServerConfig {
  target?: BrowserWindow | WebContents;
}
```

**使用示例：**

```typescript
core.registerPlugin(ElectronIPCServerPlugin, {
  target: mainWindow,
});
```

### ElectronIPCClientPlugin

渲染进程端插件，用于创建 RPC Client。

**使用示例：**

```typescript
core.registerPlugin(ElectronIPCClientPlugin);
```

### WindowRPCManager

多窗口 RPC 管理器。

**方法：**

- `registerWindow(window: BrowserWindow)`: 注册窗口
- `unregisterWindow(windowId: number)`: 注销窗口
- `registerChannel(windowId, channelName, channel)`: 为特定窗口注册 Channel
- `registerChannelForAllWindows(channelName, channel)`: 为所有窗口注册 Channel
- `registerModuleForAllWindows(channelName, module)`: 为所有窗口注册服务模块
- `dispose()`: 清理所有窗口连接

### exposeIPCBridge()

在 preload 脚本中暴露 IPC 桥接 API。

**使用示例：**

```typescript
// preload/index.ts
import { exposeIPCBridge } from '@termlnk/electron';

exposeIPCBridge();
```

## 注意事项

1. **安全性**: 必须在 preload 脚本中使用 `exposeIPCBridge()` 来安全地暴露 IPC API
2. **上下文隔离**: 确保在 BrowserWindow 中启用 `contextIsolation: true`
3. **Node 集成**: 建议禁用 `nodeIntegration`，通过 RPC 访问 Node.js 功能
4. **事件流命名**: 以 `$` 结尾的方法会被识别为事件源（Observable）
5. **窗口生命周期**: 使用 `WindowRPCManager` 时，窗口关闭会自动清理连接

## 与 Web Worker RPC 的对比

|                | Electron IPC RPC              | Web Worker RPC           |
| -------------- | ----------------------------- | ------------------------ |
| **通信方式**   | ipcMain / ipcRenderer         | postMessage              |
| **使用场景**   | Electron 主进程 ↔ 渲染进程    | 浏览器主线程 ↔ Worker    |
| **安全模型**   | contextBridge + preload       | 无特殊要求               |
| **多实例支持** | 支持（多窗口）                | 支持（多 Worker）        |
| **Node.js**    | 主进程可访问                  | 不可访问                 |

## License

MIT
