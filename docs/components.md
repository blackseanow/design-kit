# 组件用法

每个组件给出宏写法和对应的 HTML 结构。宏都在 `design_kit/macros.html`，按需导入：

```jinja
{% from "design_kit/macros.html" import page_header, panel_head, empty_state, modal %}
```

演示页 `/components` 里能看到下面所有组件的实际效果。

## 页面结构

```jinja
{% extends "design_kit/layout.html" %}
{% block content %}
  {% call page_header("任务列表", "一句话说明这个页面做什么。", count="共 57 条") %}
    <button class="btn-primary" type="button" data-modal-open="createModal">新建任务</button>
  {% endcall %}
  <section class="panel">…</section>
{% endblock %}
```

- `page_header(title, description, help, count)`：`help` 会在标题旁加帮助图标；call 块里写右侧操作。
- 页面标题区的按钮是 32px；手机上有 2 个以上操作时，操作单独占一行。
- 页面内容在 `.page-content` 里，区块之间自动隔 24px。

### 两级侧栏菜单

`nav_groups` 里的条目可以带 `children`，父项变成展开/收起按钮，子项是链接：

```python
{"label": "组件", "icon": "sliders-horizontal", "id": "navComponents", "children": [
    {"label": "基础组件", "href": url_for("components"), "endpoint": "components"},
    {"label": "弹层与导航", "href": url_for("overlays"), "endpoint": "overlays"},
]}
```

- 子项是当前页时父项自动展开并高亮（`has-active`）；其余父项按 `expanded` 决定初始状态。
- 点击父项只展开或收起，不跳转，也不会关闭手机抽屉。
- `id` 可省略，会生成 `navGroup{组序号}-{条目序号}`。
- JS：`Kit.shell.setNavGroupOpen(button, true)`。
- 只支持两级。再深的层级建议拆成子页面的 `link_tabs`。

### 面包屑和步骤条

```jinja
{{ breadcrumb([{"label": "任务列表", "href": url_for("records")}, {"label": "示例任务 01"}], back=true) }}
{{ steps(["填写信息", {"label": "验证", "hint": "等待确认"}, "完成"], current=2) }}
```

- 面包屑最后一项是当前页（`aria-current="page"`），`back=true` 给第一项加返回箭头。
- 步骤条 `current` 从 1 开始；之前的步骤打勾，当前步骤品牌色。`vertical=true` 竖排。手机上横向滚动，不截断中文。

### 顶栏图标和提醒角标

```jinja
{% block header_actions %}
  {{ notification_bell(count=unread, popover="notificationPopover") }}   {# 或 modal="…" / href="…" #}
  {{ header_icon_button("settings", "设置", href=url_for("settings")) }}
{% endblock %}
```

- 角标超过 99 显示 `99+`，为 0 时隐藏；按钮的 `aria-label` 会带上“N 条未读”。
- JS 更新：`Kit.badge.set("notificationBell", 12)`。
- 消息列表用 `notification_item(title, message, meta, read, id, active_label)`，放在弹出层或弹窗里；未读项前面有品牌色圆点。

## 面板

```jinja
<section class="panel">
  {% call panel_head("最近更新", "最新的 5 条") %}
    <a class="btn-secondary" href="…">全部</a>
  {% endcall %}
  …内容…
</section>
```

## 按钮

| 类名 | 用途 |
| --- | --- |
| `<button>`（不加类）或 `.btn-primary` | 主操作，品牌色 |
| `.btn-secondary` | 次操作，白底细边框 |
| `.btn-ghost` | 文字操作，悬停时淡品牌底 |
| `.btn-auxiliary` | 表单里的辅助操作，如“测试连接” |
| `.btn-danger` / `.btn-danger-outline` / `.btn-danger-text` | 危险操作的三个强度 |
| `.btn-link` | 行内链接样式 |
| `.btn-icon` | 32px 图标按钮，必须写 `aria-label` |
| `.btn-delete-icon` | 行内删除，平时灰色，悬停变红 |
| `.btn-small` | 小号修饰类 |
| `.text-button` | 纯文字按钮 |

