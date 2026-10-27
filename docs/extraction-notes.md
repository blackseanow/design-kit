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

## 第二批：弹层、导航和提醒（2026-10-27）

第一次抽取只带了弹窗、用户菜单、行操作菜单和帮助气泡；对照原项目后补上了下面这些。原项目基线仍是 `main`，这次对照的是 `v3.2.4`（提交 `baeb722`）。

| kit 文件 / 宏 | 来源 | 处理方式 |
| --- | --- | --- |
| `popover.js` 的 `Kit.popover`、`.popover-panel` | `static/ui/filters.js`（筛选弹层的定位、外部点击、Esc、焦点移出关闭、子菜单不关父层）；`components.css` 的 `.list-filter-popover` | 去掉按业务 ID 登记的筛选配置；任何元素用 `data-popover-open` 打开；元素留在原位置（字段仍在表单里）；支持 Popover API 时进入顶层 |
| `filter_popover` 宏、`.list-filter-trigger` | `filters.js` 生成的“筛选 · N”按钮和弹层结构 | 改为服务端渲染：字段写在 call 块里，“筛选”按钮提交 GET 表单；已生效条件继续用 `active_filters` |
| `Kit.menu`、`dropdown_menu` / `menu_button` 宏、`.dropdown-menu` | 行操作菜单（`ui-system.js`）和账号切换弹层（`overlays.css` 的 `.account-switch-popover`：184/200px 宽、4px 内边距、底部分组、勾选标记） | 合并成一个通用菜单：`menuitem` / `menuitemradio` / `menuitemcheckbox`、分组标题、分隔线、搜索框、底部操作 |
| `Kit.tableSettings`、`.table-settings-*`、`.table-column-hidden` | `static/ui/tables.js`、`components.css` 的表格设置样式 | 逻辑原样移植（显示列、行密度、按表格 id 和列名存 localStorage、自动补操作列）；改为 `data-table-settings` 显式开启；弹层改用 `Kit.popover` 和 `Kit.ui.Tabs` |
| `drawer` 宏、`.drawer-*` | 原项目已下线的回复调试抽屉：`a7d4997^` 之前的 `overlays.css` `.ai-reply-test-drawer`（宽 `min(1040px, 100vw - 48px)`、左边线、对话框阴影、`transform` 180ms ease、手机铺满）和 `ui-system.js` 的 `DrawerShell` | 不再单独实现：抽屉就是贴边的 `.modal-backdrop`，复用 modal.js 的焦点、Esc、滚动锁定和层叠；宽度分 sm/md/lg/xl，xl 取原值 1040 |
| `notification_bell` / `header_icon_button` 宏、`Kit.badge` | `templates/dashboard.html` 的 `#notificationBell` + `.notification-unread-badge`，`static/ui/notification-center.js` 的角标更新（`99+`、`aria-label` 带未读数） | 角标 CSS 第一次已带来（`.header-badge`）；这次补宏和 JS；轮询和 `/api/notifications` 是业务，没有带 |
| `notification_item` 宏、`.notification-*` | `templates/notification_center.html`、`pages.css` 309–325 行 | 结构和样式一致；未读芯片改用品牌色（`info`，原来是绿色的 `.on`，按使用方的要求改的）；“查看账号”等操作放在 call 块里 |
| `breadcrumb` 宏、`.breadcrumb` | `account-detail.css` 的 `.account-detail-breadcrumb`（13px、10px 间距、返回箭头） | 改成 `<nav><ol>` 结构，最后一项 `aria-current="page"` |
| `steps` 宏、`.steps` | `pages.css` 的 `.account-onboarding-steps`（文字步骤：完成为正文色、当前品牌色加粗）和 `.overview-onboarding-step` 的圆形标记（完成绿底、下一步品牌底） | 合成一个横向步骤条：28px 圆标 + 文字 + 连接线；竖排变体为 kit 新增 |
| `segmented` 宏、`.segmented` | `pages.css` 的 `.policy-mode-segmented`（4px 内边距、浅底、选中项白底描边加阴影） | 改用单选框实现，随表单提交；`aria-pressed` 按钮版本保留 |
| `notice` 宏、`.notice` | `pages.css` 的 `.overview-state-notice`（默认、`data-state="error"`、stale 警告色） | 加 success / info 两种语气、图标和关闭按钮 |
| `progress_bar` 宏、`.progress-bar` | `pages.css` 的 `.telegram-join-progress`（4px、圆角、品牌色填充） | 加 `role="progressbar"`、标签和百分比、语气色 |
| `status_dot`、`tag`、`count_badge`、`avatar` | `.table-status-dot`、`.sm-badge`、`.notification-unread-badge`、`.platform-user-avatar` / `.sm-avatar` | 数值不变；`count-badge` 加 `brand` / `neutral` 两种 |
| `timeline` 宏、`.timeline` | `pages.css` 的 `.auction-timeline`（58px 时间列、13px 行） | 行之间加细分隔线 |
| `selection_bar` 宏、`Kit.ui.Selection` | `.platform-user-batch-bar`（品牌淡底）、`.dialog-selection-bar`，计数逻辑来自各业务列表 | 计数、全选半选、清空做成通用的 `data-selection-bar` |
| `disclosure` 宏 | `pages.css` 的 `.overview-detail-disclosure`（无原生标记、右侧 chevron 旋转） | 第一次抽取只带了 `.disclosure-panel` 的边框；这次补 summary 样式和宏 |
| 选项卡滑动底线 | `static/ui/page-structure.js` 的 `bindTabMotion`、`components.css` 的 `.motion-tabs` | 并入 `Kit.ui.Tabs`；面板淡入 160ms；修了一个会让 MutationObserver 自触发的写法（见下文） |
| `pagination` 的每页条数和跳页 | `static/ui/pagination.js` 的 `.list-pagination-size` / `.list-pagination-jump` | 改为服务端链接：下拉的选项值是 URL，跳页是原生 GET 表单 |
| 两级侧栏菜单 | 无。原项目侧栏只有分组标题 + 一级条目（`dashboard.html` 131–173 行） | kit 新增：父项为 `aria-expanded` 按钮，样式沿用 `.nav-item` 的 Token |
| `loading.js` 的控制器 | `static/loading_controller.js`（LoadingController：150 / 450 / 120 / 100ms，按 scope 去重，cancel / fail） | 逻辑原样移植成闭包；新增 `Kit.loading.run(host, task)` 把它接到 `Kit.ui.LoadingState` 遮罩上，失败变成带重试的错误遮罩（原项目由各业务 loader 自己处理） |
| `loading.js` 的视口跟随、`.page-list-loading-content`、`.loading-viewport-fallback` | `static/ui/loading-viewport.js`、`overlays.css` 124 / 127 行 | 原样移植；作用域从 `.content-section.active` 改为 `.main` |
| `page_header(loading=true)`、`.page-title-loading` | `pages.css` 1117–1118 行 | 同样的 20px 占位；`Kit.loading.title()` 切换 |
| `loading_dots` 宏、`.loading-dots` | `startup_loading.html` 的三个跳动圆点 | 缩小到 8px 用于行内 |
| `.header-icon-button[aria-busy]` | `shell.css` 的 `.mobile-site-refresh[aria-busy="true"]` | 推广到所有顶栏图标按钮 |
| `startup.html`、`DESIGN_KIT_STARTUP_SPLASH` | `templates/startup_loading.html`（内联关键样式、`data-startup-pending`、样式表 `media="print"` 切换、4s 慢网提示、15s 超时、bfcache 释放、`whenReady`）；`ui_styles.html` 的链接写法 | 机制一致，改为配置开关、品牌标记用 kit 的 Logo 或文字方块；没带 Joker 插画和“登录后跳转不再显示”的 sessionStorage 逻辑 |
| 图标 `filter`、`settings`、`panel-right` | `filters.js`、`tables.js` 里的内联 SVG 路径；`panel-right` 来自 Lucide | 加进 `icons.svg` |

