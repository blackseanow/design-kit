# 设计规范

本文件描述 kit 的视觉规则。数值以 `design_kit/static/tokens.css` 为准；下方 Token 表由脚本从该文件生成，改了 Token 后请同步更新本表。

## 基本原则

- 安静的控制台风格：浅色画布、白色面板、1px 极淡分隔线，品牌色只用在主操作、选中态、焦点和进度条。
- 颜色全部是语义 Token。页面写 `var(--danger-text)`，不写 `#c9362b`。
- 夜间不是日间反色：夜间有独立的一组值（原项目按 OpenRouter 控制台夜间实测值映射）。
- 系统字体，不下载网络字体；中文回退 PingFang SC / Microsoft YaHei。

## 字号

| 用途 | 桌面 | 手机（≤768px） |
| --- | --- | --- |
| 页面标题（`h1`，`page_header()` 用的也是它） | 22px / 30px，字重 650 | 20px / 28px |
| 面板标题（`h2`） | 16px / 24px，字重 600 | 同左 |
| 弹窗标题（`.modal-head h2`） | 18px / 24px | 16px |
| 正文 | 14px / 22.75px | 输入框 16px（防止 iOS 聚焦放大） |
| 辅助说明 | 12–13px | 同左 |
| 指标数值（`.metric-card strong`） | 26px | 24px |

## 间距

`--space-1` 到 `--space-8`：4 / 8 / 12 / 16 / 24 / 32px。

- 面板内边距：桌面 24px，手机 16px；嵌套面板 16px / 12px。
- 页面区块之间：24px（`.page-content` 是 `gap: 24px` 的网格）。
- 表单网格：两列，间距 16px；≤768px 变一列。

## 圆角和阴影

| Token | 值 | 用在 |
| --- | --- | --- |
| `--radius` | 6px | 按钮、输入框、菜单 |
| `--panel-radius` | 8px | 面板、指标卡、空状态 |
| `--dialog-radius` | 8px | 弹窗 |
| `--shadow` | 两层浅阴影 | 菜单、提示 |
| `--dialog-shadow` | 较深两层阴影 | 弹窗 |

## 尺寸

| Token | 值 | 说明 |
| --- | --- | --- |
| `--control-height` | 40px | 输入框、下拉、默认按钮 |
| `--compact-height` | 32px | 页面标题区、面板标题区、工具栏里的按钮 |
| `--touch-height` | 44px | ≤768px 时按钮和输入框的最小高度 |
| `--header-height` | 56px | 顶栏 |
| `--sidebar-width` | 224px | 桌面侧栏；手机抽屉宽 `min(288px, 100vw - 32px)` |
| `--content-max-width` | 1232px | 内容区最大宽度（kit 把原来的写死值提成了 Token） |
| 图标 | 16px，描边 1.75 | 导航图标描边 1.5 |

## 动效

- 普通过渡 `--motion`：150ms ease。
- 手机抽屉：350ms `cubic-bezier(.32,.72,0,1)`，遮罩 250ms 淡入。
- 顶部进度条：2px 高，每 200ms 线性前进，结束时先走满再用 200ms 淡出；请求未结束时最多走到 94%。
- 弹窗进入：160ms，向上 4px。
- `prefers-reduced-motion: reduce` 时关闭过渡和动画，进度条不再缓慢前进。

## 层级（z-index）

| 层 | 值 |
| --- | --- |
| 侧栏（桌面） | 30 |
| 手机遮罩 / 抽屉 | 40 / 50 |
| 顶栏 | 60 |
| 用户菜单 | 100 |
| 弹窗 | 1000 起，每多开一层 +1 |
| 帮助气泡 | 至少 5000，且高于最上层弹窗；CSS 默认 20000 |
| 下拉、日期、时间菜单 | 12000 |
| 全局提示 | 21000 |
| 顶部进度条 | 30000 |

## 图标

本地 Lucide 图标（lucide-static 0.468.0，ISC 许可，见 `static/icons/LICENSE`）。用法：

```jinja
{% from "design_kit/macros.html" import icon %}
{{ icon('search') }}
```

`icons.svg` 里有 37 个图标。需要新图标时，从 Lucide 同版本取 SVG 加进 `icons.svg` 的 `<symbol>`，不要混用填充风格的图标或用字符代替图标。CSS 遮罩用到的单个 SVG 放在 `static/icons/`。

## Logo

kit 不带任何 Logo。配置 `DESIGN_KIT_LOGO_LIGHT` / `DESIGN_KIT_LOGO_DARK` 后显示图片，否则显示品牌色方块加一个字（`DESIGN_KIT_BRAND_MARK`）。Logo 用透明底，不要加滤镜或灰色蒙版。

## Token 全表