链接也可以用 `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger` 做成按钮外观。

高度规则：默认 40px；页面标题区、面板标题区、工具栏、行操作、批量选择条里 32px；弹窗底部 40px；≤768px 时默认 44px（紧凑位置 32px，页面标题区和 `.btn-small` 40px）。这些都由两个自定义属性决定：`--button-height` 和 `--button-padding`。上面这些容器在自己身上设置它们，里面的按钮和链接按钮自动跟随；`.btn-small` 在按钮自己身上设置。新位置想要紧凑尺寸，给容器写 `--button-height: var(--compact-height); --button-padding: 0 12px` 即可，不用再写按钮选择器。下拉、日期、时间的触发按钮是字段，始终保持 40px（手机 44px）。

加载态：

```js
await Kit.ui.runButtonAction(button, "保存中", () => fetch(...));
```

## 表单

```html
<div class="form-grid">
  <label><span>名称</span><input name="name" required></label>
  <label><span class="field-label">时区{{ help_button("只影响显示。", "时区说明") }}</span>
    <select name="tz"><option>Asia/Shanghai</option></select>
  </label>
  <label class="wide-label"><span>备注</span><textarea name="note"></textarea></label>
</div>
```

- `label > span:first-child` 是字段名；必填字段自动加灰色 `*`。
- `.wide-label` 占满两列。
- 错误：给字段加 `aria-invalid="true"`，在下面放 `<span class="field-error">原因</span>`。
- 设置页的“左标签、右控件”整行布局：给 `.form-grid` 再加 `.settings-rows`。
- 分组：`.settings-form-section`（设置页）或 `.modal-form-section`（弹窗）。

### 下拉

所有 `<select>`（不含 `multiple`）都会自动增强。原生的 `<select>` 留在表单里，负责提交和 `change` 事件。

```html
<select name="city" data-searchable="true" data-search-placeholder="搜索城市" data-empty-label="暂无城市">…</select>
<select name="raw" data-native>…</select>   <!-- 不增强 -->
```

用 JS 改了 `select.value` 之后，调用 `Kit.select.sync(select)` 刷新显示。

### 日期和时间

```html
<input type="date" name="start" value="2026-10-26">     <!-- 日历菜单，值是 YYYY-MM-DD -->
<input type="time" name="at" value="09:30">              <!-- 每 30 分钟一个选项 -->
<input name="exact" data-time-editable="true" value="08:45" aria-label="精确时间">  <!-- 可输入 -->
```

增强后输入框变成 `type="hidden"`（可输入时间变成 `type="text"`），所以浏览器自带的 `required` / `min` / `max` 校验不再生效，需要在服务端校验。

### 开关、密码

```jinja
{{ switch("auto_run", "自动执行", checked=true) }}
{{ password_field("password", "密码", autocomplete="current-password") }}
```

### 图形验证码

```jinja
{{ captcha_field("captcha", "验证码", url_for("captcha_image")) }}
```

- 输入框在左，验证码图片（120×40，移动端随输入框变为 44px 高）和"换一张"在右。
- `image_url` 每次请求都要返回新图片，并带 `Cache-Control: no-store`。点"换一张"时，ui.js 在地址后加 `_cb=时间戳` 重新加载，清空输入框并聚焦。
- 换图后在按钮上触发 `kit:captcha-refresh`（冒泡，`detail` 含 `input`、`image`），需要同时刷新其他状态时监听它。
- 可选参数：`id`、`refresh_label`、`image_alt`（默认"图形验证码"）、`maxlength`（默认 8）、`required`。
- 验证失败时和其他字段一样：输入框加 `aria-invalid="true"`，下面放 `<span class="field-error">原因</span>`，同时换一张新图。

## 状态标签和行内提示

```jinja
{{ status_chip("运行中", "success") }}   {# tone: "" success warning error info #}
{{ inline_status("保存失败：网络超时", "error") }}
```