说明：

- **原项目没有多级菜单。** 两级侧栏是 kit 自己加的，视觉上只用现有 Token（缩进 28px、左侧 1px 分隔线、子项 13px）。
- **原项目现在没有侧边抽屉。** 回复调试抽屉在 2026-10-23 的 `a7d4997` 一起删掉了，kit 的抽屉尺寸和动画时长取自删除前的 CSS，行为改用弹窗那一套，所以抽屉也有遮罩（原来没有）。
- **“切换页面”**：原项目是单页应用，用 `.content-section.active` 切换区块；kit 是多页应用，页面切换靠链接 + 顶部进度条，这部分第一次抽取已经接好。这次补的是页面内部的切换：选项卡底线滑动、分段控件、步骤条、面包屑。
- 弹出层和菜单使用 `popover="manual"`，这是第一次抽取时行操作菜单已经用的办法；原项目的 `filters.js` 和 `tables.js` 用的是 `position: fixed` 加 z-index。

## 没有带走的内容

- 业务页面样式：`pages.css` 的业务部分、`account-detail.css`、`business-lists.css`、`runtime-settings.css`。
- 品牌：`brand.css`、`templates/brand_logo.html`、`static/brand/` 下的 Joker Logo 和 favicon、启动画面里的 Joker 插画（画面本身已作为可选项带走）。
- 业务交互：账号切换、自动化总开关、通知中心的轮询和接口（`notification-center.js` 的 `load` / `update`）、加入群聊弹窗、未保存提醒（`unsaved-changes.js`）、表单字段规则（`form-feedback.js`、`form-contracts.js`）、可搜索实体选择器（`channel-target-picker.js`）。
- 手机软键盘适配（`runtime.js`）。kit 只同步 `--ui-viewport-height` / `--ui-viewport-top` 两个变量，键盘弹出时的滚动补偿没有带走。

