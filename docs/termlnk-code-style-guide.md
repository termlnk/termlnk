# Termlnk RxJS 响应式编程代码风格与规范

> 本项目采用 **DI + RxJS + 命令模式** 的架构风格。本文档定义了核心代码风格和最佳实践，作为本项目的编码规范。

---

## 目录

1. [核心架构原则](#1-核心架构原则)
2. [依赖注入（DI）规范](#2-依赖注入di规范)
3. [RxJS 响应式编程规范](#3-rxjs-响应式编程规范)
4. [生命周期与资源释放规范](#4-生命周期与资源释放规范)
5. [服务（Service）编写规范](#5-服务service编写规范)
6. [控制器（Controller）编写规范](#6-控制器controller编写规范)
7. [插件（Plugin）编写规范](#7-插件plugin编写规范)
8. [命令系统规范](#8-命令系统规范)
9. [拦截器（Interceptor）模式](#9-拦截器interceptor模式)
10. [React 组件与 Observable 集成](#10-react-组件与-observable-集成)
11. [TypeScript 类型规范](#11-typescript-类型规范)
12. [测试规范](#12-测试规范)
13. [文件组织与目录结构](#13-文件组织与目录结构)

---

## 1. 核心架构原则

### 1.1 分层架构

项目采用严格的分层架构，每层只能依赖其下层：

```
common/        → 不依赖其他层（纯工具/常量/类型）
models/        → 仅依赖 common
services/      → 依赖 common, models
commands/      → 依赖 common, models, services
controllers/   → 依赖以上所有层
views/         → 依赖以上所有层（React 组件）
```

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **DI 优先** | 所有跨模块通信必须通过依赖注入，禁止直接实例化或全局变量 |
| **响应式数据流** | 状态变化通过 RxJS Observable 传播，禁止手动回调链 |
| **命令驱动** | 所有用户交互和状态变更通过命令系统执行 |
| **接口隔离** | 对外暴露接口（`I` 前缀），隐藏实现细节 |
| **自动资源回收** | 所有资源必须通过 Disposable 机制管理，确保无泄漏 |

---

## 2. 依赖注入（DI）规范

### 2.1 接口与标识符定义

接口和 DI 标识符使用**同名常量**模式，接口名即标识符名：

```typescript
// ✅ 正确：接口与标识符同名
export interface ITerminalService {
  readonly sessions$: Observable<ITerminalSession[]>;
  createSession(config: ISessionConfig): ITerminalSession;
  closeSession(sessionId: string): void;
}

export const ITerminalService = createIdentifier<ITerminalService>('terminal.terminal.service');
```

标识符命名格式：`'<包名>.<服务名>.(service|controller)'`

```typescript
// ✅ 正确：标识符命名格式
export const ICommandService = createIdentifier<ICommandService>('core.command.service');
export const IThemeService = createIdentifier<IThemeService>('core.theme.service');
export const IHostService = createIdentifier<IHostService>('terminal.host.service');
```

### 2.2 构造函数注入

使用装饰器进行依赖注入。**Service / Controller 中注入参数标记为 `private readonly`；Plugin 类中 `_injector` 与 `_configService` 标记为 `protected readonly`**（让生命周期钩子和潜在子类访问，且与 `@termlnk/core` `Plugin` 基类成员可见性对齐）：

```typescript
// ✅ Service / Controller：所有注入参数 private readonly
export class TerminalSessionService extends Disposable implements ITerminalSessionService {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
    @ILogService private readonly _logService: ILogService,
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(LifecycleService) private readonly _lifecycleService: LifecycleService
  ) {
    super();
  }
}

// ✅ Plugin：_injector / _configService 用 protected readonly
@DependentOn(UIPlugin, RPCClientPlugin)
export class TerminalUIPlugin extends Plugin {
  static override pluginName = TERMINAL_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<ITerminalUIConfig> = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService protected readonly _configService: IConfigService
  ) {
    super();
  }
}
```

注入规则：
- 接口标识符直接用作装饰器：`@ICommandService`
- 具体类使用 `@Inject()`：`@Inject(Injector)`, `@Inject(LocaleService)`
- **可选依赖**使用 `@Optional()`：`@Optional(SomeService) private readonly _maybe?: SomeService`
- Service / Controller 注入参数：**`private readonly`** + `_` 前缀
- Plugin 类的 `_injector`、`_configService`：**`protected readonly`** + `_` 前缀
- 业务字段如 `_config`：保持 `private readonly`

### 2.3 `@Optional` 装饰器 — 可选依赖

注入可能不存在的依赖时使用 `@Optional()`。若依赖未注册，参数为 `undefined`，不会抛错：

```typescript
import { Optional } from '@termlnk/core';

export class SyncController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
    @Optional(DataSyncPrimaryController)
    private readonly _dataSyncPrimaryController?: DataSyncPrimaryController
  ) {
    super();

    // 使用前判空，或用可选链
    this._dataSyncPrimaryController?.registerSyncingMutations(SaveMutation);
  }
}
```

> 标准依赖用 `@Inject(X)`，可选依赖用 `@Optional(X)`，接口标识符直接 `@IXxxService`。三者不可混用。

### 2.4 服务注册

```typescript
// 接口到实现的映射
[ITerminalService, { useClass: TerminalService }]

// 直接注册类（控制器等需要立即实例化的）
[TerminalController]

// 工厂模式
[IServiceId, { useFactory: (accessor: IAccessor) => new ServiceImpl(accessor.get(IDep)) }]

// 值注册
[IToken, { useValue: someValue }]
```

---

## 3. RxJS 响应式编程规范

### 3.1 Observable 命名约定（核心规则）

**所有 Observable 属性必须以 `$` 后缀结尾**，这是本项目最重要的命名规则之一：

```typescript
// ✅ 正确：$ 后缀
private readonly _sessions$ = new BehaviorSubject<ISession[]>([]);
readonly sessions$ = this._sessions$.asObservable();

private readonly _activeSession$ = new BehaviorSubject<Nullable<ISession>>(null);
readonly activeSession$ = this._activeSession$.asObservable();

private readonly _sessionCreated$ = new Subject<ISession>();
readonly sessionCreated$ = this._sessionCreated$.asObservable();

// ❌ 错误：缺少 $ 后缀
private readonly _sessions = new BehaviorSubject<ISession[]>([]);
readonly sessions = this._sessions.asObservable();
```

### 3.2 Subject 选择规范

根据场景选择正确的 Subject 类型：

| Subject 类型 | 使用场景 | 示例 |
|-------------|---------|------|
| `BehaviorSubject<T>` | **有状态**的数据流，需要当前值和初始值 | 主题设置、当前用户、会话列表 |
| `Subject<T>` | **无状态**的事件流，只关注未来发生的事件 | 用户操作、命令执行通知、状态变更事件 |
| `ReplaySubject<T>` | 需要**重放历史值**给新订阅者 | 很少使用，特殊场景 |

```typescript
// ✅ BehaviorSubject：有当前值的状态
private readonly _darkMode$ = new BehaviorSubject<boolean>(false);
readonly darkMode$ = this._darkMode$.asObservable();

// 同步获取当前值
get darkMode(): boolean {
  return this._darkMode$.getValue();
}

// ✅ Subject：纯事件流
private readonly _sessionCreated$ = new Subject<ISession>();
readonly sessionCreated$ = this._sessionCreated$.asObservable();

// ✅ Subject：状态变更通知（不关心历史值）
private readonly _configChanged$ = new Subject<{ [key: string]: unknown }>();
readonly configChanged$ = this._configChanged$.asObservable();
```

### 3.3 Subject 封装原则（必须遵守）

**私有 Subject，公开 Observable** —— 这是防止外部代码直接发射值的关键模式：

```typescript
export class ThemeService extends Disposable {
  // ✅ 正确：私有 Subject + 公开 Observable
  private readonly _currentTheme$ = new BehaviorSubject<Theme>(defaultTheme);
  readonly currentTheme$: Observable<Theme> = this._currentTheme$.asObservable();

  // 只能通过方法修改
  setTheme(theme: Theme): void {
    this._currentTheme$.next(theme);
  }
}

// ❌ 错误：直接暴露 Subject
export class ThemeService extends Disposable {
  readonly currentTheme$ = new BehaviorSubject<Theme>(defaultTheme);
  // 外部可以直接 currentTheme$.next(xxx)，破坏封装
}
```

### 3.4 接口中声明 Observable

在服务接口中，Observable 属性必须标记为 `readonly`，且类型为 `Observable<T>`（不是 `Subject<T>`）：

```typescript
export interface IThemeService {
  // ✅ 正确：接口中用 Observable 类型
  readonly currentTheme$: Observable<Theme>;
  readonly darkMode$: Observable<boolean>;

  setTheme(theme: Theme): void;
  setDarkMode(darkMode: boolean): void;
}

// ❌ 错误：接口中暴露 Subject 类型
export interface IThemeService {
  readonly currentTheme$: BehaviorSubject<Theme>;
}
```

### 3.5 动态 Observable 创建

对于按 key 订阅特定值的场景：

```typescript
export class ConfigService extends Disposable implements IConfigService {
  private readonly _configChanged$ = new Subject<{ [key: string]: unknown }>();
  readonly configChanged$: Observable<{ [key: string]: unknown }> = this._configChanged$.asObservable();
  private readonly _config = new Map<string, any>();

  // ✅ 创建特定 key 的 Observable
  subscribeConfigValue$<T = unknown>(key: string): Observable<T> {
    return new Observable<T>((observer) => {
      // 先发射当前值（如果存在）
      if (this._config.has(key)) {
        observer.next(this._config.get(key) as T);
      }

      // 订阅后续变化
      const sub = this._configChanged$.pipe(
        filter((c) => key in c)
      ).subscribe((c) => observer.next(c[key] as T));

      return () => sub.unsubscribe();
    });
  }
}
```

### 3.6 常用 RxJS 操作符与模式

#### 组合多个 Observable

```typescript
// ✅ combineLatest：当任意一个 Observable 发射时重新计算
this.disposeWithMe(
  combineLatest([
    this._menuService.menuChanged$.pipe(startWith(undefined)),
    this._instanceService.focused$.pipe(startWith(undefined)),
  ]).subscribe(() => {
    this._updateRibbon();
  })
);
```

#### 切换数据源（switchMap）

```typescript
// ✅ switchMap：当外层 Observable 发射时，自动取消订阅前一个内层
this.selectionChanged$ = this._currentWorkbook$.pipe(
  switchMap((workbook) =>
    !workbook ? of([]) : this._getWorkbookSelection(workbook.id).selectionChanged$
  ),
  distinctUntilChanged((prev, curr) => isEqual(prev, curr)),
  skip(1),
).pipe(takeUntil(this.dispose$));
```

#### 合并事件流

```typescript
// ✅ merge：合并多个同类型事件流
this.selectionChanged$ = merge(
  this._selectionMoveEnd$,
  this._selectionSet$,
);
```

#### 防抖与节流

```typescript
// ✅ debounceTime：用户输入场景
this._searchInput$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
).subscribe((keyword) => this._performSearch(keyword));

// ✅ bufferDebounceTime（自定义）：批量收集后统一处理
this._cellUpdates$.pipe(
  bufferDebounceTime(100),
).subscribe((updates) => this._batchUpdate(updates));
```

### 3.7 自定义 RxJS 工具函数

项目中应提供并复用以下自定义工具：

```typescript
/**
 * 将回调函数转换为 Observable，自动管理 Disposable 生命周期
 */
export function fromCallback<T extends readonly unknown[]>(
  callback: (handler: (...args: T) => void) => IDisposable | undefined
): Observable<T> {
  return new Observable((subscriber) => {
    const disposable = callback((...args: T) => subscriber.next(args));
    return () => disposable?.dispose();
  });
}

/**
 * 在条件满足后完成 Observable（包含满足条件的那个值）
 */
export function takeAfter<T>(predicate: (value: T) => boolean) {
  return (source: Observable<T>) =>
    new Observable<T>((subscriber) => {
      source.subscribe({
        next: (v) => {
          subscriber.next(v);
          if (predicate(v)) {
            subscriber.complete();
          }
        },
        complete: () => subscriber.complete(),
        error: (err) => subscriber.error(err),
      });
    });
}

/**
 * 缓冲并在指定防抖时间后发射数组
 */
export function bufferDebounceTime<T>(time: number) {
  return (source: Observable<T>) =>
    source.pipe(
      buffer(source.pipe(debounceTime(time)))
    );
}
```

### 3.8 高级 Observable 组合模式

#### shareReplay — 多播并缓存最新值

当一个 Observable 被多处订阅时，使用 `shareReplay(1)` 避免重复计算并共享最新值：

```typescript
// ✅ 正确：多处订阅同一个数据源
const currentWorkbook$ = this._instanceService
  .getCurrentTypeOfUnit$(UnitType.TERMINAL)
  .pipe(shareReplay(1), takeUntil(this.dispose$));

// 多个下游可以安全订阅，不会重复执行上游逻辑
this.selectionMoveStart$ = currentWorkbook$.pipe(
  switchMap((wb) => !wb ? of(null) : this._getSelection(wb.id).moveStart$)
);
this.selectionMoveEnd$ = currentWorkbook$.pipe(
  switchMap((wb) => !wb ? of(null) : this._getSelection(wb.id).moveEnd$)
);
```

`share()` vs `shareReplay(1)` 的选择：
- `shareReplay(1)`：新订阅者**立刻收到**最后一个值（适合状态流）
- `share()`：新订阅者**不会收到**历史值（适合事件流，如 WebSocket 消息）

#### 复杂 switchMap 组合 — 动态数据源切换

当需要根据外层上下文切换内层数据源时，使用嵌套的 switchMap + merge：

```typescript
// ✅ 聚合所有 workbook 的事件流
protected _init(): void {
  const allWorkbooks$ = this._getAliveWorkbooks$().pipe(takeUntil(this.dispose$));

  // 合并所有 workbook 的同类事件流
  this.selectionMoveStart$ = allWorkbooks$.pipe(
    switchMap((workbooks) => merge(...workbooks.map((wb) => wb.selectionMoveStart$)))
  );
}

// 动态跟踪 workbook 的增删
private _getAliveWorkbooks$(): Observable<WorkbookSelectionModel[]> {
  const workbooks$ = new BehaviorSubject(this._getInitialWorkbooks());

  this.disposeWithMe(
    this._instanceService.getTypeOfUnitAdded$(UnitType.TERMINAL)
      .subscribe((wb) => workbooks$.next([...workbooks$.getValue(), wb]))
  );
  this.disposeWithMe(
    this._instanceService.getTypeOfUnitDisposed$(UnitType.TERMINAL)
      .subscribe((wb) => workbooks$.next(workbooks$.getValue().filter((w) => w !== wb)))
  );

  return workbooks$.pipe(
    map((wbs) => wbs.map((wb) => this._ensureSelection(wb.getUnitId())))
  );
}
```

#### distinctUntilChanged 深度比较

对于复杂对象数组，必须提供自定义比较函数：

```typescript
// ✅ 正确：自定义深度比较
this.selectionChanged$ = source$.pipe(
  distinctUntilChanged((prev, curr) => {
    if (prev.length !== curr.length) return false;
    if (prev.length === 0 && curr.length === 0) return true;
    return prev.every((item, index) =>
      JSON.stringify(item) === JSON.stringify(curr[index])
    );
  }),
  skip(1), // 跳过 BehaviorSubject 初始值
).pipe(takeUntil(this.dispose$));

// ❌ 错误：默认 === 比较对引用类型无效
this.selectionChanged$ = source$.pipe(distinctUntilChanged());
```

#### firstValueFrom — Observable 转 Promise

等待 Observable 发射特定值时使用（单次等待场景）：

```typescript
// ✅ 等待生命周期到达指定阶段
onStage(stage: LifecycleStages): Promise<void> {
  return firstValueFrom(this.lifecycle$.pipe(
    filter((s) => s >= stage),
    takeAfter((s) => s === stage),
    map(() => void 0),
  )).catch((err) => {
    if (err.name === 'EmptyError') {
      return Promise.reject(new LifecycleUnreachableError(stage));
    }
    return Promise.reject(err);
  });
}

// ✅ 等待初始化完成
private _whenReady(): Promise<boolean> {
  return firstValueFrom(
    this._initialized$.pipe(filter((v) => v), take(1))
  );
}
```

#### throttleTime 与 leading/trailing 控制

```typescript
// ✅ 搜索场景：立刻响应 + 500ms 后更新最新值
this._searchString$.pipe(
  throttleTime(500, undefined, { leading: true, trailing: true }),
  startWith(void 0),
)

// ✅ 渲染场景：限制 60fps
this._engine.onTransformChange$.pipe(
  throttleTime(16), // 1000/16 ≈ 60fps
).subscribe(() => this._recalculate());
```

### 3.9 EventSubject — 带优先级的事件系统

对于需要优先级控制和事件拦截的场景，使用 EventSubject：

```typescript
export class EventSubject<T> extends Subject<[T, EventState]> {
  private _sortedObservers: IEventObserver<T>[] = [];

  /** 带优先级的订阅（数字越小优先级越高，先执行） */
  subscribeEvent(observer: IEventObserver<T>): Subscription {
    // ... 按优先级排序
  }

  /** 发射事件，支持阻止后续观察者 */
  emitEvent(event: T): INotifyObserversReturn {
    const state = new EventState();
    for (const observer of this._sortedObservers) {
      observer.next?.([event, state]);
      if (state.skipNextObservers) {
        return { handled: true, lastReturnValue: state.lastReturnValue, stopPropagation: true };
      }
    }
    return { handled: this._sortedObservers.length > 0, lastReturnValue: state.lastReturnValue };
  }
}

// 将 EventSubject 转为普通 Observable
export function fromEventSubject<T>(subject$: EventSubject<T>): Observable<T> {
  return new Observable((subscriber) => {
    const sub = subject$.subscribeEvent((evt) => subscriber.next(evt));
    return () => sub.unsubscribe();
  });
}
```

### 3.10 操作符选择指南

| 场景 | 操作符 | 说明 |
|------|--------|------|
| 切换数据源（取消前一个） | `switchMap` | 最常用：用户切换 tab/workbook |
| 顺序执行（排队） | `concatMap` | HTTP 请求需要保序 |
| 忽略新值直到前一个完成 | `exhaustMap` | 防止重复提交 |
| 合并多个状态源 | `combineLatest` | 所有源都必须发射后才开始 |
| 合并多个事件流 | `merge` | 任一源发射即发射 |
| 提供初始值 | `startWith` | 配合 combineLatest 避免阻塞 |
| 防抖 | `debounceTime` | 用户输入、搜索 |
| 节流 | `throttleTime` | 渲染更新、滚动事件 |
| 去重 | `distinctUntilChanged` | 避免不必要的重渲染 |
| 跳过初始值 | `skip(1)` | BehaviorSubject 初始值不需要时 |
| 缓存并共享 | `shareReplay(1)` | 多处订阅同一源 |
| Observable → Promise | `firstValueFrom` | 等待单次值 |
| 回调 → Observable | `fromCallback` | 适配旧 API |

---

## 4. 生命周期与资源释放规范

### 4.1 Disposable 体系

`@termlnk/core` 提供四层 Disposable 基类，根据需要选择：

| 基类 | 用途 | 特性 |
|-----|------|------|
| `Disposable` | **首选** 通用基类 | `disposeWithMe()` 管理子资源 |
| `RxDisposable` | 多个流需要 `takeUntil(dispose$)` 短路时 | 继承 Disposable，多一个 `protected dispose$ = new Subject<void>()` |
| `RCDisposable` | 引用计数共享资源 | `inc()/dec()` 管理引用，归零时释放根资源 |
| `DisposableCollection` | 批量管理多个 disposable | 集合式接口 |

**默认选 `Disposable`。** 实际项目里绝大多数 Service 和 Controller 都用 `Disposable` + `disposeWithMe(observable$.subscribe(...))` 模式即可。`RxDisposable` 只在需要在 pipe 中通过 `takeUntil(this.dispose$)` 同时短路多条流时才有价值。

### 4.2 Disposable 基类

```typescript
export class Disposable implements IDisposable {
  protected _disposed = false;
  private readonly _collection = new DisposableCollection();

  /** 注册子资源，随本对象一起销毁 */
  disposeWithMe(disposable: DisposableLike): IDisposable {
    return this._collection.add(disposable);
  }

  /** 确保对象未被销毁，已销毁则抛出异常 */
  protected ensureNotDisposed(): void {
    if (this._disposed) {
      throw new Error('[Disposable]: object is disposed!');
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._collection.dispose();
  }
}
```

### 4.3 RxDisposable 基类

用于需要通过 `takeUntil(this.dispose$)` 自动取消订阅的场景：

```typescript
export class RxDisposable extends Disposable {
  protected readonly dispose$ = new Subject<void>();

  override dispose(): void {
    super.dispose();
    this.dispose$.next();
    this.dispose$.complete();
  }
}
```

### 4.4 DisposableLike 与 toDisposable

`disposeWithMe()` 接受 `DisposableLike`，**包括函数、RxJS Subscription 和 IDisposable**，无需 `toDisposable()` 包装：

```typescript
// ✅ RxJS Subscription 直接传入
this.disposeWithMe(someObservable$.subscribe(handler));

// ✅ 回调函数直接传入（用于清理 DOM 事件、定时器等）
this.disposeWithMe(() => {
  element.removeEventListener('click', handler);
});

// ✅ 已有 IDisposable
this.disposeWithMe(someService.registerCommand(command));
```

仅当需要把 `DisposableLike` **显式转换**为 `IDisposable`（如函数返回值类型要求）时，使用 `toDisposable()`：

```typescript
// ✅ 函数返回值类型是 IDisposable 时
function registerHandler(observable$: Observable<unknown>): IDisposable {
  return toDisposable(observable$.subscribe(handler));
}

// ✅ 也可以用 toDisposable 显式包装回调，让意图更清晰
this.disposeWithMe(toDisposable(() => this._cache.clear()));
```

> 历史代码中 `disposeWithMe(toDisposable(() => ...))` 包装风格仍然合法；新代码倾向于直接 `disposeWithMe(() => ...)`。

### 4.5 RCDisposable — 引用计数

`RCDisposable` 用于多个消费方共享同一个底层资源，引用归零时统一释放：

```typescript
import { RCDisposable } from '@termlnk/core';

const shared = new RCDisposable(rootResource);
shared.inc(); // 引用 +1，第一次 inc 不重复创建
shared.inc(); // 引用 +1
shared.dec(); // 引用 -1
shared.dec(); // 引用 -1 → 归零，自动 dispose 内部 rootResource
```

适用场景：终端会话池、共享 WebSocket、共享 PTY 等。

### 4.6 订阅清理规范（必须遵守）

**所有 Observable 订阅都必须被清理**。

#### 默认模式：`disposeWithMe(observable$.subscribe(...))`

绝大多数场景用这个，Service / Controller / Plugin 都适用：

```typescript
export class MyService extends Disposable {
  constructor(@IThemeService private readonly _themeService: IThemeService) {
    super();

    this.disposeWithMe(
      this._themeService.currentTheme$.subscribe((theme) => {
        this._applyTheme(theme);
      })
    );
  }
}
```

#### 进阶模式：`RxDisposable + takeUntil(this.dispose$)`

**仅在 pipe 内需要同时短路多条流时使用**。例如 `merge()` / `switchMap` 组合需要在 dispose 时整体停下，用 `takeUntil` 表达更清晰：

```typescript
export class CFRenderController extends RxDisposable {
  private _initSkeleton(): void {
    this.disposeWithMe(
      merge(this._rule$, this._viewModel.markDirty$).pipe(
        bufferTime(16),
        filter((v) => v.length > 0),
        takeUntil(this.dispose$),
      ).subscribe(() => this._markDirty())
    );
  }
}
```

> 单一 Observable 订阅不要用 `takeUntil`，直接 `disposeWithMe(...subscribe(...))` 更直接。

### 4.7 Subject 完成规范

**在 `dispose()` 中必须 `complete()` 所有 Subject**：

```typescript
export class UserService extends Disposable {
  private readonly _currentUser$ = new BehaviorSubject<IUser>(defaultUser);
  private readonly _userChanged$ = new Subject<{ type: string; user: IUser }>();

  override dispose(): void {
    super.dispose();
    // ✅ 必须 complete 所有 Subject
    this._currentUser$.complete();
    this._userChanged$.complete();
  }
}
```

或者通过 `disposeWithMe` 统一管理：

```typescript
export class ThemeService extends Disposable {
  private readonly _currentTheme$ = new BehaviorSubject<Theme>(defaultTheme);
  readonly currentTheme$ = this._currentTheme$.asObservable();

  constructor() {
    super();
    // ✅ 通过 disposeWithMe 注册清理逻辑
    this.disposeWithMe(toDisposable(() => {
      this._currentTheme$.complete();
    }));
  }
}
```

---

## 5. 服务（Service）编写规范

### 5.1 完整服务模板

```typescript
import { createIdentifier } from '@termlnk/core/common/di';
import { Disposable, toDisposable } from '@termlnk/core/shared/lifecycle';
import type { Observable } from 'rxjs';
import { BehaviorSubject, Subject } from 'rxjs';

// ===== 1. 定义接口 =====
export interface ISessionService {
  /** 当前所有会话列表 */
  readonly sessions$: Observable<ISession[]>;
  /** 会话创建事件 */
  readonly sessionCreated$: Observable<ISession>;
  /** 当前活动会话 */
  readonly activeSession$: Observable<Nullable<ISession>>;

  /** 获取当前活动会话（同步） */
  get activeSession(): Nullable<ISession>;

  createSession(config: ISessionConfig): ISession;
  closeSession(sessionId: string): boolean;
  setActiveSession(sessionId: string): void;
}

// ===== 2. 创建 DI 标识符 =====
export const ISessionService = createIdentifier<ISessionService>('terminal.session.service');

// ===== 3. 实现服务 =====
export class SessionService extends Disposable implements ISessionService {
  // ----- 3a. 私有 Subject（_ 前缀 + $ 后缀）-----
  private readonly _sessions$ = new BehaviorSubject<ISession[]>([]);
  private readonly _sessionCreated$ = new Subject<ISession>();
  private readonly _activeSession$ = new BehaviorSubject<Nullable<ISession>>(null);

  // ----- 3b. 公开 Observable（$ 后缀，asObservable）-----
  readonly sessions$: Observable<ISession[]> = this._sessions$.asObservable();
  readonly sessionCreated$: Observable<ISession> = this._sessionCreated$.asObservable();
  readonly activeSession$: Observable<Nullable<ISession>> = this._activeSession$.asObservable();

  // ----- 3c. 私有状态 -----
  private readonly _sessionMap = new Map<string, ISession>();

  // ----- 3d. 同步 getter -----
  get activeSession(): Nullable<ISession> {
    return this._activeSession$.getValue();
  }

  // ----- 3e. 构造函数注入 -----
  constructor(
    @ILogService private readonly _logService: ILogService,
    @ICommandService private readonly _commandService: ICommandService
  ) {
    super();
  }

  // ----- 3f. 公开方法 -----
  createSession(config: ISessionConfig): ISession {
    this.ensureNotDisposed();

    const session = new TerminalSession(config);
    this._sessionMap.set(session.id, session);
    this._sessions$.next([...this._sessionMap.values()]);
    this._sessionCreated$.next(session);

    this._logService.info('[SessionService]', `Session created: ${session.id}`);
    return session;
  }

  closeSession(sessionId: string): boolean {
    const session = this._sessionMap.get(sessionId);
    if (!session) return false;

    session.dispose();
    this._sessionMap.delete(sessionId);
    this._sessions$.next([...this._sessionMap.values()]);

    return true;
  }

  setActiveSession(sessionId: string): void {
    const session = this._sessionMap.get(sessionId);
    this._activeSession$.next(session ?? null);
  }

  // ----- 3g. dispose：清理所有资源 -----
  override dispose(): void {
    super.dispose();

    // 清理所有 Subject
    this._sessions$.complete();
    this._sessionCreated$.complete();
    this._activeSession$.complete();

    // 清理业务资源
    this._sessionMap.forEach((session) => session.dispose());
    this._sessionMap.clear();
  }
}
```

### 5.2 服务编写检查清单

- [ ] 接口与标识符同名，接口以 `I` 开头
- [ ] 继承 `Disposable` 或 `RxDisposable`
- [ ] 私有 Subject 使用 `_` 前缀 + `$` 后缀
- [ ] 公开 Observable 使用 `.asObservable()` 转换
- [ ] BehaviorSubject 提供同步 getter
- [ ] `dispose()` 中 `complete()` 所有 Subject
- [ ] `dispose()` 中清理所有 Map/Set/数组等资源
- [ ] 修改操作前调用 `ensureNotDisposed()`

---

## 6. 控制器（Controller）编写规范

### 6.1 控制器职责

控制器是**协调者**，负责：
- 注册命令、快捷键、菜单
- 监听服务事件并协调响应
- 连接 UI 组件与服务层
- **不包含**核心业务逻辑（那是服务的职责）

### 6.2 完整控制器模板

**默认基类为 `Disposable`**（不是 `RxDisposable`）。订阅 Observable 优先使用 `disposeWithMe(observable$.subscribe(...))`，简洁直接、无需 `takeUntil` 噪音。仅当需要在 `pipe()` 中通过 `takeUntil(this.dispose$)` 同时短路多条流，或派生 Observable 的工厂返回值时，才用 `RxDisposable`。

构造函数中按业务顺序调用 `_initXxx()` 私有方法：**Commands → Shortcuts → Components → Menus → Views → Listeners**：

```typescript
export class TerminalUIController extends Disposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService,
    @IShortcutService private readonly _shortcutService: IShortcutService,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @ITerminalViewRegistry private readonly _viewRegistry: ITerminalViewRegistry
  ) {
    super();

    this._initCommands();
    this._initShortcuts();
    this._initComponents();
    this._initMenus();
    this._initViews();
    this._initListeners();
  }

  // ===== 注册命令 =====
  private _initCommands(): void {
    [
      CreateSessionCommand,
      CloseSessionCommand,
      ToggleHostDialogOperation,
    ].forEach((command) => {
      this.disposeWithMe(this._commandService.registerCommand(command));
    });
  }

  // ===== 注册快捷键 =====
  private _initShortcuts(): void {
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: CreateSessionCommand.id,
      description: 'terminal-ui.shortcuts.new-session',
      binding: KeyCode.N | MetaKeys.CTRL_COMMAND,
    }));
  }

  // ===== 注册 UI 组件（ComponentManager 全局注册 + UIPartsService 嵌入位置） =====
  private _initComponents(): void {
    this.disposeWithMe(this._componentManagerService.register(IconKey, IconComponent));
    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.CONTENT,
        () => connectInjector(TerminalContainer, this._injector))
    );
  }

  // ===== 注册菜单 schema =====
  private _initMenus(): void {
    this._menuManagerService.mergeMenu(menuSchema);
  }

  // ===== 注册视图类型 =====
  private _initViews(): void {
    this.disposeWithMe(this._viewRegistry.registerView('ssh', TerminalView));
    this.disposeWithMe(this._viewRegistry.registerView('local', LocalTerminalView));
  }

  // ===== 订阅服务事件 =====
  private _initListeners(): void {
    // ✅ 默认模式：disposeWithMe(observable$.subscribe(...))
    this.disposeWithMe(
      this._terminalService.sessionCreated$.subscribe((session) => {
        this._handleSessionCreated(session);
      })
    );

    this.disposeWithMe(
      this._terminalService.activeSession$.subscribe((session) => {
        this._handleActiveSessionChanged(session);
      })
    );
  }

  private _handleSessionCreated(session: ISession): void {
    // ...
  }

  private _handleActiveSessionChanged(session: Nullable<ISession>): void {
    // ...
  }
}
```

**何时改用 `RxDisposable`** — 当一条 pipe 内需要 `takeUntil(this.dispose$)` 提前终止时：

```typescript
export class CFRenderController extends RxDisposable {
  private _initSkeleton(): void {
    this.disposeWithMe(
      merge(this._rule$, this._viewModel.markDirty$).pipe(
        bufferTime(16),
        filter((v) => v.length > 0),
        takeUntil(this.dispose$),     // ← pipe 内短路才用 RxDisposable
      ).subscribe(() => this._markDirty())
    );
  }
}
```

### 6.3 命令执行监听模式

控制器通过监听命令执行来响应状态变化，这是本架构中**最核心的控制器模式**：

```typescript
export class StatusBarController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
    @Inject(SelectionService) private readonly _selectionService: SelectionService,
    @IStatusBarService private readonly _statusBarService: IStatusBarService
  ) {
    super();
    this._initListeners();
  }

  private _initListeners(): void {
    // ✅ 监听特定命令执行后更新 UI
    this.disposeWithMe(
      this._commandService.onCommandExecuted((commandInfo: ICommandInfo) => {
        if (commandInfo.id === SetRangeValuesMutation.id) {
          this._recalculateStatistics();
        }
      })
    );

    // ✅ 监听选区变化
    this.disposeWithMe(
      this._selectionService.selectionMoveEnd$.subscribe((selections) => {
        if (selections) {
          this._recalculateStatistics();
        }
      })
    );
  }
}
```

**命令监听 vs Observable 订阅** 的选择：

| 场景 | 方式 | 说明 |
|------|------|------|
| 响应数据变更 | `onCommandExecuted` | 监听 Mutation 执行后触发副作用 |
| 拦截/验证 | `beforeCommandExecuted` | 在命令执行前进行校验 |
| 响应状态流变化 | Observable 订阅 | 监听服务暴露的 Observable |

### 6.4 派生状态模式（deriveStateFromActiveUnit$）

从当前活动的上下文派生 Observable 状态，这是 UI 状态管理的**关键模式**：

```typescript
// ✅ 工具函数：从活动 unit 派生 Observable 状态
function deriveStateFromActiveUnit$<T>(
  instanceService: IInstanceService,
  defaultValue: T,
  callback: (active: { unit: UnitModel }) => Observable<T>
): Observable<T> {
  return instanceService.getCurrentTypeOfUnit$(UnitType.TERMINAL).pipe(
    switchMap((unit) =>
      unit
        ? callback({ unit })
        : of(defaultValue)
    ),
  );
}

// ✅ 使用：菜单项的 activated$ 状态
function BoldMenuItemFactory(accessor: IAccessor): IMenuButtonItem {
  const commandService = accessor.get(ICommandService);
  const instanceService = accessor.get(IInstanceService);

  return {
    id: SetBoldCommand.id,
    type: MenuItemType.BUTTON,
    icon: 'BoldIcon',
    // activated$ 会根据当前上下文自动更新
    activated$: deriveStateFromActiveUnit$(
      instanceService,
      false,
      ({ unit }) => new Observable<boolean>((subscriber) => {
        const update = () => {
          // 根据当前 unit 状态计算激活状态
          subscriber.next(/* ... */);
        };

        // 监听命令执行触发更新
        const disposable = commandService.onCommandExecuted((c) => {
          if (RELEVANT_COMMANDS.includes(c.id)) {
            update();
          }
        });

        update(); // 初始值
        return () => disposable.dispose();
      })
    ),
  };
}
```

### 6.5 菜单项 Observable 状态模式

菜单项通过 Observable 暴露动态状态（`disabled$`、`hidden$`、`activated$`、`value$`），UI 层自动订阅：

```typescript
export interface IMenuButtonItem {
  id: string;
  type: MenuItemType;
  disabled$?: Observable<boolean>;   // 禁用状态
  hidden$?: Observable<boolean>;     // 隐藏状态
  activated$?: Observable<boolean>;  // 激活状态（如粗体按钮高亮）
  icon?: string | Observable<string>;
}

export interface IMenuSelectorItem<V = string> {
  id: string;
  type: MenuItemType;
  disabled$?: Observable<boolean>;
  hidden$?: Observable<boolean>;
  value$?: Observable<V>;            // 当前选中值（如字体名称）
  selections?: Array<IValueOption> | Observable<Array<IValueOption>>;
}

// ✅ 隐藏状态工具函数
export function getMenuHiddenObservable(
  accessor: IAccessor,
  targetType: UnitType
): Observable<boolean> {
  const instanceService = accessor.get(IInstanceService);

  return new Observable((subscriber) => {
    const sub = instanceService.focused$.subscribe((unitId) => {
      if (!unitId) return subscriber.next(true);
      const type = instanceService.getUnitType(unitId);
      subscriber.next(type !== targetType);
    });

    // 发射初始值
    const focused = instanceService.getFocusedUnit();
    subscriber.next(!focused || instanceService.getUnitType(focused.getUnitId()) !== targetType);

    return () => sub.unsubscribe();
  });
}
```

### 6.6 菜单 Schema 模式 — `mergeMenu(menuSchema)`

菜单**不是**散落在 controller 内逐条 `addMenuItem`，而是集中在 `controllers/menu.schema.ts` 内声明 schema，由 controller 通过 `_menuManagerService.mergeMenu(menuSchema)` 一次注册：

```typescript
// controllers/menu.schema.ts
import type { MenuSchemaType } from '@termlnk/ui';
import { ContextMenuPosition, RibbonStartGroup } from '@termlnk/ui';

export const menuSchema: MenuSchemaType = {
  [RibbonStartGroup.OTHERS]: {
    [ToggleHostDialogOperation.id]: {
      order: 0,
      menuItemFactory: ToggleHostDialogMenuItemFactory,
    },
  },
  [ContextMenuPosition.MAIN_AREA]: {
    [CloseSessionCommand.id]: {
      order: 10,
      menuItemFactory: CloseSessionMenuItemFactory,
    },
  },
};
```

```typescript
// controllers/terminal-ui.controller.ts
private _initMenus(): void {
  this._menuManagerService.mergeMenu(menuSchema);
}
```

> 单文件集中声明优势：菜单结构一眼可见、order 冲突易发现、不需要 disposeWithMe 包装（schema 注入是一次性的）。

---

## 7. 插件（Plugin）编写规范

### 7.1 插件结构

```typescript
import type { Dependency } from '@termlnk/core';
import type { ITerminalUIConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { UIPlugin } from '@termlnk/ui';
import { defaultPluginConfig, TERMINAL_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';

export const TERMINAL_UI_PLUGIN_NAME = 'TERMINAL_UI_PLUGIN';

@DependentOn(UIPlugin, RPCClientPlugin)
export class TerminalUIPlugin extends Plugin {
  static override pluginName = TERMINAL_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<ITerminalUIConfig> = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService protected readonly _configService: IConfigService
  ) {
    super();

    // Deep merge with lodash `merge` — defaults must NOT be overwritten by nested config.
    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(TERMINAL_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    registerDependencies(
      this._injector,
      mergeOverrideWithDependencies(
        [
          // services
          [IHostExplorerService, { useClass: HostExplorerService }],
          [ITerminalUIService, { useClass: TerminalUIService }],

          // controllers
          [HostDialogController],
          [TerminalUIController],
        ] as Dependency[],
        this._config.override
      )
    );
  }

  override onReady(): void {
    // services 就绪后，可注册拦截器、订阅命令执行等
  }

  override onRendered(): void {
    // UI 渲染后触发控制器实例化（让控制器能立即注册组件）
    touchDependencies(this._injector, [
      [HostDialogController],
      [TerminalUIController],
    ]);
  }

  override onSteady(): void {
    // 重型 / 非关键控制器延迟激活
    touchDependencies(this._injector, [
      [TerminalPersistenceController],
    ]);
  }
}
```

### 7.2 关键工具与装饰器

| API | 来源 | 用途 |
|-----|------|------|
| `@DependentOn(P1, P2, ...)` | `@termlnk/core` | 声明插件级依赖；启动时若被依赖插件未注册，会自动报错 |
| `@Inject(X)` | `@termlnk/core` | 注入具体类（非接口标识符） |
| `@Optional(X)` | `@termlnk/core` | 注入可选依赖，未注册时为 `undefined` |
| `merge(...)` | `@termlnk/core`（来自 `lodash-es`） | 深合并配置，避免嵌套对象被浅 spread 覆盖 |
| `registerDependencies(injector, deps)` | `@termlnk/core` | 批量注册依赖（语义化封装 `deps.forEach(d => injector.add(d))`） |
| `touchDependencies(injector, deps)` | `@termlnk/core` | 批量触发实例化（用于 controller 等需要立即激活的类） |
| `mergeOverrideWithDependencies(deps, override)` | `@termlnk/core` | 配合 `_config.override` 让上层覆盖默认服务实现 |

#### 配置合并：**必须** `merge()` 而不是 spread

```typescript
// ❌ 错误：浅 spread 会让嵌套配置整体覆盖默认值
const cfg = { ...defaultPluginConfig, ...this._config };

// ✅ 正确：lodash merge 深合并
const cfg = merge({}, defaultPluginConfig, this._config);
```

#### override 配置：让消费方替换默认实现

```typescript
// 插件接口允许传入 override
export interface ITerminalUIConfig {
  override?: DependencyOverride;
  // ...
}

// 注册时通过 mergeOverrideWithDependencies 应用
registerDependencies(this._injector, mergeOverrideWithDependencies([
  [IHostExplorerService, { useClass: HostExplorerService }],   // default
  [TerminalUIController],
], this._config.override));

// 消费方
new TerminalUIPlugin({
  override: [
    [IHostExplorerService, { useClass: CustomHostExplorerService }],  // 替换默认实现
  ],
});
```

### 7.3 生命周期钩子使用规范

| 钩子 | 时机 | 适合做什么 |
|-----|------|----------|
| `onStarting()` | 插件启动前 | 注册 DI 依赖、注册命令 |
| `onReady()` | 核心服务就绪 | 注册拦截器、订阅命令执行、初始化跨插件协作 |
| `onRendered()` | 首次渲染完成 | `touchDependencies` 激活 UI 相关控制器（让组件第一时间可见） |
| `onSteady()` | 完全稳定 | `touchDependencies` 激活重型 / 非关键控制器（持久化、统计、Agent 等） |

**典型分配**：UI 关键路径（菜单、视图注册、快捷键控制器）→ `onRendered`；后台任务、磁盘 IO、网络订阅 → `onSteady`。

### 7.4 插件配置键规范（必须遵守）

> **核心约束：每个插件只能拥有一个顶级配置键。** 运行时配置（`IConfigService`，内存）与持久化字段（`ConfigRepository`，数据库 `configEntity` 表）**共用该键**；所有持久化字段作为 subKey 声明在 `IXxxPluginConfig` 接口上，由 `ConfigRepository.getField / setField` 按字段读写。

#### 7.4.1 命名与定位

| 项目 | 规则 | 示例 |
|-----|------|------|
| Key 值 | `<plugin-name>.config` | `'electron.config'` / `'electron-main.config'` |
| 常量名 | UPPER_SNAKE_CASE + `_PLUGIN_CONFIG_KEY` | `ELECTRON_MAIN_PLUGIN_CONFIG_KEY` |
| 类型接口 | `IXxxPluginConfig`（或 `IXxxConfig`）— 聚合所有字段 | `IElectronMainConfig` |
| 文件位置 | `packages/<plugin>/src/controllers/config.schema.ts` 或 `config/config.ts` | — |

#### 7.4.2 接口定义模板

```typescript
// packages/electron-main/src/controllers/config.schema.ts
import type { DependencyOverride } from '@termlnk/core';
import type { IMainWindowState } from '../services/window-state/type';

export const ELECTRON_MAIN_PLUGIN_CONFIG_KEY = 'electron-main.config';

export interface IElectronMainConfig {
  // ── 运行时字段（由插件构造时注入，IConfigService 承载） ──
  override?: DependencyOverride;
  url?: string;       // 主窗口加载地址
  preload?: string;   // preload 脚本路径

  // ── 持久化字段（ConfigRepository 以 subKey 形式读写到 DB） ──
  mainWindowState?: IMainWindowState;
}

export const defaultPluginConfig: IElectronMainConfig = {};
```

运行时字段与持久化字段**同一个接口**声明，仅通过访问路径（`IConfigService` vs `ConfigRepository`）区分用途。

#### 7.4.3 双重访问方式

```typescript
// ① 内存运行时配置 — 插件构造时调用
this._configService.setConfig(ELECTRON_MAIN_PLUGIN_CONFIG_KEY, runtimeConfig);

// Controller 中读取运行时参数
const cfg = this._configService.getConfig<IElectronMainConfig>(ELECTRON_MAIN_PLUGIN_CONFIG_KEY);
const url = cfg?.url;

// ② 持久化字段 — 按 subKey 读写数据库
await this._configRepository.setField(
  ELECTRON_MAIN_PLUGIN_CONFIG_KEY,
  'mainWindowState',
  state
);

const stored = await this._configRepository.getField<IMainWindowState>(
  ELECTRON_MAIN_PLUGIN_CONFIG_KEY,
  'mainWindowState'
);
```

#### 7.4.4 监听外部变更

```typescript
this.disposeWithMe(
  this._configRepository.changed$.pipe(
    filter((e) => e.key === ELECTRON_MAIN_PLUGIN_CONFIG_KEY
      && (e.subKey === 'mainWindowState' || e.subKey === undefined))
  ).subscribe(() => {
    void this._onConfigChanged();
  })
);
```

`e.subKey === undefined` 覆盖整键 `set()`（如导入/重置）的场景。

#### 7.4.5 禁止事项

| 禁止 | 原因 |
|-----|------|
| ❌ 为单个持久化字段单独开顶级 key（如 `electron-main.main-window-state`） | 破坏"一插件一键"的聚合原则，导致配置分散、迁移困难 |
| ❌ 写入未在 `IXxxPluginConfig` 中声明的字段 | 丢失类型安全、上下游无法感知字段存在 |
| ❌ 跨插件直接读写他人的 config key | 越过服务边界；跨插件交互必须经 Service API |
| ❌ 在持久化字段的存取路径里使用 `set(KEY, ...)` 覆盖整键 | 会清掉其他 subKey；持久化字段必须用 `setField` |

#### 7.4.6 新增持久化字段流程

1. 在 `IXxxPluginConfig` 接口中加一个可选字段（类型须独立定义）
2. 提供 `normalizeXxx(value): IXxx` 帮助函数处理 null / 非法值回退到默认
3. 消费方（Controller/Service）通过 `ConfigRepository.getField / setField` 读写
4. 如有跨进程/跨控制器响应需求，订阅 `ConfigRepository.changed$` 并 `filter` 对应 subKey

#### 7.4.7 已落地示例

| 插件 | Config Key | 运行时字段 | 持久化字段 |
|-----|-----------|-----------|-----------|
| `@termlnk/electron` | `electron.config` | `override` | `appSettings: IAppSettings` |
| `@termlnk/electron-main` | `electron-main.config` | `url`, `preload`, `override` | `mainWindowState: IMainWindowState` |

---

## 8. 命令系统规范

### 8.1 三种命令类型

| 类型 | 用途 | 持久化 | Undo/Redo | 异步 |
|-----|------|--------|-----------|-----|
| **COMMAND** | 业务逻辑编排 | 否 | 编排 Mutation 的 Undo | 支持 |
| **MUTATION** | 持久化数据变更 | 是 | 是 | 仅同步 |
| **OPERATION** | UI 状态变更 | 否 | 否 | 支持 |

### 8.2 Operation 示例

```typescript
export const ToggleHostDialogOperation: IOperation = {
  id: 'terminal-ui.operation.toggle-host-dialog',
  type: CommandType.OPERATION,
  handler: (accessor) => {
    const dialogService = accessor.get(IDialogService);
    dialogService.toggle(HOST_DIALOG_ID);
    return true;
  },
};
```

### 8.3 Command 示例

```typescript
export interface ICreateSessionCommandParams {
  hostId: string;
  shellType?: string;
}

export const CreateSessionCommand: ICommand<ICreateSessionCommandParams> = {
  id: 'terminal.command.create-session',
  type: CommandType.COMMAND,
  handler: async (accessor, params) => {
    if (!params) return false;

    const sessionService = accessor.get(ITerminalSessionService);
    const commandService = accessor.get(ICommandService);

    const session = sessionService.createSession({
      hostId: params.hostId,
      shellType: params.shellType,
    });

    if (!session) return false;

    // 通过 Mutation 持久化
    const result = commandService.syncExecuteCommand(
      SaveSessionMutation.id,
      { sessionId: session.id, config: session.config }
    );

    return result;
  },
};
```

### 8.4 命令 ID 命名规范

格式：`<包名>.<类型>.<kebab-case-动作>`

```typescript
// ✅ 正确
'terminal-ui.command.create-session'
'terminal-ui.operation.toggle-host-dialog'
'terminal.mutation.save-session'

// ❌ 错误
'createSession'                    // 缺少前缀和类型
'terminal-ui.command.CreateSession' // 不是 kebab-case
```

---

## 9. 拦截器（Interceptor）模式

拦截器是一种**责任链模式**，允许多个模块以优先级顺序拦截和变换数据。

### 9.1 拦截器核心接口

```typescript
// 同步拦截器
export type InterceptorHandler<M = unknown, C = unknown> = (
  value: Nullable<M>,
  context: C,
  next: (value: Nullable<M>) => Nullable<M>
) => Nullable<M>;

export interface IInterceptor<M, C> {
  id?: string;
  priority?: number;       // 数字越大越先执行
  handler: InterceptorHandler<M, C>;
}

// 异步拦截器
export type AsyncInterceptorHandler<M = unknown, C = unknown> = (
  value: Nullable<M>,
  context: C,
  next: (value: Nullable<M>) => Promise<Nullable<M>>
) => Promise<Nullable<M>>;
```

### 9.2 拦截器注册与使用

```typescript
export class DataInterceptorService extends Disposable {
  private readonly _interceptorManager = new InterceptorManager({ CELL_CONTENT, ROW_FILTERED });

  constructor() {
    super();
    // ✅ 注册默认透传拦截器（最低优先级）
    this.disposeWithMe(
      this._interceptorManager.intercept(CELL_CONTENT, {
        priority: -1,
        handler: (value, _context, _next) => value,
      })
    );
  }

  // ✅ 注册拦截器（返回 IDisposable 用于清理）
  intercept<T extends IInterceptor<any, any>>(name: T, interceptor: T): IDisposable {
    return this.disposeWithMe(
      this._interceptorManager.intercept(name, interceptor)
    );
  }

  // ✅ 执行拦截器链
  fetchThroughInterceptors<T, C>(name: IInterceptor<T, C>): (value: Nullable<T>, context: C) => Nullable<T> {
    return this._interceptorManager.fetchThroughInterceptors(name);
  }
}
```

### 9.3 拦截器实际使用

```typescript
// 在插件中注册拦截器
export class ThemePlugin extends Plugin {
  override onReady(): void {
    const interceptorService = this._injector.get(DataInterceptorService);

    // ✅ 注册样式拦截器，按优先级插入链中
    this.disposeWithMe(
      interceptorService.intercept(CELL_CONTENT, {
        id: 'theme-style-interceptor',
        priority: 8,
        handler: (cell, context, next) => {
          const style = this._getThemeStyle(context.row, context.col);
          if (style) {
            const newCell = { ...cell, themeStyle: style };
            return next(newCell);  // ✅ 调用 next 传递给下一个拦截器
          }
          return next(cell);       // ✅ 无修改也要调用 next
        },
      })
    );
  }
}
```

**拦截器规则：**
- 调用 `next(value)` 将值传递给链中下一个拦截器
- 不调用 `next()` 则**短路**，中断后续拦截器
- `priority` 越大越先执行
- 禁止在同一个 handler 中多次调用 `next()`

---

## 10. React 组件与 Observable 集成

### 10.1 useObservable Hook

使用 `useObservable` 将 Observable 值绑定到 React 状态：

```typescript
import { useObservable } from '@wendellhu/redi/react-bindings';

function ThemeToggle() {
  const themeService = useDependency(IThemeService);
  const darkMode = useObservable(themeService.darkMode$, false);

  return (
    <button onClick={() => themeService.setDarkMode(!darkMode)}>
      {darkMode ? 'Light' : 'Dark'}
    </button>
  );
}
```

### 10.2 手动订阅管理

当 `useObservable` 不够灵活时，使用 `useEffect` + 手动清理：

```typescript
function SessionList() {
  const sessionService = useDependency(ISessionService);
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [active, setActive] = useState<Nullable<ISession>>(null);

  useEffect(() => {
    const subscriptions: Subscription[] = [];

    subscriptions.push(
      sessionService.sessions$.subscribe(setSessions)
    );
    subscriptions.push(
      sessionService.activeSession$.subscribe(setActive)
    );

    // ✅ 必须清理所有订阅
    return () => subscriptions.forEach((s) => s.unsubscribe());
  }, [sessionService]);

  return (/* ... */);
}
```

### 10.3 useObservableRef

当只需要读取最新值而不需要触发重渲染时：

```typescript
function PerformanceMonitor() {
  const metricsService = useDependency(IMetricsService);
  // 不会触发重渲染，只在需要时读取 ref.current
  const latestMetrics = useObservableRef(metricsService.metrics$);

  const handleExport = useCallback(() => {
    exportMetrics(latestMetrics.current);
  }, [latestMetrics]);

  return <button onClick={handleExport}>Export</button>;
}
```

### 10.4 菜单状态订阅 Hook

当组件需要订阅多个 Observable 状态时（如菜单项的 disabled/hidden/activated）：

```typescript
// ✅ 聚合菜单项的多个 Observable 状态
function useToolbarItemStatus(menuItem: IDisplayMenuItem<IMenuItem>): IToolbarItemStatus {
  const { disabled$, hidden$, activated$, value$ } = menuItem;

  const [disabled, setDisabled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [activated, setActivated] = useState(false);
  const [value, setValue] = useState<any>();

  useEffect(() => {
    const subscriptions: Subscription[] = [];

    disabled$ && subscriptions.push(disabled$.subscribe(setDisabled));
    hidden$ && subscriptions.push(hidden$.subscribe(setHidden));
    activated$ && subscriptions.push(activated$.subscribe(setActivated));
    value$ && subscriptions.push(value$.subscribe(setValue));

    return () => subscriptions.forEach((s) => s.unsubscribe());
  }, [disabled$, hidden$, activated$, value$]);

  return { disabled, hidden, activated, value };
}
```

---

## 11. TypeScript 类型规范

### 11.1 接口 vs 类型

| 使用场景 | 选择 | 示例 |
|---------|------|------|
| 对象结构定义 | `interface` | `interface ISessionConfig { ... }` |
| 联合类型 | `type` | `type SessionStatus = 'active' \| 'idle'` |
| 函数签名类型 | `type` | `type SessionCallback = (session: ISession) => void` |
| 服务接口 | `interface` | `interface ISessionService { ... }` |
| 扩展/继承 | `interface` | `interface IAdvancedConfig extends IBaseConfig { ... }` |

### 11.2 Nullable 类型

使用项目提供的 `Nullable<T>` 类型而非 `T | null | undefined`：

```typescript
// ✅ 正确
private _activeSession: Nullable<ISession> = null;
readonly activeSession$: Observable<Nullable<ISession>>;

// ❌ 错误
private _activeSession: ISession | null | undefined;
```

### 11.3 泛型参数命名

```typescript
// 常用泛型参数
T    // 主类型
U, V // 次要类型
K    // Key 类型
P    // Params 参数类型
R    // Return 返回类型
```

### 11.4 readonly 使用规范

```typescript
// ✅ 构造函数参数
constructor(
  @ILogService private readonly _logService: ILogService
) {}

// ✅ Observable 属性
readonly sessions$: Observable<ISession[]>;

// ✅ 接口中的 Observable
export interface IService {
  readonly state$: Observable<IState>;
}

// ✅ 函数参数中的数组
function processRanges(ranges: readonly IRange[]): void {}
```

### 11.5 访问修饰符

| 修饰符 | 用途 | 命名 |
|--------|------|------|
| `private` | 内部实现细节 | `_` 前缀：`_sessionMap` |
| `protected` | 子类可访问 | `_` 前缀：`protected readonly _injector` |
| `public` / 无修饰符 | 对外 API | 无前缀：`sessions$`, `createSession()` |

---

## 12. 测试规范

### 12.1 Test Bed 工厂模式

每个包提供一个 `createTestBed()` 工厂函数用于测试环境搭建：

```typescript
// ✅ packages/xxx/src/__tests__/create-test-bed.ts
export function createTestBed(dependencies?: Dependency[]) {
  const core = new Core();
  const injector = core.getInjector();
  const get = injector.get.bind(injector);

  // 通过内部 Plugin 注册测试依赖
  class TestPlugin extends Plugin {
    static override pluginName = 'test-plugin';

    constructor(
      _config: undefined,
      @Inject(Injector) override readonly _injector: Injector
    ) {
      super();
    }

    override onStarting(): void {
      dependencies?.forEach((d) => this._injector.add(d));
    }
  }

  core.registerPlugin(TestPlugin);

  return { core, get };
}
```

### 12.2 服务测试模式

使用最小化 mock 对象，只 mock 需要的方法：

```typescript
describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    const testBed = createTestBed([
      [ISessionService, { useClass: SessionService }],
    ]);
    service = testBed.get(ISessionService);
  });

  afterEach(() => {
    service.dispose();
  });

  it('should emit on sessions$ when session created', () => {
    const sessions: ISession[][] = [];
    service.sessions$.subscribe((s) => sessions.push(s));

    service.createSession({ hostId: 'h1' });
    expect(sessions).toHaveLength(2); // 初始空 + 创建后
    expect(sessions[1]).toHaveLength(1);
  });
});
```

### 12.3 Observable 测试模式

使用真实的 Subject，不使用 marble testing：

```typescript
it('should update when observable emits', () => {
  const subject = new BehaviorSubject<string>('initial');
  const values: string[] = [];

  subject.subscribe((v) => values.push(v));
  subject.next('updated');

  expect(values).toEqual(['initial', 'updated']);

  subject.complete();
});

// React Hook 测试
it('should sync observable to state', () => {
  const { result } = renderHook(() => useObservable(observable$, 'default'));

  expect(result.current).toBe('default');

  act(() => subject$.next('new value'));
  expect(result.current).toBe('new value');
});
```

### 12.4 命令测试模式

```typescript
describe('CreateSessionCommand', () => {
  let commandService: ICommandService;
  let sessionService: ISessionService;

  beforeEach(() => {
    const testBed = createTestBed([
      [ISessionService, { useClass: SessionService }],
    ]);
    commandService = testBed.get(ICommandService);
    sessionService = testBed.get(ISessionService);

    // ✅ 在 beforeEach 中注册命令
    commandService.registerCommand(CreateSessionCommand);
  });

  it('should create session via command', async () => {
    const spy = vi.spyOn(sessionService, 'createSession');

    await commandService.executeCommand(CreateSessionCommand.id, { hostId: 'h1' });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ hostId: 'h1' }));
  });
});
```

### 12.5 测试文件组织

```
packages/xxx/src/
├── services/
│   ├── session.service.ts
│   └── __tests__/
│       └── session.service.spec.ts
├── commands/
│   └── __tests__/
│       └── create-session.command.spec.ts
└── __tests__/
    └── create-test-bed.ts        # 共享测试工厂
```

---

## 13. 文件组织与目录结构

### 13.1 标准包目录

```
packages/[package-name]/src/
├── common/              # 共享工具、常量、类型（不依赖其他目录）
│   ├── const.ts
│   └── types.ts
├── models/              # 数据模型（仅依赖 common）
│   └── session.model.ts
├── services/            # 业务服务（依赖 common, models）
│   ├── session.service.ts
│   └── host.service.ts
├── commands/            # 命令定义
│   ├── commands/        # COMMAND 类型
│   │   └── create-session.command.ts
│   ├── mutations/       # MUTATION 类型
│   │   └── save-session.mutation.ts
│   └── operations/      # OPERATION 类型
│       └── toggle-dialog.operation.ts
├── controllers/         # 控制器
│   └── terminal-ui.controller.ts
├── views/               # React 组件
│   ├── components/      # 通用组件
│   │   └── SessionList.tsx
│   └── parts/           # 组件子部件
│       └── SessionItem.tsx
├── config/              # 配置定义
│   └── config.ts
├── plugin.ts            # 插件入口
└── index.ts             # 公开导出
```

### 13.2 文件命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 服务文件 | `kebab-case.service.ts` | `session.service.ts` |
| 控制器文件 | `kebab-case.controller.ts` | `terminal-ui.controller.ts` |
| 命令文件 | `kebab-case.command.ts` | `create-session.command.ts` |
| Mutation 文件 | `kebab-case.mutation.ts` | `save-session.mutation.ts` |
| Operation 文件 | `kebab-case.operation.ts` | `toggle-dialog.operation.ts` |
| 模型文件 | `kebab-case.model.ts` | `session.model.ts` |
| React 组件 | `PascalCase.tsx` | `SessionList.tsx`, `HostDialog.tsx` |
| 类型文件 | `kebab-case.ts` 或 `i-xxx.ts` | `types.ts`, `i-session.ts` |
| 配置文件 | `config.ts` | `config.ts` |
| 插件入口 | `plugin.ts` | `plugin.ts` |
| 包入口 | `index.ts` | `index.ts` |

---

## 快速参考卡片

```
┌─────────────────────────────────────────────────────────────────┐
│  Observable 命名                                                 │
│  private readonly _xxx$ = new BehaviorSubject/Subject<T>(...);  │
│  readonly xxx$: Observable<T> = this._xxx$.asObservable();      │
├─────────────────────────────────────────────────────────────────┤
│  Subject 选择                                                    │
│  有当前值 → BehaviorSubject    纯事件 → Subject                   │
├─────────────────────────────────────────────────────────────────┤
│  订阅清理                                                        │
│  默认 → this.disposeWithMe(observable$.subscribe(...))          │
│  pipe 多流短路才用 RxDisposable + takeUntil(this.dispose$)       │
│  disposeWithMe() 接受函数,无需 toDisposable                      │
├─────────────────────────────────────────────────────────────────┤
│  dispose 清理                                                    │
│  super.dispose()        // 先调用父类                            │
│  this._xxx$.complete()  // complete 所有 Subject                 │
│  this._map.clear()      // 清理所有集合                          │
├─────────────────────────────────────────────────────────────────┤
│  DI 标识符 (接口与同名常量)                                       │
│  export const IXxxService = createIdentifier<IXxxService>(      │
│    '<包名>.<服务名>.service'                                    │
│  );                                                             │
├─────────────────────────────────────────────────────────────────┤
│  构造函数注入                                                    │
│  Service/Controller: @X private readonly _x: X                  │
│  Plugin:             @Inject(Injector) protected readonly      │
│                      _injector / _configService                 │
│  可选依赖:           @Optional(X) ... ?: X                      │
├─────────────────────────────────────────────────────────────────┤
│  命令 ID                                                         │
│  '<包名>.<command|mutation|operation>.<kebab-case-动作>'          │
├─────────────────────────────────────────────────────────────────┤
│  Plugin 工具 (from @termlnk/core)                                │
│  @DependentOn(P1, P2) — 声明插件依赖                             │
│  merge({}, default, this._config) — 深合并配置                   │
│  registerDependencies(injector, deps) — 批量注册                 │
│  touchDependencies(injector, deps) — 批量激活                    │
│  mergeOverrideWithDependencies(deps, override) — 应用 override   │
└─────────────────────────────────────────────────────────────────┘
```