## 选项卡

客户端切换（同一页面内的面板）：

```html
<div class="tabs" role="tablist" aria-label="记录类型">
  <button type="button" role="tab" aria-selected="true" aria-controls="panelAll" id="tabAll">全部</button>
  <button type="button" role="tab" aria-selected="false" aria-controls="panelDone" id="tabDone">已完成</button>
</div>
<div id="panelAll" role="tabpanel" aria-labelledby="tabAll">…</div>
<div id="panelDone" role="tabpanel" aria-labelledby="tabDone" hidden>…</div>
```

选中项下面的 2px 底线会滑动到新位置，面板切换时淡入 160ms；`prefers-reduced-motion` 时不动画。

服务端子页面（每个选项是一个链接）：

```jinja
{{ link_tabs([{"label": "基本信息", "href": url_for("settings"), "active": true}, {"label": "通知", "href": url_for("notify")}]) }}
```

## 表格和行操作

```html
<div class="table-wrap">
  <table class="console-data-table">
    <thead><tr><th>名称</th><th>状态</th><th class="table-actions-heading"><span class="sr-only">更多操作</span></th></tr></thead>
    <tbody>
      <tr>
        <td><strong>示例任务</strong><small>ID 1</small></td>
        <td>{{ status_chip("运行中", "success") }}</td>
        <td><div class="list-row-actions">
          <button type="button">查看详情</button>
          <button type="button">编辑</button>
          <button type="button" class="danger-text">删除</button>
        </div></td>
      </tr>
    </tbody>
  </table>
</div>
{{ pagination(page, pages, total, "records", {"q": q}, start, end) }}
```

- 宽表在 `.table-wrap` 里横向滚动，超宽时容器可以用键盘聚焦和滚动。4 列及以上的表格最小 680px；1–3 列的表格直接适应容器宽度，手机上不用滑。任何表格加 `.table-fit` 都按容器宽度排；在容器上设 `--table-min-width` 可以换一个下限。
- 最后一列在 `.page-content` 里固定在右侧。
- 操作列的表头放一个 `.sr-only` 文字（空表头读屏无法命名）。`.list-row-actions` 里的按钮全部收进“更多操作”菜单；菜单图标根据按钮文字自动选择，也可以用 `data-icon` 指定。
- 行里的开关 `<label><input class="toggle-switch-input" type="checkbox"></label>` 也会收进菜单，行内留一个“已启用/已暂停”状态。
- 行密度：`data-density="compact"` 或 `"expanded"`。
- `pagination` 的 `args` 里不要放 `page`。
- `sizes=[10, 20, 50], size=page_size, size_param="per_page"` 加“每页”下拉（选项值是完整 URL，ui.js 在 `change` 时跳转）；`jump=true` 在左右箭头之间放页码表单，原生 GET 提交。

## 筛选

```jinja
<form class="list-filter-toolbar" method="get" role="search">
  <label class="list-filter-search"><span>搜索</span><input type="search" name="q" value="{{ q }}"></label>
  <label><span>状态</span><select name="status">…</select></label>
  <button class="btn-secondary" type="submit">筛选</button>
</form>
{{ active_filters([{"name": "状态", "value": "失败", "remove_url": url_for("records")}], url_for("records")) }}
```

## 空、错误、加载

```jinja
{% call empty_state("暂无订单", "新订单会显示在这里。") %}
  <a class="btn-secondary btn-small" href="…">新建</a>
{% endcall %}
{{ error_state("读取失败", "服务暂时不可用。", retry_href=request.path) }}
{{ loading_state("正在加载数据") }}
```

JS 版本：`Kit.ui.renderEmpty(host, {...})`、`Kit.ui.renderError(host, {...})`、`Kit.ui.LoadingState({label})`。

### 加载生命周期

加载规则：150ms 内完成的请求什么都不显示，避免闪烁；一旦显示至少停留 450ms；结束后先走满、再淡出 100ms；失败时显示原因和重试，不显示假数据。`Kit.loading.run()` 把这套规则接到一个容器上：

