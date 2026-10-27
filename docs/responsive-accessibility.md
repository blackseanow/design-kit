# 响应式和无障碍

## 断点

断点以代码为准。

| 宽度 | 变化 |
| --- | --- |
| ≥1600px | 内容区两侧加宽留白，内容最大 1232px 居中 |
| 1024–1200px | 顶栏间距收紧，隐藏用户名 |
| ≤1023px | 侧栏变成左侧抽屉；顶栏变为一行：菜单按钮、品牌、操作、头像 |
| ≤1000px | 指标卡从 4 列变 2 列 |
| ≤768px | 表单一列；按钮和输入框最小 44px；输入框字号 16px；页面标题 20px；面板内边距 16px；全局提示移到顶部 |
| ≤768px | 抽屉铺满宽度；弹出层宽度 `min(360px, 100vw - 24px)`；步骤条和分段控件横向滚动而不是截断；下拉菜单项 44px |
| ≤480px | 登录面板内边距收紧 |
| ≤360px | 手机顶栏隐藏产品名文字，只留品牌方块 |

## 规则

- 页面在 320px 宽度下不能出现横向滚动条。宽表格在自己的容器里横向滚动，不能用 `body { overflow: hidden }` 掩盖溢出。
- 手机上表单通常单列，筛选工具栏可以换行。
- 弹窗高度跟随可视区域（`visualViewport`），头尾不参与滚动；安全区用 `env(safe-area-inset-*)`。
- 触控目标至少 44px（按钮、行操作按钮、菜单项、关闭按钮）。
- 所有可操作元素都能用键盘到达，并有可见的焦点样式。
- 图标按钮必须有 `aria-label`；装饰性图标加 `aria-hidden="true"`（`icon()` 宏已经加了）。
- 弹窗和抽屉：`role="dialog"`、`aria-modal="true"`、`aria-labelledby` 指向标题（`modal.js` 自动设置）。
- 弹出层：`role="dialog"` + `aria-label`；触发按钮 `aria-haspopup="dialog"`、`aria-expanded`、`aria-controls`（宏已经加了）。
- 下拉菜单：`role="menu"`，项是 `menuitem` / `menuitemradio` / `menuitemcheckbox`；触发按钮 `aria-haspopup="menu"`。
- 两级菜单的父项是 `<button aria-expanded aria-controls>`，子项列表用 `hidden` 收起。
- 角标 `aria-hidden="true"`，未读数写进按钮的 `aria-label`。
- 空状态 `role="status"`，错误状态 `role="alert"`，全局提示按类型使用 `status` 或 `alert`。
- `prefers-reduced-motion: reduce` 时关闭动画，进度条仍然会正确结束。

## 验证范围

- 已在 Chromium（Playwright）里检查 1440、390、320px，日间和夜间。
- 390×844、320×640 是浏览器模拟尺寸，不等于真机。iOS / Android 真机触摸、软键盘、系统读屏没有测试过。