| Token | 日间 | 夜间 |
| --- | --- | --- |
| `--search-icon` | `内嵌 SVG（搜索图标）` | 内嵌 SVG |
| `--canvas` | `#fcfcfe` | `#03080a` |
| `--surface` | `#fff` | `#080d0f` |
| `--surface-subtle` | `#f7f7fa` | `rgba(252,252,254,.031)` |
| `--sidebar-surface` | `rgba(3,8,10,.01085)` | `rgba(252,252,254,.00372)` |
| `--input-surface` | `var(--surface)` | `#fcfcfe0a` |
| `--ink` | `#03080a` | `#fcfcfe` |
| `--muted` | `rgba(3,8,10,.69)` | `rgba(252,252,254,.627)` |
| `--line` | `rgba(3,8,10,.08)` | `rgba(252,252,254,.078)` |
| `--line-subtle` | `rgba(3,8,10,.0312)` | `rgba(252,252,254,.0312)` |
| `--line-strong` | `rgba(3,8,10,.22)` | `rgba(252,252,254,.18)` |
| `--hover` | `rgba(3,8,10,.035)` | `rgba(252,252,254,.031)` |
| `--brand` | `#7624f4` | `#c8ff00` |
| `--brand-hover` | `#651bd5` | `#c8ff00e0` |
| `--brand-tint` | `rgba(118,36,244,.08)` | `rgba(200,255,0,.08)` |
| `--on-brand` | `#fff` | `#03080a` |
| `--progress-brand` | `#7624f4` | `#c8ff00` |
| `--progress-glow` | `0 0 10px #7624f4,0 0 5px #7624f4` | `0 0 10px #c8ff00,0 0 5px #c8ff00` |
| `--success` | `#16803c` | `#7ee787` |
| `--success-tint` | `#eef9f0` | `rgba(126,231,135,.12)` |
| `--warning` | `#916000` | `#f2cc60` |
| `--warning-tint` | `#fff8e7` | `rgba(242,204,96,.12)` |
| `--danger` | `#c9362b` | `#e11d48` |
| `--danger-text` | `#c9362b` | `#fb7185` |
| `--danger-tint` | `#fff0ee` | `rgba(225,29,72,.14)` |
| `--on-danger` | `#fff` | `#fff` |
| `--danger-hover` | `color-mix(in srgb,var(--danger) 88%,#000)` | 同日间 |
| `--scrim` | `rgba(3,8,10,.32)` | `rgba(0,0,0,.55)` |
| `--focus-border` | `rgba(3,8,10,.3)` | `rgba(252,252,254,.3)` |
| `--focus-shadow` | `rgba(3,8,10,.06)` | `rgba(252,252,254,.06)` |
| `--font` | `system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif` | 同日间 |
| `--radius` | `6px` | 同日间 |
| `--panel-radius` | `8px` | 同日间 |
| `--dialog-radius` | `8px` | 同日间 |
| `--shadow` | `0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)` | 同日间 |
| `--dialog-shadow` | `0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1)` | 同日间 |
| `--popover-shadow` | `0 6px 22px rgba(0,0,0,.133)` | 同日间 |
| `--segment-shadow` | `0 1px 3px rgba(0,0,0,.082)` | 同日间 |
| `--switch-thumb-shadow` | `0 2px 6px rgba(0,0,0,.18)` | 同日间 |
| `--space-1` | `4px` | 同日间 |
| `--space-2` | `8px` | 同日间 |
| `--space-3` | `12px` | 同日间 |
| `--space-4` | `16px` | 同日间 |
| `--space-6` | `24px` | 同日间 |
| `--space-8` | `32px` | 同日间 |
| `--control-height` | `40px` | 同日间 |
| `--compact-height` | `32px` | 同日间 |
| `--touch-height` | `44px` | 同日间 |
| `--sidebar-width` | `224px` | 同日间 |
| `--header-height` | `56px` | 同日间 |
| `--content-max-width` | `1232px` | 同日间 |
| `--dialog-max-height` | `760px` | 同日间 |
| `--overlay-gutter` | `24px` | 同日间 |
| `--switch-width` | `44px` | 同日间 |
| `--switch-height` | `24px` | 同日间 |
| `--switch-thumb` | `20px` | 同日间 |
| `--switch-off` | `rgba(3,8,10,.30)` | `rgba(252,252,254,.30)` |
| `--motion` | `150ms ease` | 同日间 |
| `--drawer-duration` | `350ms` | 同日间 |
| `--progress-height` | `2px` | 同日间 |
| `--progress-motion` | `200ms` | 同日间 |
| `--scrollbar-width` | `thin` | 同日间 |
| `--scrollbar-thumb` | `var(--line-strong)` | 同日间 |
| `--scrollbar-track` | `transparent` | 同日间 |