```js
await Kit.loading.run("recordsTable", () => fetch("/api/items").then(render), { label: "正在刷新任务" });
```

- 容器加 `.is-refresh-loading` 和 `aria-busy="true"`，遮罩盖在原内容上面，原内容不动。
- 任务 reject 时遮罩变成错误（`role="alert"`）：标题、错误信息和“重试”按钮，重试会再次运行同一个任务；`run()` 返回的 Promise 也会 reject。选项：`errorTitle`、`errorDescription`、`retryLabel`、`retry: false`。
- 同一个容器再次 `run()` 会取消上一次；`Kit.loading.clear(host)` 手动清掉。
- 容器上触发 `kit:loading-start` / `kit:loading-end`（`detail.ok`）。
- 遮罩里的转圈和文字始终停在容器可见的那一部分（长列表滚动时跟着走）；整个遮罩滚出视口时，在可见区域顶部显示一个固定的小提示条。
- 底层控制器可以单独用：`Kit.loading.begin(scope, {onShow, onComplete, onFade, onHide, onError, immediate})` 返回 `{complete, fail, cancel}`。

### 页面标题的加载位

```jinja
{% call page_header("任务列表", loading=true) %}…{% endcall %}
```

标题后面预留一个 20px 的转圈位，隐藏时也占位，副标题不会跳动。`Kit.loading.title(true)` 显示，`false` 隐藏。顶栏图标按钮加 `aria-busy="true"` 时图标转圈（刷新按钮用）。

### 三个点

`{{ loading_dots("正在生成") }}` 渲染三个跳动的圆点（和启动画面同一个样式），用于行内的短等待，例如“正在生成回复…”。`muted=true` 用辅助文字色。

### 启动画面

`DESIGN_KIT_STARTUP_SPLASH = True` 时，页面先用内联的关键样式画出品牌标记和三个点，再等所有样式表到齐后一次显示页面，避免慢网络下先看到无样式的内容：

- 样式表以 `media="print"` 加载，每个到达时切换为 `all`；DOM 和全部样式表都就绪才释放。
- 4 秒后显示“网络较慢，请稍候”；15 秒超时、某个样式表加载失败、从前进后退缓存恢复都会释放画面，失败时在页面顶部显示“部分页面资源仍未就绪”。
- 需要在样式就绪后再测量布局的脚本用 `Kit.loading.whenReady(fn)`（没开启启动画面时立即执行）。
- `<link onload>` 是内联事件处理器，用 nonce 型 CSP 时需要另外放行。

## 指标卡

```jinja
<div class="metrics-grid">
  {{ metric_card("任务总数", 57, "全部任务") }}
  {{ metric_card("执行失败", 3, "最近 7 天", href=url_for("records", status="failed"), attention=true) }}
</div>
```

桌面 4 列，≤1000px 2 列。

## 分段控件

```jinja
{{ segmented("view", [("list", "列表"), ("board", "看板")], value="list", label="视图") }}
```

单选框驱动，随表单提交。需要纯按钮时写 `<div class="segmented"><button type="button" aria-pressed="true">…</button>…</div>`，ui.js 保证同一时间只有一个按下。和选项卡的区别：分段控件是凸起的选中面，用于切换同一数据的视图；选项卡是底线，用于切换内容区。

## 横幅、进度条、标签

```jinja
{% call notice("读取失败", "服务暂时不可用。", "error") %}<a class="btn-secondary btn-small" href="…">重试</a>{% endcall %}
{{ notice("有 2 项需要处理。", tone="warning", dismissible=true) }}     {# tone: '' info success warning error #}
{{ progress_bar(42, label="导入进度") }}                              {# value, max=100, tone, thick #}
{{ status_dot("已启用", "is-on") }}  {{ tag("每日") }}  {{ count_badge(3) }}  {{ avatar("张三") }}
{{ timeline([{"time": "09:12", "title": "任务开始", "status": "运行中", "tone": "success", "text": "说明"}]) }}
```

