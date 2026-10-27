# 浏览器支持

## 基线

| 浏览器 | 最低版本 | 发布时间 |
| --- | --- | --- |
| Chrome / Edge | 120 | 2023-12 |
| Safari（macOS） | 16.4 | 2023-03 |
| iOS Safari 和 iOS 上的其他浏览器 | 16.4 | 2023-03 |
| Firefox | 121 | 2023-12 |
| Android Chrome | 120 | 2023-12 |

基线内的浏览器应得到完整效果。`.browserslistrc` 写的是同一组值，静态检查按它执行。版本号对应的是下面这些特性首次完整支持的版本，来源是编写时对 caniuse 数据的核对；升级或放宽基线时请重新核对。

## 决定基线的特性

| 特性 | 用在哪里 | 基线以下会怎样 |
| --- | --- | --- |
| 无前缀 `mask` | 关闭按钮、箭头、帮助图标、转圈 | 已同时写 `-webkit-mask`，Safari 9 和 Chrome 4 起可用 |
| `color-mix()` | 危险按钮悬停色、表格行底色、横幅边框、字段错误阴影 | 每处都有普通颜色兜底：悬停仍可见，行底色改用半透明色 |
| `:has()` | 必填星号、复选框标签布局、分段控件选中态、3 列以下表格适应容器、弹窗底部状态行、手机标题区换行 | 分段控件由 JS 维护 `.is-checked`，图标用 `.ui-icon`，都不依赖它；其余只是少一个修饰效果，功能不受影响 |
| Popover API（`popover="manual"`） | 弹出层、下拉菜单、行操作菜单 | 退回 `position: fixed`；放在表格固定列里的菜单可能被顶栏盖住 |
| `inert` | 弹窗和抽屉打开时的背景 | 键盘仍被 JS 圈定在弹窗内；读屏可能读到背景内容 |
| `dvh`、`env(safe-area-inset-*)` | 弹窗高度、手机安全区 | 退回 `vh`，全屏时底部可能被地址栏挡住 |
| `scrollbar-gutter`、`text-wrap: pretty` | 滚动条占位、空状态文案换行 | 只是外观略差 |

不依赖构建，JS 使用的语法（可选链、`??`、`Array.prototype.at`）在基线内全部可用。

## 没有 JS 时

- 表单、筛选、分页都是原生 GET / POST，能正常提交。
- 下拉、日期、时间显示浏览器原生控件。
- 弹窗、抽屉、下拉菜单、弹出层、行操作菜单打不开；`<details>` 折叠面板可以。
- 启动画面（`DESIGN_KIT_STARTUP_SPLASH`）有 `<noscript>` 备用链接，页面正常显示。

## 验证方式

| 层 | 做法 | 频率 |
| --- | --- | --- |
| 三个引擎 | `BROWSER=chromium`、`webkit`、`firefox` 各跑一遍 `tests/browser_check.js`（CI 自动跑） | 每次推送 |
| 基线外特性 | `npm run lint:compat`：`doiuse` 按 `.browserslistrc` 扫 CSS，`eslint-plugin-compat` 扫 JS | 每次推送 |
| 无障碍 | `tests/browser_check.js` 里的 axe 扫描（对比度、ARIA） | 每次推送 |
| 真机 | iOS Safari、Android Chrome 按 `qa-checklist.md` 的“真机和读屏”一节走一遍 | 改公共组件后 |
| 读屏 | VoiceOver、NVDA 按同一节走一遍 | 改公共组件后 |

Playwright 的 WebKit 和 Safari 共用引擎，但不等于 Safari：软键盘、地址栏收起、`100dvh` 的行为只能在真机确认。

## 不支持的

- IE、旧 Edge（EdgeHTML）。
- 基线以下的版本不保证外观，但上面列出的兜底能保证功能可用。
