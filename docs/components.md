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

链接也可以用 `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger` 做成按钮外观（kit 新增，原项目只给 `<button>` 写了样式）。

高度规则：默认 40px；页面标题区、面板标题区、工具栏里 32px；≤768px 时 44px。

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

所有 `<select>`（不含 `multiple`）都会自动增强。原来的 `<select>` 留在表单里，负责提交和 `change` 事件。

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

服务端子页面（每个选项是一个链接）：

```jinja
{{ link_tabs([{"label": "基本信息", "href": url_for("settings"), "active": true}, {"label": "通知", "href": url_for("notify")}]) }}
```

## 表格和行操作

```html
<div class="table-wrap">
  <table class="console-data-table">
    <thead><tr><th>名称</th><th>状态</th><th class="table-actions-heading" aria-label="更多操作"></th></tr></thead>
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

- 宽表在 `.table-wrap` 里横向滚动，超宽时容器可以用键盘聚焦和滚动。
- 最后一列在 `.page-content` 里固定在右侧。
- `.list-row-actions` 里的按钮全部收进“更多操作”菜单；菜单图标根据按钮文字自动选择，也可以用 `data-icon` 指定。
- 行里的开关 `<label><input class="toggle-switch-input" type="checkbox"></label>` 也会收进菜单，行内留一个“已启用/已暂停”状态。
- 行密度：`data-density="compact"` 或 `"expanded"`。
- `pagination` 的 `args` 里不要放 `page`。

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

## 指标卡

```jinja
<div class="metrics-grid">
  {{ metric_card("任务总数", 57, "全部任务") }}
  {{ metric_card("执行失败", 3, "最近 7 天", href=url_for("records", status="failed"), attention=true) }}
</div>
```

桌面 4 列，≤1000px 2 列。

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