需要这些功能时，可以回到原项目对应文件按同样的方式抽取。

## 对原项目问题的修复

1. **按钮变体背景色。** 原项目 `.btn-ghost`、`.btn-link`、`.btn-segment`、`.btn-menu` 用 `:where()` 写，特异性为 0，会输给 `base.css` 里的 `button { background: var(--brand) }`，结果文字按钮变成品牌色实心按钮。原项目给 `.btn-segment` 在 `pages.css` 里用 ID 选择器单独补了样式（`#overviewDashboardBody .ops-tabs button.btn-segment`）。kit 把这几个变体的颜色改为 `button.btn-x` 特异性。我在 kit 演示页截图里看到了修复前后的差别；原项目页面里没有逐一截图确认。
2. **登录页品牌标记。** 原规则 `.login-brand span` 本意是副标题，但也会命中 kit 的文字品牌方块，导致字母错位。kit 收窄为 `.login-brand > div > span`。
3. **行内开关状态。** 原 `ui-system.js` 在把“更多操作”按钮加入行之前，就调用 `group.insertBefore(status, trigger)`。按 DOM 规范，参照节点不在父节点里时会抛出 `NotFoundError`，所以行操作里有开关时这段代码会出错。这是读代码得出的结论，我没有在原项目里运行复现。kit 改为直接追加。
4. **写死的阴影颜色** 提成了 Token，数值换算保持一致（`#0002` → `rgba(0,0,0,.133)`，`#00000015` → `rgba(0,0,0,.082)`）。
5. **选项卡底线的观察者。** 原 `page-structure.js` 的 `bindTabMotion` 用 MutationObserver 监听 `class` 变化，kit 第一版移植时在回调里又给容器加类，结果回调无限触发（Chromium 页面卡死）。原项目的回调没有改容器的类，所以没有这个问题；kit 改为只在类真正变化时写入。
6. **鼠标打开的菜单按 Esc。** 原 `filters.js` / `tables.js` 的弹层在 `document` 上监听 Esc；kit 的下拉菜单一开始只处理菜单内的 Esc，鼠标打开后焦点还在按钮上时 Esc 无效，已改为按钮上的 Esc 也关闭。

## kit 新增的内容

- Flask Blueprint、配置项、`kit` 模板全局变量、资源内容哈希（缓存刷新用）。
- 布局：`layout.html`（应用页）、`auth_layout.html`（登录页）。
- 宏：`icon`、`page_header`、`panel_head`、`empty_state`、`error_state`、`loading_state`、`status_chip`、`inline_status`、`metric_card`、`switch`、`password_field`、`link_tabs`、`active_filters`、`pagination`、`modal`、`flash_messages`、`nav_menu`、`theme_options`。
- 链接按钮样式（`a.btn-primary` 等）、链接选项卡、链接分页、`.page-content` 容器、`.settings-rows`。
- 多页面应用的进度条接线：站内链接和表单提交时开始，页面 `load` 后结束，从前进后退缓存恢复时清除。
- `Kit.modal.confirm()`、`Kit.modal.onClose()`、选项卡按 `aria-controls` 切换面板、`data-primary-visible`、`data-icon`。
- 第二批：两级侧栏菜单、`Kit.badge`、抽屉、`Kit.loading`（加载生命周期、视口跟随、标题加载位、三个点、可选启动画面）、`Kit.popover` / `Kit.menu` / `Kit.tableSettings`、`Kit.ui.Selection`、面包屑、步骤条、分段控件、横幅、进度条、状态点、标签、计数角标、头像、时间线、折叠面板、消息列表、分页的每页条数和跳页。
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
