# Base46 主题系统规范

> 基于 [NvChad/base46](https://github.com/NvChad/base46) v3.0 分支的深度研究

## 概述

Base46 是 NvChad 项目创建的主题系统，将颜色分为两个主表：

| 系统 | 颜色数量 | 用途 |
|-----|---------|------|
| **base_30** | 30 种 | UI 元素（背景、边框、按钮、卡片等） |
| **base_16** | 16 种 | 语法高亮（代码编辑器、终端颜色） |

---

## Base_30 颜色规范

### 梯度算法

Base46 使用**精确的百分比关系**来确保颜色和谐。所有颜色都以 `black`（主背景色）为基准计算。

```
┌─────────────────────────────────────────────────────────────────┐
│                     背景色梯度 (从深到浅)                         │
├─────────────────────────────────────────────────────────────────┤
│  darker_black  ←─── -6%  ───┐                                   │
│                             │                                   │
│  black (基准)  ←────────────┼─── 0% (主背景)                    │
│                             │                                   │
│  black2       ←─── +6%  ───┘                                   │
│                                                                 │
│  one_bg       ←─── +10% ─── 卡片/面板背景                       │
│                                                                 │
│  one_bg2      ←─── +16% ─── hover 状态 (one_bg + 6%)           │
│                                                                 │
│  one_bg3      ←─── +22% ─── active/focus 状态 (one_bg2 + 6%)   │
└─────────────────────────────────────────────────────────────────┘
```

### 完整颜色定义

#### 中性色梯度（Neutral Gradient）

| 颜色名 | 梯度算法 | UI 用途 | 最佳实践 |
|-------|---------|--------|---------|
| `white` | 纯白或接近白 | 高对比度文本、强调元素 | 用于主要文本、标题、高亮状态的前景色 |
| `black` | **基准色 (0%)** | 主背景 | 页面/窗口的默认背景色，所有其他颜色的计算基准 |
| `darker_black` | black - 6% | 深色强调 | 用于禁用状态背景、更深层次的嵌套背景 |
| `black2` | black + 6% | 次级背景 | 用于区分层级，如侧边栏与主内容区的微妙区分 |
| `one_bg` | black + 10% | 卡片/面板背景 | **最常用**：卡片、模态框、下拉菜单的背景 |
| `one_bg2` | one_bg + 6% (总 +16%) | hover 状态 | 鼠标悬停时的背景色变化 |
| `one_bg3` | one_bg2 + 6% (总 +22%) | active/focus 状态 | 点击/聚焦时的背景色，最浅的中性背景 |

#### 前景色梯度（Foreground Gradient）

| 颜色名 | 梯度算法 | UI 用途 | 最佳实践 |
|-------|---------|--------|---------|
| `grey` | black + 40% | 最低优先级文本 | 禁用状态文本、占位符、水印 |
| `grey_fg` | grey + 10% | 次要文本 | 描述文本、标签、副标题 |
| `grey_fg2` | grey + 20% (或 grey_fg + 5%) | 普通文本 | 正常内容文本、列表项 |
| `light_grey` | grey + 28% | 主要文本 | 高对比度文本，接近 white |

#### UI 专用色

| 颜色名 | 梯度算法 | UI 用途 | 最佳实践 |
|-------|---------|--------|---------|
| `line` | black + 15% | 分隔线、边框 | Divider、Border、Separator 的颜色 |
| `statusline_bg` | black + 4% | 状态栏背景 | 底部状态栏、工具栏背景 |
| `lightbg` | statusline_bg + 13% | 浅背景强调 | 悬停状态、选中状态的背景 |
| `pmenu_bg` | 通常为主题强调色 | 弹出菜单高亮 | 下拉菜单选中项、自动补全高亮 |
| `folder_bg` | 通常为 blue | 文件夹图标 | 文件树中文件夹的颜色 |

#### 语义色（Semantic Colors）

| 颜色名 | 变体关系 | UI 用途 | 最佳实践 |
|-------|---------|--------|---------|
| `red` | 基础红色 | 错误、删除、危险 | Error 状态、Delete 按钮、警告提示 |
| `baby_pink` | red + 15% (变浅) | 柔和错误 | 错误背景色、次要警告 |
| `pink` | 独立粉色 | 装饰、标记 | 标签、装饰性元素 |
| `green` | 基础绿色 | 成功、新增、确认 | Success 状态、新增标记、确认按钮 |
| `vibrant_green` | green 的鲜艳版 | 强调成功 | 高亮成功状态、活跃指示器 |
| `blue` | 基础蓝色 | 主操作、信息、链接 | Primary 按钮、链接、信息提示 |
| `nord_blue` | blue - 13% (变深) | 次要蓝色 | 次要操作、深色蓝色装饰 |
| `yellow` | 基础黄色 | 警告、修改 | Warning 状态、修改标记 |
| `sun` | yellow + 8% (变亮) | 高亮黄色 | 搜索高亮、重要提示 |
| `purple` | 基础紫色 | 特殊、高级 | 特殊功能标记、高级功能 |
| `dark_purple` | purple 的深色版 | 次要紫色 | 次要特殊标记 |
| `teal` | 青绿色 | 信息、次要 | Info 状态、次要信息 |
| `orange` | 橙色 | 警告、待处理 | 待处理状态、中等优先级 |
| `cyan` | 青色 | 装饰、特殊 | 装饰性元素、特殊高亮 |

---

## Base_16 颜色规范

Base_16 遵循 [Base16 标准](https://github.com/chriskempson/base16/blob/master/styling.md)，主要用于代码语法高亮。

### 背景/前景渐变 (base00-base07)

这 8 种颜色形成从暗到亮的灰度梯度：

| 颜色 | 语义 | 代码用途 | 终端映射 |
|-----|------|--------|---------|
| `base00` | 默认背景 | 编辑器主背景 | 背景色 |
| `base01` | 浅背景 | 状态栏、行号背景 | - |
| `base02` | 选择背景 | 文本选区背景 | - |
| `base03` | 注释色 | 注释、不可见字符 | ANSI bright black |
| `base04` | 深前景 | 状态栏文本 | - |
| `base05` | 默认前景 | **正常文本颜色** | 前景色 |
| `base06` | 浅前景 | 强调前景 | - |
| `base07` | 最浅前景 | 最亮文本 | ANSI white |

### 语法高亮色 (base08-base0F)

| 颜色 | 语义 | 代码元素 | 示例 |
|-----|------|--------|------|
| `base08` | 红色 - 变量 | 变量名、HTML 标签 | `let x`, `<div>` |
| `base09` | 橙色 - 常量 | 整数、布尔值、常量 | `42`, `true`, `NULL` |
| `base0A` | 黄色 - 类 | 类名、搜索高亮 | `class Foo`, 搜索结果 |
| `base0B` | 绿色 - 字符串 | 字符串字面量 | `"hello"`, `'world'` |
| `base0C` | 青色 - 转义 | 正则表达式、转义字符 | `/regex/`, `\n` |
| `base0D` | 蓝色 - 函数 | 函数名、方法名 | `function()`, `.map()` |
| `base0E` | 紫色 - 关键字 | 语言关键字 | `if`, `for`, `return` |
| `base0F` | 棕色 - 废弃 | 废弃代码标记 | deprecated API |

---

## UI 组件应用指南

### 1. 背景色层级

```
视觉层级（从低到高）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
页面背景    │ black          │ 最底层
─────────────────────────────────────────
卡片/面板   │ one_bg         │ 内容容器
─────────────────────────────────────────
悬停状态    │ one_bg2        │ 交互反馈
─────────────────────────────────────────
激活状态    │ one_bg3        │ 选中/聚焦
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. 组件颜色对照表

| 组件类型 | 背景色 | 文字色 | 边框色 | hover | active |
|---------|-------|-------|-------|-------|--------|
| **页面** | black | light_grey | - | - | - |
| **卡片** | one_bg | light_grey | line | one_bg2 | - |
| **按钮 (primary)** | blue | white | - | blue/90 | blue/80 |
| **按钮 (outline)** | one_bg/30 | light_grey | line | one_bg/50 | one_bg2 |
| **按钮 (ghost)** | transparent | light_grey | - | one_bg2 | one_bg3 |
| **输入框** | one_bg/30 | light_grey | line | - | ring: blue |
| **下拉菜单** | one_bg | light_grey | line | one_bg2 | one_bg3 |
| **分隔线** | line | - | - | - | - |
| **状态栏** | statusline_bg | grey_fg | - | - | - |
| **标签 (tag)** | one_bg2 | grey_fg2 | - | one_bg3 | - |

### 3. 语义状态颜色

```typescript
// 状态色彩映射
const stateColors = {
  success: {
    bg: 'green/10',      // 背景
    text: 'green',       // 文字
    border: 'green/30',  // 边框
  },
  error: {
    bg: 'red/10',
    text: 'red',
    border: 'red/30',
  },
  warning: {
    bg: 'yellow/10',
    text: 'yellow',
    border: 'yellow/30',
  },
  info: {
    bg: 'blue/10',
    text: 'blue',
    border: 'blue/30',
  },
};
```

---

## 主题定义示例

### TypeScript 接口

```typescript
interface IBase30Colors {
  // 中性色梯度
  white: string;           // 纯白或接近白
  black: string;           // 主背景 (基准色)
  darker_black: string;    // black - 6%
  black2: string;          // black + 6%
  one_bg: string;          // black + 10%
  one_bg2: string;         // black + 16%
  one_bg3: string;         // black + 22%

  // 前景色梯度
  grey: string;            // black + 40%
  grey_fg: string;         // grey + 10%
  grey_fg2: string;        // grey + 20%
  light_grey: string;      // grey + 28%

  // 语义色
  red: string;
  baby_pink: string;       // red + 15%
  pink: string;
  green: string;
  vibrant_green: string;
  blue: string;
  nord_blue: string;       // blue - 13%
  yellow: string;
  sun: string;             // yellow + 8%
  purple: string;
  dark_purple: string;
  teal: string;
  orange: string;
  cyan: string;

  // UI 专用
  line: string;            // black + 15%
  statusline_bg: string;   // black + 4%
  lightbg: string;         // statusline_bg + 13%
  pmenu_bg: string;        // 主题强调色
  folder_bg: string;       // 通常为 blue
}

interface IBase16Colors {
  base00: string;  // 默认背景
  base01: string;  // 浅背景
  base02: string;  // 选区背景
  base03: string;  // 注释色
  base04: string;  // 深前景
  base05: string;  // 默认前景 (重要!)
  base06: string;  // 浅前景
  base07: string;  // 最浅前景
  base08: string;  // 红 - 变量
  base09: string;  // 橙 - 常量
  base0A: string;  // 黄 - 类
  base0B: string;  // 绿 - 字符串
  base0C: string;  // 青 - 转义
  base0D: string;  // 蓝 - 函数
  base0E: string;  // 紫 - 关键字
  base0F: string;  // 棕 - 废弃
}
```

### 主题示例 (OneDark)

```typescript
const oneDarkTheme: ITheme = {
  name: 'OneDark',
  type: 'dark',

  base_30: {
    // 中性色梯度 (以 #1e222a 为基准)
    white: '#abb2bf',
    black: '#1e222a',           // 基准
    darker_black: '#1b1f27',    // -6%
    black2: '#252931',          // +6%
    one_bg: '#282c34',          // +10%
    one_bg2: '#353b45',         // +16%
    one_bg3: '#3e4451',         // +22%

    // 前景色梯度
    grey: '#42464e',            // +40%
    grey_fg: '#565c64',         // grey +10%
    grey_fg2: '#6f737b',        // grey +20%
    light_grey: '#6f737b',

    // 语义色
    red: '#e06c75',
    baby_pink: '#de8c92',       // red +15%
    pink: '#ff75a0',
    green: '#98c379',
    vibrant_green: '#7eca9c',
    blue: '#61afef',
    nord_blue: '#519fdf',       // blue -13%
    yellow: '#e7c787',
    sun: '#f1cf8a',             // yellow +8%
    purple: '#c882e7',
    dark_purple: '#b77bdf',
    teal: '#4db5bd',
    orange: '#d19a66',
    cyan: '#56b6c2',

    // UI 专用
    line: '#31353d',            // black +15%
    statusline_bg: '#22262e',   // black +4%
    lightbg: '#2d3139',         // statusline_bg +13%
    pmenu_bg: '#61afef',        // blue (强调色)
    folder_bg: '#61afef',       // blue
  },

  base_16: {
    base00: '#1e222a',  // 与 black 相同
    base01: '#353b45',
    base02: '#3e4451',
    base03: '#545862',
    base04: '#565c64',
    base05: '#abb2bf',  // 主文本色
    base06: '#b6bdca',
    base07: '#c8ccd4',
    base08: '#e06c75',  // red
    base09: '#d19a66',  // orange
    base0A: '#e5c07b',  // yellow
    base0B: '#98c379',  // green
    base0C: '#56b6c2',  // cyan
    base0D: '#61afef',  // blue
    base0E: '#c678dd',  // purple
    base0F: '#be5046',  // brown
  },
};
```

---

## 梯度计算工具

### 亮度调整函数

```typescript
/**
 * 调整颜色亮度
 * @param hex - 十六进制颜色值
 * @param percent - 百分比 (正数变亮，负数变暗)
 */
function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);

  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));

  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// 使用示例
