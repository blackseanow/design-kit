# Design Kit（Flask + Jinja）

这是从原项目 [blackseanow/temp10](https://github.com/blackseanow/temp10) 的生产样式里抽出来的通用设计规范包，给第二个 Flask 项目直接复用。内容包括：

- 1 个 Token 文件（颜色、字体、间距、圆角、尺寸、动效，含日间和夜间两套）
- 8 个组件 CSS 文件，9 个 JS 模块（无框架、无构建步骤）
- Jinja 布局（应用页、登录页）和宏
- 一个用虚构数据运行的演示应用
- Python、Node 和浏览器测试

这是一个独立仓库，不依赖原项目，原项目也不包含这些文件。

## 目录

```
design-kit/
  design_kit/                Flask Blueprint 包（复制或 pip 安装这个目录）
    __init__.py              DesignKit(app)、配置项、资源加载顺序
    static/                  tokens.css 等 8 个 CSS、9 个 JS、icons.svg、icons/（Lucide，ISC 许可）
    templates/design_kit/    layout.html、auth_layout.html、macros.html、head.html、scripts.html
  demo/                      演示应用（虚构数据，只在本机运行）
  tests/                     test_design_kit.py、js/kit.test.js、browser_check.js
  docs/                      规范文档（见下方“文档”）
  pyproject.toml
```

## 接入新项目

**第 1 步：安装。** 二选一：

- 把 `design-kit/design_kit/` 整个目录复制到新项目里，和 `app.py` 放在同一层。
- 或者 `pip install -e /path/to/design-kit`，以后改一处，两个项目都能拿到更新。

**第 2 步：注册。**

```python
from flask import Flask, render_template, url_for
from design_kit import DesignKit

app = Flask(__name__)
app.config.update(
    DESIGN_KIT_BRAND_NAME="新项目",
    DESIGN_KIT_THEME_KEY="newapp-theme",      # 每个项目用自己的 key
    DESIGN_KIT_EXTRA_CSS=["brand.css"],       # 可选：你的品牌色覆盖
)
DesignKit(app)

@app.context_processor
def shell():
    return {
        "nav_groups": [{"title": "工作台", "items": [
            {"label": "总览", "href": url_for("index"), "icon": "layout-dashboard", "endpoint": "index"},
        ]}],
        "user_menu": {"name": "张三", "logout_url": url_for("logout")},
    }
```

**第 3 步：写页面。**

```jinja
{% extends "design_kit/layout.html" %}
{% from "design_kit/macros.html" import page_header, empty_state %}
{% block content %}
  {% call page_header("订单", "查看和处理订单。") %}
    <a class="btn-primary" href="{{ url_for('new_order') }}">新建订单</a>
  {% endcall %}
  <section class="panel">
    {{ empty_state("暂无订单", "新订单会显示在这里。") }}
  </section>
{% endblock %}
```

演示应用 `demo/app.py` 是一个完整例子：列表筛选、分页、表格行操作、弹窗表单、设置页、登录页。

## 配置项

| 配置 | 作用 | 默认值 |
| --- | --- | --- |
| `DESIGN_KIT_BRAND_NAME` | 顶栏和标题里的产品名 | `"Console"` |
| `DESIGN_KIT_BRAND_TAGLINE` | 登录页产品名下面的一行字 | `""` |
| `DESIGN_KIT_BRAND_MARK` | 没有 Logo 时显示的字母 | 产品名第一个字 |
| `DESIGN_KIT_LOGO_LIGHT` / `_DARK` | Logo 图片：应用 static 下的路径或完整 URL | `None` |
| `DESIGN_KIT_THEME_KEY` | 保存日间/夜间选择的 localStorage key | `"app-theme"` |
| `DESIGN_KIT_LANG` | `<html lang>` | `"zh-CN"` |
| `DESIGN_KIT_HOME_URL` | 品牌链接地址 | `"/"` |
| `DESIGN_KIT_EXTRA_CSS` | 在 kit 之后加载的应用 CSS（应用 static 下的路径） | `[]` |

## 改品牌色

不要改组件 CSS。在新项目里建 `static/brand.css`，只覆盖品牌相关的 Token，再通过 `DESIGN_KIT_EXTRA_CSS` 加载。`demo/static/brand-example.css` 是一个可以照抄的例子：

```css
:root {
  --brand: #0f766e; --brand-hover: #0b5f59; --brand-tint: rgba(15,118,110,.08);
  --on-brand: #fff;
  --progress-brand: #0f766e; --progress-glow: 0 0 10px #0f766e,0 0 5px #0f766e;
}
:root[data-theme="dark"] {
  --brand: #5eead4; --brand-hover: #5eead4e0; --brand-tint: rgba(94,234,212,.08);
  --on-brand: #03080a;
  --progress-brand: #5eead4; --progress-glow: 0 0 10px #5eead4,0 0 5px #5eead4;
}
```

用 `DEMO_BRAND_CSS=1 python demo/app.py` 可以看到换色后的效果。示例里的青绿色是随手选的值，你换成自己的颜色后，要检查 `--on-brand` 文字在 `--brand` 背景上的对比度（WCAG AA 要求正文至少 4.5:1）。

关于默认颜色：日间紫色 `#7624f4` 和夜间黄绿色 `#c8ff00` 来自原项目，原项目文档写明这些值是在 OpenRouter 控制台上实测的（见原项目的 `design-reference/openrouter/tokens.json`）。如果第二个项目要对外发布，建议换成自己的品牌色，避免看起来像别家产品。这是我的建议，不是法律意见。

## 必须遵守的规则

1. **颜色只写在 Token 里。** 组件 CSS 和页面 CSS 只能用 `var(--…)`。`tests/test_design_kit.py` 会扫描 kit 里除 `tokens.css` 外的所有 CSS，发现 `#fff`、`rgba(…)` 这类写法就失败。
2. **加载顺序固定：** tokens → base → shell → components → overlays → page → auth → buttons → 你的 CSS。`head.html` 已经按这个顺序输出。
3. **页面 CSS 不重定义公共 Token 和组件。** 需要新组件时先加进 kit，再在页面里用。
4. **原生字段负责数据。** 下拉、日期、时间控件只替换外观，原来的 `<select>` / `<input>` 仍然提交 `name` 和 `value`，并触发 `change`。
5. **弹窗只有一个关闭入口：** 右上角的关闭图标（自动添加）。`data-modal-dismissible="true"` 时，Esc 和点击遮罩也能关闭。不要用 `window.confirm`，用 `Kit.modal.confirm()`。
6. **空、错、加载三种状态都要有。** 没数据时用 `empty_state`，不填假数字。读取失败时用 `error_state`，写出原因并提供重试。
7. **改公共组件后检查：** 1440 / 1024 / 768 / 390 / 320px，日间和夜间，展开、禁用、关闭和焦点恢复。清单见 `docs/qa-checklist.md`。

## JS 接口（`window.Kit`）

| 接口 | 用途 |
| --- | --- |
| `Kit.feedback.show(message, type, {title, timeout})` | 全局提示；type：`info` `success` `warning` `error` `loading` |
| `Kit.feedback.success(msg)` / `.error(err)` | 快捷写法 |
| `Kit.modal.open(id)` / `.hide(id)` / `.close(id, reason)` | 打开、关闭弹窗；`close` 会检查是否允许关闭 |
| `Kit.modal.confirm({title, message, confirmLabel, danger})` | 返回 `Promise<boolean>`；`danger` 时默认聚焦“取消” |
| `Kit.modal.onClose(id, fn)` | 关闭前回调；返回 `false` 可阻止关闭（例如请求进行中） |
| `Kit.ui.runButtonAction(button, "保存中", asyncFn)` | 按钮加载态：禁用、转圈、结束后恢复原内容 |
| `Kit.ui.renderEmpty(host, {title, description})` / `renderError(...)` | 用 JS 渲染空状态和错误状态 |
| `Kit.ui.LoadingState({label})` | 生成加载占位 |
| `Kit.select.sync(select)` / `Kit.datetime.sync(input)` | 用代码改了 value 之后同步显示 |
| `Kit.pageProgress.track(asyncFn)` | 让 fetch 请求驱动顶部进度条 |
| `Kit.theme.setTheme("light" \| "dark" \| "system")` | 切换外观 |

## HTML 属性

| 属性 | 用途 |
| --- | --- |
| `data-modal-open="id"` / `data-modal-close` | 打开 / 关闭弹窗 |
| `data-modal-dismissible="true"` | 允许 Esc 和遮罩关闭 |
| `data-searchable="true"` | 下拉框带搜索（写在 `<select>` 上） |
| `data-native` | 不增强，保留浏览器原生控件 |
| `data-time-editable="true"` | 时间可手动输入，同时保留快捷菜单 |
| `class="title-help-button" data-help="…"` | 帮助图标：悬停或聚焦显示，点击固定 |
| `class="list-row-actions"` | 表格行操作统一收进“更多操作”菜单 |
| `data-primary-visible="true"` | 行操作有 3 个及以上时，第一个保留在行内（kit 新增） |
| `data-icon="copy"` | 指定行操作菜单里的图标 |
| `data-no-progress` | 下载链接不启动顶部进度条 |

## 运行演示和测试

```bash
cd design-kit
pip install Flask==3.1.2
python demo/app.py                                    # http://127.0.0.1:5058/
python -m unittest discover -s tests                  # 16 项：CSS 规则、Blueprint、宏、验证码
node --test tests/js/kit.test.js                      # 14 项：进度条、菜单定位、焦点、主题
PYTHON=python3 node tests/browser_check.js            # 20 项浏览器交互，需要 playwright
```

本仓库目前没有配置 CI，以上命令需要手动运行。

## 验证情况

**已验证（本次实际运行）：**
- Python 测试 16 项、Node 测试 14 项全部通过（Python 3.13.17、Flask 3.1.2、Node 22.22.0；2026-10-26 在提交 8986841 上重新运行）。
- 浏览器检查 20 项全部通过（Playwright + Chromium；2026-10-26 在提交 8986841 上重新运行）：下拉的键盘操作和 Esc、日期和时间选择、同一时间只开一个菜单、帮助气泡、选项卡、行操作菜单、弹窗焦点圈定和焦点返回、弹窗内的下拉菜单、危险确认、按钮加载态、主题保存、服务端 flash 提示、进度条结束、手机侧栏抽屉、320px 无横向滚动、验证码刷新（换图、清空并聚焦输入框）、无控制台错误。
- 截图人工查看：1440px 和 390px，日间和夜间，5 个页面。
- `pip install` 后静态文件、图标、许可证和模板都在包里。

**未验证：**
- Safari、Firefox；iOS / Android 真机；手机软键盘弹出时的弹窗表现。
- 读屏软件（VoiceOver、NVDA）的实际朗读效果。
- 基于 nonce 的 CSP（模板支持 `csp_nonce`，但没有测试）。
- 几千行以上的大表格性能。

## 文档

| 文件 | 内容 |
| --- | --- |
| `docs/design-system.md` | Token 全表、字号、间距、圆角、层级 |
| `docs/components.md` | 每个组件的 HTML 结构和宏用法 |
| `docs/interactions.md` | 键盘、焦点、关闭规则 |
| `docs/responsive-accessibility.md` | 断点和无障碍规则 |
| `docs/qa-checklist.md` | 改动后的检查清单 |
| `docs/extraction-notes.md` | 每个文件的来源、删掉了什么、修了什么、和原项目的差异 |
