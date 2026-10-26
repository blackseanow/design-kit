# 抽取说明

记录 kit 的每个文件从原项目哪里来、删掉了什么、修了什么、新加了什么。抽取基于原项目 [blackseanow/temp10](https://github.com/blackseanow/temp10) 的 `main`（合并提交 `f811015`，`VERSION` 为 `v3.1.9`）。下文“来源”一列的路径都是原项目里的路径。原项目没有因此做任何修改。

## 来源对照

| kit 文件 | 来源 | 处理方式 |
| --- | --- | --- |
| `static/tokens.css` | `static/ui/tokens.css` | 数值不变；删除 4 个发言模式卡片底色 Token；新增 `--danger-hover`、`--popover-shadow`、`--segment-shadow`、`--switch-thumb-shadow`、`--content-max-width`（原来是组件里的写死值，数值保持一致） |
| `static/base.css` | `static/ui/base.css` | 删除业务别名（如 `.automation-*`、`.speech-library-*`、`.row-action-button`）和侧栏自绘滚动条；`#workspaceSidebar` 改为 `.sidebar` |
| `static/buttons.css` | `static/ui/buttons.css` | 只保留规范类名；修复见下文 |
| `static/components.css` | `static/ui/components.css` | 删除业务选择器（账号菜单、AI 人设菜单、各业务 Tabs 别名、可搜索实体选择器、表格设置弹层）；`.content-section` 改为 `.page-content` |
| `static/overlays.css` | `static/ui/overlays.css` | 删除账号切换弹层、手机键盘专用规则、`#saveState` |
| `static/shell.css` | `static/ui/shell.css` | 删除账号切换器、自动化开关、站点刷新按钮；`platform-user-*` 改名为 `user-menu-*`；手机顶栏从 6 列网格简化为一行弹性布局 |
| `static/page.css` | `static/ui/pages.css` 中页面标题区的通用规则 | 只取通用部分；`pages.css` 其余约 1500 行是业务布局，没有带走 |
| `static/auth.css` | `static/ui/auth.css` 前 67 行 | 删除 Joker 登录页插画和品牌布局 |
| `static/core.js` | `static/admin_accessibility.js`；`admin.js` 里的 `selectMenuBounds` / `positionSelectMenu` | 焦点工具原样复制；新增图标地址、单一浮层登记、视口工具 |
| `static/theme.js` | `static/ui/theme.js` | 存储 key 从写死的 `tgai-theme` 改为读取 `<html data-theme-key>`；删除自动化开关搬移逻辑；不再给 `<html>` 加 `.dark` 类（kit 的 CSS 不用它） |
| `static/route-progress.js` | `static/ui/route-progress.js` | 状态机原样复制；新增多页面应用的接线（见下文） |
| `static/feedback.js` | `admin.js` 中 `showGlobalFeedback` 等函数 | 行为一致；提示框改为按需创建；新增读取 Flask flash |
| `static/modal.js` | `admin.js` 中 `showModal` / `hideModal` / 焦点圈定；`static/ui-system.js` 中 `ModalShell` | 去掉业务钩子（未保存提醒、表单反馈重置）；新增 `confirm()` 和 `data-modal-open` 触发 |
| `static/select.js` | `admin.js` 中 `enhanceSingleSelect` 及相关函数 | 行为一致；改为自动增强 + `data-native` 退出 |
| `static/datetime.js` | `admin.js` 中日期和时间选择器 | 行为一致；日期选择器改为自动生成外层结构 |
| `static/ui.js` | `static/ui-system.js`；`admin.js` 中帮助气泡和 `setButtonLoading` | 删除“请先选择账号”空状态和业务行选择器；行操作图标改用图标集 |
| `static/shell.js` | `admin.js` 中 `setMobileSidebarOpen`；`static/workspace-header.js` 中个人菜单 | 删除账号切换、退出确认弹窗等业务逻辑 |
| `static/icons.svg`、`static/icons/` | `static/ui/icons.svg`、`static/ui/icons/` | 图标集删除 8 个业务图标（bot、gift、gavel 等），`icons/` 目录只保留 CSS 用到和通用的单个文件；新增 play、pause（形状取自 `ui-system.js`）和 trash-2（取自原项目的 `trash-2.svg`）；保留 Lucide ISC 许可证 |
| `templates/design_kit/macros.html` | `templates/empty_state.html`、`templates/page_header.html` | `page_header` 改为参数传入标题和说明，不再写死 20 个页面名称；其余宏为新增 |
| `templates/design_kit/layout.html` | `templates/dashboard.html` 的外壳结构、`templates/ui_styles.html` | 只保留外壳；业务区块、启动画面、Joker Logo 都不带 |

注意：原项目的 `static/admin.js` 是由 `src/admin/` 下的分片拼接生成的；kit 读取的是生成后的 `static/admin.js`。

## 没有带走的内容

- 业务页面样式：`pages.css` 的业务部分、`account-detail.css`、`business-lists.css`、`runtime-settings.css`。
- 品牌：`brand.css`、`templates/brand_logo.html`、`static/brand/` 下的 Joker Logo 和 favicon、启动画面。
- 业务交互：账号切换、自动化总开关、通知中心、加入群聊弹窗、未保存提醒（`unsaved-changes.js`）、表单字段规则（`form-feedback.js`、`form-contracts.js`）、筛选弹层（`filters.js`）、表格列设置（`tables.js`）、可搜索实体选择器。
- 手机软键盘适配（`runtime.js`）。kit 只同步 `--ui-viewport-height` / `--ui-viewport-top` 两个变量，键盘弹出时的滚动补偿没有带走。
- 选项卡底线滑动动画（`.motion-tabs`）。

需要这些功能时，可以回到原项目对应文件按同样的方式抽取。

## 对原项目问题的修复

1. **按钮变体背景色。** 原项目 `.btn-ghost`、`.btn-link`、`.btn-segment`、`.btn-menu` 用 `:where()` 写，特异性为 0，会输给 `base.css` 里的 `button { background: var(--brand) }`，结果文字按钮变成品牌色实心按钮。原项目给 `.btn-segment` 在 `pages.css` 里用 ID 选择器单独补了样式（`#overviewDashboardBody .ops-tabs button.btn-segment`）。kit 把这几个变体的颜色改为 `button.btn-x` 特异性。我在 kit 演示页截图里看到了修复前后的差别；原项目页面里没有逐一截图确认。
2. **登录页品牌标记。** 原规则 `.login-brand span` 本意是副标题，但也会命中 kit 的文字品牌方块，导致字母错位。kit 收窄为 `.login-brand > div > span`。
3. **行内开关状态。** 原 `ui-system.js` 在把“更多操作”按钮加入行之前，就调用 `group.insertBefore(status, trigger)`。按 DOM 规范，参照节点不在父节点里时会抛出 `NotFoundError`，所以行操作里有开关时这段代码会出错。这是读代码得出的结论，我没有在原项目里运行复现。kit 改为直接追加。
4. **写死的阴影颜色** 提成了 Token，数值换算保持一致（`#0002` → `rgba(0,0,0,.133)`，`#00000015` → `rgba(0,0,0,.082)`）。

## kit 新增的内容

- Flask Blueprint、配置项、`kit` 模板全局变量、资源内容哈希（缓存刷新用）。
- 布局：`layout.html`（应用页）、`auth_layout.html`（登录页）。
- 宏：`icon`、`page_header`、`panel_head`、`empty_state`、`error_state`、`loading_state`、`status_chip`、`inline_status`、`metric_card`、`switch`、`password_field`、`link_tabs`、`active_filters`、`pagination`、`modal`、`flash_messages`、`nav_menu`、`theme_options`。
- 链接按钮样式（`a.btn-primary` 等）、链接选项卡、链接分页、`.page-content` 容器、`.settings-rows`。
- 多页面应用的进度条接线：站内链接和表单提交时开始，页面 `load` 后结束，从前进后退缓存恢复时清除。
- `Kit.modal.confirm()`、`Kit.modal.onClose()`、选项卡按 `aria-controls` 切换面板、`data-primary-visible`、`data-icon`。
- 没有 Logo 时的文字品牌方块。

## 原项目文档和代码不一致的地方

抽取时以代码为准，并在 kit 文档里写实际值。

| 原项目文档或注释写的 | 代码实际 | 位置 |
| --- | --- | --- |
| `ui_styles.html` 加载 8 个模块 | 加载 12 个 CSS 文件 | `docs/ui-consistency/design-system-v2.24.17.md` / `templates/ui_styles.html` |
| 弹窗圆角 16px | `--dialog-radius: 8px`（独立样板 `sandbox/openrouter-ui/` 里是 16px） | 同上 / `static/ui/tokens.css` |
| 侧栏 216px | `--sidebar-width: 224px`；手机抽屉宽 `min(288px, 100vw - 32px)` | 同上，`responsive-accessibility.md` / `static/ui/shell.css` |
| 768px 及以下用抽屉侧栏和两行头部 | 1023px 及以下用抽屉；手机顶栏是一行 | `responsive-accessibility.md` / `static/ui/shell.css` |
| 折叠侧栏宽度 64px | `shell.css` 里没有找到折叠侧栏 | 同上 |
| `buttons.css` 给 `.btn-primary`、`.btn-secondary` 写了 32px 高度 | 这条 `:where()` 规则输给 `button` 默认样式，实际默认 40px；只有页面标题区、面板标题区和工具栏里是 32px | `static/ui/buttons.css` / `static/ui/base.css` |