const black = '#1e222a';
const darker_black = adjustBrightness(black, -6);  // #1b1f27
const one_bg = adjustBrightness(black, 10);        // #282c34
const one_bg2 = adjustBrightness(black, 16);       // #353b45
const grey = adjustBrightness(black, 40);          // #42464e
const line = adjustBrightness(black, 15);          // #31353d
```

### 在线工具

- [NvChad Hex Tools](https://siduck.github.io/hex-tools/) - 官方梯度计算器
- [Coolors](https://coolors.co/) - 调色板生成
- [Color Review](https://color.review/) - 对比度检查

---

## 对比度要求

遵循 WCAG 2.0 可访问性标准：

| 等级 | 比率 | 应用场景 |
|-----|------|--------|
| **AA** | ≥ 4.5:1 | 普通文本 (必需) |
| **AA Large** | ≥ 3:1 | 大文本 (18px+) |
| **AAA** | ≥ 7:1 | 增强对比度 (推荐) |

**检查要点：**
- `light_grey` 在 `black` 背景上 ≥ 4.5:1
- `grey_fg2` 在 `black` 背景上 ≥ 4.5:1
- `grey` 可低于 4.5:1（用于禁用状态）
- 语义色在对应背景上需满足对比度要求

---

## Termlnk 项目集成指南

### Tailwind CSS 类名映射

项目使用 `tm-` 前缀，颜色名中的下划线转为连字符：

```tsx
// 背景色层级
<div className="tm-bg-black">          {/* 页面背景 */}
<div className="tm-bg-one-bg">         {/* 卡片背景 */}
<div className="tm-bg-one-bg2">        {/* hover 背景 */}
<div className="tm-bg-one-bg3">        {/* active 背景 */}