- 横幅是页面级状态（`role="status"`，error 为 `alert`）；一行以内的反馈用 `inline_status`，操作结果用全局提示。`data-notice-close` 关闭时触发 `kit:notice-close`。
- 进度条只有 4px，带标签时右侧显示百分比；JS 里改 `<span>` 的宽度和 `aria-valuenow`。
- `count_badge` 用在选项卡和菜单项里；`tone`：默认红色、`brand`、`neutral`。
- 时间线：左侧 58px 时间列，右侧标题、状态和说明。

## 批量选择

```jinja
{% call selection_bar("recordsSelection") %}<button class="btn-secondary" type="button">批量暂停</button>{% endcall %}
<div class="table-wrap" data-selection-bar="recordsSelection">
  <table><thead><tr><th><input type="checkbox" data-select-all aria-label="全选"></th>…</tr></thead>
  <tbody><tr><td><input type="checkbox" data-select-row value="1" aria-label="选择 …"></td>…</tr></tbody></table>
</div>
```

勾选后条形区出现并显示数量（`[data-selection-count]`），全选框会同步半选状态；“取消选择”清空。容器上触发 `kit:selection-change`，`detail.selected` 是选中的 value。

## 表格设置（显示列、行密度）

给 `.table-wrap` 加 `id` 和 `data-table-settings`，表头最右侧出现齿轮按钮；弹出层里可以隐藏列、切换紧凑/标准/宽松密度。偏好按表格 id 和列名存在 `localStorage`（`kit:table:…`）。第一个有名字的列、带复选框的列和最后一列不能隐藏；没有操作列时会自动补一列放齿轮。

## 折叠面板

```jinja
{% call disclosure("高级选项", meta="3 项", open=false) %}…{% endcall %}   {# plain=true 去边框；danger=true 红色标题 #}
```

## 弹窗

```jinja
{% call(slot) modal("editItem", "编辑", "说明文字", size="md", form_action=url_for("save")) %}
  {% if slot == "body" %}
    <div class="form-grid">…</div>
  {% else %}
    <button class="btn-secondary" type="button" data-modal-close>取消</button>
    <button class="btn-primary" type="submit">保存</button>
  {% endif %}
{% endcall %}

<button type="button" data-modal-open="editItem">编辑</button>
```

- `size`：`sm` / `md`（512px）、`lg`（640px）、`xl`（880px）。`long=true` 时弹窗先占满可用高度，适合异步加载的长表单。
- 头部和底部固定，正文单独滚动。
- 关闭图标自动加在右上角，不要再在底部放单独的“关闭”按钮。
- `dismissible=false` 时 Esc 和遮罩不能关闭（例如提交中）。
- 底部想显示提示文字时，在操作按钮前放 `<p class="inline-status" role="status">`，按钮用 `<div class="modal-action-group">` 包起来。
- 确认框：`const ok = await Kit.modal.confirm({title, message, confirmLabel: "删除", danger: true})`。
- 事件：弹窗元素上会触发 `kit:modal-open` 和 `kit:modal-close`。

## 抽屉

从侧边滑入的面板，适合详情、长表单和日志。它就是一个弹窗（同样的 `data-modal-open`、焦点圈定、Esc、滚动锁定、`Kit.modal.*`），只是贴在右侧（或 `side="left"`）并且占满高度：

```jinja
{% call(slot) drawer("detailDrawer", "示例任务 01", "说明", size="md") %}
  {% if slot == "body" %}…{% else %}<button class="btn-secondary" type="button" data-modal-close>关闭</button>{% endif %}
{% endcall %}
<button type="button" data-modal-open="detailDrawer">{{ icon('panel-right') }}打开</button>
```

`size`：`sm` 400、`md` 480、`lg` 640、`xl` 1040px；≤768px 时铺满。抽屉里的下拉、日期菜单和弹窗一样留在抽屉内。

## 弹出层

锚定在按钮旁的小对话框。元素留在它被写的位置（表单字段照常提交），浏览器支持 Popover API 时提升到顶层：