// 文字颜色
<span className="tm-text-light-grey">  {/* 主要文本 */}
<span className="tm-text-grey-fg2">    {/* 普通文本 */}
<span className="tm-text-grey-fg">     {/* 次要文本 */}
<span className="tm-text-grey">        {/* 禁用文本 */}

// 边框和分隔
<div className="tm-border-line">       {/* 边框 */}
<div className="tm-divide-line">       {/* 分隔线 */}

// 语义色
<button className="tm-bg-blue">        {/* Primary */}
<span className="tm-text-red">         {/* Error */}
<span className="tm-text-green">       {/* Success */}
<span className="tm-text-yellow">      {/* Warning */}
```

### CSS 变量命名

主题通过 `--tm-*` CSS 变量注入到 `:root`：

```css
:root {
  --tm-black: #0a0a0a;
  --tm-one-bg: #171717;
  --tm-light-grey: #d4d4d4;
  --tm-blue: #3a81f6;
  /* ... */
}
```

### 组件开发最佳实践

```tsx
// ✅ 正确：使用 base46 颜色变量
<button className="tm-bg-one-bg hover:tm-bg-one-bg2 active:tm-bg-one-bg3 tm-text-light-grey">

// ❌ 错误：硬编码颜色值
<button className="bg-gray-800 hover:bg-gray-700 text-white">