```jinja
{{ popover_button("settingsPopover", "显示设置", icon_name="settings") }}
{% call popover("settingsPopover", "显示设置", width=360, align="end") %}
  <label><span>时区</span><select name="tz">…</select></label>
  <div class="popover-actions"><button class="btn-primary btn-small" type="button" data-popover-close>应用</button></div>
{% endcall %}
```

- 任何元素加 `data-popover-open="id"` 都能打开；`data-popover-close` 关闭。
- 打开时聚焦第一个字段（触屏设备聚焦面板本身，避免弹出键盘）；点击外部、焦点移出、Esc 关闭，Esc 会把焦点还给按钮。
- 弹出层里的下拉、日期菜单先关，第二次 Esc 才关弹出层。
- JS：`Kit.popover.open(id, trigger)` / `.close(restoreFocus)` / `.toggle(id, trigger)`；事件 `kit:popover-open`、`kit:popover-close`。

### 筛选弹出层

搜索框留在工具栏，其余筛选字段收进弹出层，按钮显示已生效的数量：

```jinja
<form class="list-filter-toolbar" id="recordsFilterForm" method="get">
  <label class="list-filter-search"><span>搜索</span><input type="search" name="q"></label>
  {% call filter_popover("recordsFilters", count=active_count, reset_href=url_for("records")) %}
    <label><span>状态</span><select name="status">…</select></label>
  {% endcall %}
  <button class="btn-secondary" type="submit">搜索</button>
</form>
```

弹出层里的“筛选”是 `type="submit"`，直接提交 GET 表单；触发按钮放在表单外时传 `form_id`。已生效的条件仍用 `active_filters` 显示成可移除的芯片。

## 下拉菜单

一组操作或单选项，和表格行的“更多操作”菜单同一外观：

```jinja
{{ menu_button("pageMenu", "更多", icon_name="ellipsis", chevron=false, label="页面操作") }}
{% call dropdown_menu("pageMenu", "页面操作") %}
  <div class="dropdown-menu-label">导出</div>
  <button type="button" role="menuitem">{{ icon('copy') }}导出 CSV</button>
  <div class="dropdown-menu-separator"></div>
  <button type="button" role="menuitemradio" aria-checked="true" data-value="30">每 30 秒</button>
  <button type="button" role="menuitem" class="danger-text">清空记录</button>
  <div class="dropdown-menu-footer"><a role="menuitem" href="…">{{ icon('plus') }}新建</a></div>
{% endcall %}
```

- `data-menu-open="id"` 打开；↓ 打开并聚焦第一项（或已选项）；↑↓ Home End 移动；Esc 关闭并回到按钮；Tab 和点击外部关闭。
- `menuitemradio` 点击后互斥勾选并关闭；`menuitemcheckbox` 切换勾选并保持打开；`data-menu-keep` 让任意项保持打开。
- 菜单上触发 `kit:menu-select`，`detail.item` 是被点的项，`detail.value` 取 `data-value` 或文字。
- 菜单会在触发按钮左右两侧自动选对齐方向，或用 `align="start" | "end"` 固定。
- JS：`Kit.menu.open(id, trigger)` / `.close(restoreFocus)`。

## 全局提示

```js
Kit.feedback.show("保存成功。", "success");      // success 3.2s、warning 6s、error 7s 后自动消失
Kit.feedback.show("正在处理…", "loading");       // info 和 loading 默认不自动消失
```

服务端：`flash("已保存", "success")`，页面加载后自动显示（布局已经包含 `flash_messages()`）。

## 顶部进度条

布局里已经包含。点击站内链接、提交表单时开始；页面加载完成时结束。fetch 请求：

```js
const data = await Kit.pageProgress.track(() => fetch("/api/items").then((r) => r.json()));
```

## 外观切换

有 `user_menu` 时，日间/夜间/跟随系统在个人菜单底部；没有时，顶栏右侧显示一个切换按钮。登录页底部也有。