// ❌ 错误：使用 dark: 前缀（颜色跟随主题自动切换）
<button className="dark:bg-gray-800 dark:text-white">
```

### 主题切换

```typescript
import { IThemeService } from '@termlnk/core';
import defaultTheme from '@termlnk/themes/themes/default';
import catppuccinTheme from '@termlnk/themes/themes/catppuccin';

// 通过 DI 获取主题服务
const themeService = injector.get(IThemeService);

// 切换主题
themeService.setTheme(catppuccinTheme);
```

### 可用主题列表

| 主题名 | 类型 | 文件 |
|-------|------|------|
| Default Dark | dark | `themes/default.ts` |
| Catppuccin | dark | `themes/catppuccin.ts` |
| Tokyo Night | dark | `themes/tokyonight.ts` |
| Dracula | dark | `themes/dracula.ts` |
| Vercel | dark | `themes/vercel.ts` |
| Claude | dark | `themes/claude.ts` |
| Cyberpunk | dark | `themes/cyberpunk.ts` |
| Midnight Bloom | dark | `themes/midnight-bloom.ts` |
| Neo Brutalism | dark | `themes/neo-brutalism.ts` |
| Amber Minimal | dark | `themes/amber-minimal.ts` |

---

## 参考资源

- [NvChad/base46](https://github.com/NvChad/base46) - 官方仓库
- [Base16 Styling Guide](https://github.com/chriskempson/base16/blob/master/styling.md) - Base16 标准
- [NvChad Theming Docs](https://nvchad.com/docs/config/theming/) - 官方文档
- [Tinted Theming](https://github.com/tinted-theming/home) - Base16 主题集合
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) - 对比度标准
