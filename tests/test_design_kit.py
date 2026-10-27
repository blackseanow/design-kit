"""Design kit contract tests. Run from design-kit/:  python -m unittest discover -s tests"""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

KIT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT_ROOT))
sys.path.insert(0, str(KIT_ROOT / "demo"))

from flask import Flask, flash, render_template_string  # noqa: E402

from design_kit import SCRIPTS, STYLESHEETS, DesignKit  # noqa: E402

STATIC = KIT_ROOT / "design_kit" / "static"
TEMPLATES = KIT_ROOT / "design_kit" / "templates" / "design_kit"
CSS_FILES = sorted(STATIC.glob("*.css"))
JS_FILES = sorted(STATIC.glob("*.js"))

# Custom properties written by JS at runtime; CSS always reads them with a fallback
# or only after the script has set them.
RUNTIME_PROPERTIES = {"--ui-viewport-height", "--ui-viewport-top", "--overlay-scrollbar-width"}


def strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def declaration_values(css: str):
    """Yield (property, value) for every declaration in innermost blocks."""
    for block in re.findall(r"\{([^{}]*)\}", strip_comments(css)):
        for declaration in block.split(";"):
            if ":" in declaration:
                prop, value = declaration.split(":", 1)
                yield prop.strip(), value.strip()


def defined_properties(css: str) -> set[str]:
    return {prop for prop, _ in declaration_values(css) if prop.startswith("--")}


def token_block(css: str, selector: str) -> str:
    match = re.search(re.escape(selector) + r"\s*\{([^{}]*)\}", strip_comments(css))
    assert match, selector
    return match.group(1)


class CssContractTests(unittest.TestCase):
    def test_every_listed_asset_exists(self):
        for name in (*STYLESHEETS, *SCRIPTS, "icons.svg", "icons/LICENSE"):
            self.assertTrue((STATIC / name).is_file(), name)
        self.assertEqual(sorted(STYLESHEETS), sorted(path.name for path in CSS_FILES))
        self.assertEqual(sorted(SCRIPTS), sorted(path.name for path in JS_FILES))

    def test_colour_literals_only_in_tokens(self):
        literal = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(")
        offenders = []
        for path in CSS_FILES:
            if path.name == "tokens.css":
                continue
            for prop, value in declaration_values(path.read_text()):
                if literal.search(value):
                    offenders.append(f"{path.name}: {prop}: {value}")
        self.assertEqual(offenders, [], "use a token from tokens.css instead")

    def test_used_custom_properties_are_defined(self):
        defined = set()
        for path in CSS_FILES:
            defined |= defined_properties(path.read_text())
        missing = []
        for path in CSS_FILES:
            for name, fallback in re.findall(r"var\((--[\w-]+)\s*(,)?", strip_comments(path.read_text())):
                if name not in defined and name not in RUNTIME_PROPERTIES and not fallback:
                    missing.append(f"{path.name}: {name}")
        self.assertEqual(sorted(set(missing)), [])

    def test_dark_theme_only_overrides_existing_tokens(self):
        tokens = (STATIC / "tokens.css").read_text()
        light = {prop for prop, _ in declaration_values("{" + token_block(tokens, ":root") + "}") if prop.startswith("--")}
        dark = {prop for prop, _ in declaration_values("{" + token_block(tokens, ':root[data-theme="dark"]') + "}") if prop.startswith("--")}
        self.assertTrue(dark, "dark block parsed")
        self.assertEqual(sorted(dark - light), [])
        for brand in ("--brand", "--brand-hover", "--brand-tint", "--on-brand", "--progress-brand"):
            self.assertIn(brand, dark)

    def test_css_icon_masks_exist(self):
        for path in CSS_FILES:
            for name in re.findall(r'url\("icons/([\w-]+\.svg)"\)', path.read_text()):
                self.assertTrue((STATIC / "icons" / name).is_file(), f"{path.name} -> {name}")

    def test_sprite_symbols_used_by_templates_and_scripts_exist(self):
        symbols = set(re.findall(r'<symbol id="([^"]+)"', (STATIC / "icons.svg").read_text()))
        sources = [*TEMPLATES.glob("*.html"), *(KIT_ROOT / "demo" / "templates" / "demo").glob("*.html"), *JS_FILES, KIT_ROOT / "demo" / "app.py"]
        used = set()
        for path in sources:
            text = path.read_text()
            used |= set(re.findall(r"""(?:icon|icon_href|iconMarkup)\(\s*['"]([\w-]+)['"]""", text))
            used |= set(re.findall(r"""['"]icon['"]\s*:\s*['"]([\w-]+)['"]""", text))
            used |= set(re.findall(r"""return\s+['"]([\w-]+)['"];""", text)) if path.name == "ui.js" else set()
        self.assertTrue(used)
        self.assertEqual(sorted(used - symbols), [])

    def test_no_source_project_business_terms(self):
        banned = re.compile(r"Telegram|TGAI|tgai|JOK|Joker|账号|竞拍|兑换|发言|群聊|频道|OpenRouter", re.I)
        hits = []
        for path in (KIT_ROOT / "design_kit").rglob("*"):
            if path.is_file() and path.suffix in {".css", ".js", ".html", ".py"}:
                for number, line in enumerate(path.read_text().splitlines(), 1):
                    if banned.search(line):
                        hits.append(f"{path.relative_to(KIT_ROOT)}:{number}: {line.strip()[:80]}")
        self.assertEqual(hits, [])


class BlueprintTests(unittest.TestCase):
    def make_app(self, **config):
        app = Flask(__name__, template_folder=str(KIT_ROOT / "tests"))
        app.config.update(SECRET_KEY="test", TESTING=True, **config)
        DesignKit(app)
        return app

    def test_layout_loads_assets_in_contract_order(self):
        from app import create_app
        app = create_app({"TESTING": True})
        html = app.test_client().get("/").get_data(as_text=True)
        css = re.findall(r'href="/_design-kit/([\w-]+\.css)\?v=[0-9a-f]{12}"', html)
        js = re.findall(r'src="/_design-kit/([\w-]+\.js)\?v=[0-9a-f]{12}"', html)
        # The demo turns the startup splash on, so each sheet appears twice: the
        # media="print" link and its <noscript> fallback, both in contract order.
        self.assertEqual(css, list(STYLESHEETS) * 2)
        self.assertEqual(html.count("<noscript>"), 1)
        self.assertEqual(js, list(SCRIPTS))
        self.assertIn('data-theme-key="design-kit-demo-theme"', html)
        self.assertRegex(html, r'<meta name="design-kit-icons" content="/_design-kit/icons\.svg\?v=[0-9a-f]{12}">')
        # The theme bootstrap runs before the first stylesheet.
        self.assertLess(html.index("root.dataset.theme ="), html.index("tokens.css"))

    def test_demo_pages_render(self):
        from app import create_app
        client = create_app({"TESTING": True}).test_client()
        for path in ("/", "/records", "/records?q=zzz", "/records?error=1", "/records?status=failed&page=2",
                     "/records?owner=%E7%A4%BA%E4%BE%8B%E6%88%90%E5%91%98+B&per_page=20", "/components", "/overlays", "/settings", "/login"):
            self.assertEqual(client.get(path).status_code, 200, path)
        self.assertIn("没有匹配的任务", client.get("/records?q=zzz").get_data(as_text=True))
        self.assertIn('role="alert"', client.get("/records?error=1").get_data(as_text=True))

    def test_static_files_are_served(self):
        client = self.make_app().test_client()
        for name in ("tokens.css", "core.js", "icons.svg", "icons/x.svg"):
            response = client.get(f"/_design-kit/{name}")
            self.assertEqual(response.status_code, 200, name)
            response.close()

    def test_brand_settings(self):
        app = self.make_app(DESIGN_KIT_BRAND_NAME="Beta 平台", DESIGN_KIT_LOGO_LIGHT="brand/logo.svg",
                            DESIGN_KIT_THEME_KEY="beta-theme", DESIGN_KIT_EXTRA_CSS=["brand.css"])
        with app.test_request_context("/"):
            html = render_template_string('{% extends "design_kit/layout.html" %}{% block content %}x{% endblock %}')
        self.assertIn("<title>Beta 平台</title>", html)
        self.assertIn('data-theme-key="beta-theme"', html)
        self.assertIn('src="/static/brand/logo.svg"', html)
        self.assertIn('href="/static/brand.css"', html)
        self.assertLess(html.index("buttons.css"), html.index("/static/brand.css"), "app CSS loads after the kit")

    def test_text_brand_mark_without_logo(self):
        app = self.make_app(DESIGN_KIT_BRAND_NAME="beta")
        with app.test_request_context("/"):
            html = render_template_string('{% from "design_kit/macros.html" import brand_mark %}{{ brand_mark() }}')
        self.assertIn('class="brand-mark brand-mark-text"', html)
        self.assertIn(">B<", html)

    def test_macros(self):
        app = self.make_app()

        @app.get("/items")
        def items():
            return ""

        source = """{% from "design_kit/macros.html" import page_header, empty_state, pagination, modal, status_chip, nav_menu, flash_messages %}
{% call page_header("标题", "说明", count="共 3 条") %}<button>新建</button>{% endcall %}
{{ empty_state("暂无数据") }}
{{ pagination(1, 3, 25, "items", {"q": "a"}, 1, 10) }}
{{ status_chip("失败", "error") }}
{% call(slot) modal("m1", "弹窗", dismissible=false) %}{% if slot == "body" %}BODY{% else %}ACTIONS{% endif %}{% endcall %}
{{ nav_menu([{"title": "组", "items": [{"label": "列表", "href": "/items", "endpoint": "items"}, {"label": "其他", "href": "/x"}]}], "items") }}
{{ flash_messages() }}"""
        with app.test_request_context("/items"):
            flash("已保存", "success")
            flash("出错了", "danger")
            html = render_template_string(source)
        self.assertIn('<div class="content-page-actions"><button>新建</button></div>', html)
        self.assertIn('data-ui-component="EmptyState" role="status"', html)
        self.assertIn('data-page-prev href="#" aria-label="上一页" aria-disabled="true"', html)
        self.assertIn('href="/items?page=2&amp;q=a"', html)
        self.assertIn('<span class="status-chip error">失败</span>', html)
        self.assertIn('data-modal-dismissible="false"', html)
        self.assertIn('<div class="modal-body">BODY</div>', html)
        self.assertIn('<div class="modal-actions">ACTIONS</div>', html)
        self.assertEqual(html.count('aria-current="page"'), 1)
        self.assertIn('data-kit-flash="success">已保存', html)
        self.assertIn('data-kit-flash="error">出错了', html)

    def test_captcha_field_macro(self):
        app = self.make_app()
        source = """{% from "design_kit/macros.html" import captcha_field %}
{{ captcha_field("captcha", "验证码", "/captcha.svg?k=1") }}
{{ captcha_field("code", "校验码", "/c.svg", id="signupCode", refresh_label="看不清", maxlength=6, required=false) }}"""
        with app.test_request_context("/"):
            html = render_template_string(source)
        self.assertIn('<label for="captcha">', html)
        self.assertIn('<input id="captcha" name="captcha" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="8" required>', html)
        self.assertIn('<img class="captcha-image" src="/captcha.svg?k=1" alt="图形验证码" width="120" height="40" data-captcha-image="captcha">', html)
        self.assertIn('<button class="btn-link captcha-refresh" type="button" data-captcha-refresh="captcha">换一张</button>', html)
        self.assertIn('<input id="signupCode" name="code" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="6">', html)
        self.assertIn('data-captcha-refresh="signupCode">看不清</button>', html)

    def test_demo_captcha_image_is_not_cached(self):
        from app import create_app
        response = create_app({"TESTING": True}).test_client().get("/demo-captcha.svg")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Content-Type"], "image/svg+xml")
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertTrue(response.get_data(as_text=True).startswith("<svg"))

    def test_nested_nav_menu(self):
        app = self.make_app()
        groups = [{"title": "组", "items": [
            {"label": "首页", "href": "/", "endpoint": "home"},
            {"label": "报表", "icon": "activity", "id": "navReports", "children": [
                {"label": "日报", "href": "/daily", "endpoint": "daily"},
                {"label": "月报", "href": "/monthly", "endpoint": "monthly"},
            ]},
            {"label": "其他", "icon": "users", "children": [{"label": "子项", "href": "/x", "endpoint": "x"}]},
        ]}]
        with app.test_request_context("/daily"):
            html = render_template_string('{% from "design_kit/macros.html" import nav_menu %}{{ nav_menu(groups, "daily") }}', groups=groups)
        self.assertIn('class="nav-item nav-item-parent has-active" type="button" aria-expanded="true" aria-controls="navReports"', html)
        self.assertIn('<div class="nav-subitems" id="navReports">', html)
        self.assertIn('class="nav-item nav-subitem active" href="/daily" aria-current="page"', html)
        self.assertEqual(html.count('aria-current="page"'), 1)
        # A group without the current page starts collapsed and gets a generated id.
        self.assertIn('aria-expanded="false" aria-controls="navGroup1-3"', html)
        self.assertIn('<div class="nav-subitems" id="navGroup1-3" hidden>', html)
        self.assertIn('icons.svg?v=', html)

    def test_header_badge_and_bell(self):
        app = self.make_app()
        source = """{% from "design_kit/macros.html" import header_icon_button, notification_bell %}
{{ notification_bell(count=3, modal="inbox") }}
{{ notification_bell(count=0, popover="inboxPopover", id="bell2") }}
{{ header_icon_button('bell', '提醒', badge=120, href='/inbox') }}"""
        with app.test_request_context("/"):
            html = render_template_string(source)
        self.assertIn('id="notificationBell" aria-label="消息中心，3 条未读" data-badge-label="消息中心" data-modal-open="inbox" aria-haspopup="dialog"', html)
        self.assertIn('<span class="header-badge" id="notificationBellBadge" aria-hidden="true">3</span>', html)
        self.assertIn('id="bell2" aria-label="消息中心" data-badge-label="消息中心" data-popover-open="inboxPopover" aria-haspopup="dialog" aria-expanded="false" aria-controls="inboxPopover"', html)
        self.assertIn('<span class="header-badge" id="bell2Badge" aria-hidden="true" hidden>0</span>', html)
        self.assertIn('<a class="header-icon-button" href="/inbox" aria-label="提醒，120 条未读"', html)
        self.assertIn('aria-hidden="true">99+</span>', html)

    def test_drawer_popover_and_menu_macros(self):
        app = self.make_app()
        source = """{% from "design_kit/macros.html" import drawer, popover, popover_button, filter_popover, dropdown_menu, menu_button %}
{% call(slot) drawer("d1", "详情", side="left", size="xl", dismissible=false) %}{% if slot == "body" %}BODY{% else %}ACTIONS{% endif %}{% endcall %}
{{ popover_button("p1", "设置", icon_name="settings") }}
{% call popover("p1", "显示设置", width=300, align="start") %}FIELDS{% endcall %}
<form id="f1" class="list-filter-toolbar">{% call filter_popover("flt", count=2, reset_href="/items", form_id="f1") %}<label><span>状态</span><select name="s"></select></label>{% endcall %}</form>
{{ menu_button("m1", "更多", icon_name="ellipsis") }}
{% call dropdown_menu("m1", "页面操作", align="end") %}<button type="button" role="menuitem">导出</button>{% endcall %}"""
        with app.test_request_context("/"):
            html = render_template_string(source)
        self.assertIn('<div id="d1" class="modal-backdrop drawer-backdrop drawer-left hidden" data-modal-dismissible="false">', html)
        self.assertIn('<div class="modal-panel drawer-panel drawer-size-xl">', html)
        self.assertIn('<div class="modal-body">BODY</div>', html)
        self.assertIn('data-popover-open="p1" aria-haspopup="dialog" aria-expanded="false" aria-controls="p1"', html)
        self.assertIn('<div id="p1" class="popover-panel" role="dialog" aria-label="显示设置" popover="manual" hidden data-popover-width="300" data-popover-align="start">', html)
        self.assertIn('<button class="popover-close" type="button" data-popover-close aria-label="关闭"></button>', html)
        self.assertIn('<div class="popover-body">FIELDS</div>', html)
        self.assertIn('data-popover-open="flt"', html)
        self.assertIn('<span class="list-filter-count"> · 2</span>', html)
        self.assertIn('<a class="btn-ghost btn-small" href="/items">重置</a>', html)
        self.assertIn('<button class="btn-primary btn-small" type="submit" form="f1">筛选</button>', html)
        self.assertLess(html.index('<select name="s">'), html.index('class="popover-actions"'), "fields come before the actions")
        self.assertIn('data-menu-open="m1" aria-haspopup="menu" aria-expanded="false" aria-controls="m1"', html)
        self.assertIn('<div id="m1" class="dropdown-menu" role="menu" aria-label="页面操作" popover="manual" hidden data-menu-align="end"><button type="button" role="menuitem">导出</button></div>', html)

    def test_small_component_macros(self):
        app = self.make_app()
        source = """{% from "design_kit/macros.html" import breadcrumb, steps, segmented, notice, progress_bar, status_dot, tag, count_badge, avatar, timeline, selection_bar, disclosure, notification_item %}
{{ breadcrumb([{"label": "列表", "href": "/items"}, {"label": "详情"}], back=true) }}
{{ steps(["一", {"label": "二", "hint": "提示"}, "三"], current=2) }}
{{ segmented("view", [("list", "列表"), {"value": "board", "label": "看板"}, "日历"], value="board", label="视图") }}
{% call notice("出错了", "原因", "error") %}<a href="/retry">重试</a>{% endcall %}
{{ notice("已保存", tone="success", dismissible=true) }}
{{ progress_bar(3, 4, label="进度", tone="warning") }}
{{ progress_bar(150, show_value=false) }}
{{ status_dot("已启用", "is-on") }}{{ tag("标签", remove_url="/x") }}{{ count_badge(120) }}{{ count_badge(0, id="c0") }}{{ avatar("张三") }}{{ avatar("Li", src="/a.png", size="lg") }}
{{ timeline([{"time": "09:12", "datetime": "2026-10-26T09:12", "title": "开始", "status": "运行中", "tone": "success", "text": "说明"}]) }}
{% call selection_bar("sel") %}<button type="button">批量</button>{% endcall %}
{% call disclosure("高级", meta="3 项", open=true, danger=true) %}INNER{% endcall %}
{% call notification_item("标题", "正文", ["来源", "时间"], read=false, id="n1", active_label="仍需处理") %}<button type="button">已读</button>{% endcall %}
{{ notification_item("旧", "正文", read=true) }}"""
        with app.test_request_context("/"):
            html = render_template_string(source)
        self.assertIn('<nav class="breadcrumb" aria-label="面包屑">', html)
        self.assertIn('<li><a href="/items"><svg aria-hidden="true"><use href="', html)
        self.assertIn('<li><span aria-current="page">详情</span></li>', html)
        self.assertIn('<li class="complete">', html)
        self.assertIn('<li class="active" aria-current="step">', html)
        self.assertIn('<span class="step-copy"><span>二</span><small>提示</small></span>', html)
        self.assertIn('<li class="">', html)
        self.assertIn('<div class="segmented" role="radiogroup" aria-label="视图">', html)
        self.assertIn('<label><input type="radio" name="view" value="list"><span>列表</span></label>', html)
        self.assertIn('<label><input type="radio" name="view" value="board" checked><span>看板</span></label>', html)
        self.assertIn('<label><input type="radio" name="view" value="日历"><span>日历</span></label>', html)
        self.assertIn('<div class="notice error" role="alert">', html)
        self.assertIn('<div class="notice-actions"><a href="/retry">重试</a></div>', html)
        self.assertIn('<div class="notice success" role="status">', html)
        self.assertIn('<button class="notice-close" type="button" data-notice-close aria-label="关闭提示"></button>', html)
        self.assertIn('<strong data-progress-value>75%</strong>', html)
        self.assertIn('<div class="progress-bar warning" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="3" aria-label="进度"><span style="width:75.0%"></span></div>', html)
        self.assertIn('aria-valuenow="150"><span style="width:100%"></span>', html)
        self.assertIn('<span class="status-dot is-on">已启用</span>', html)
        self.assertIn('<span class="tag">标签<a class="tag-remove" href="/x" aria-label="移除：标签"></a></span>', html)
        self.assertIn('<span class="count-badge">99+</span>', html)
        self.assertIn('<span class="count-badge" id="c0" hidden>0</span>', html)
        self.assertIn('<span class="avatar" aria-hidden="true">张</span>', html)
        self.assertIn('<span class="avatar avatar-lg"><img src="/a.png" alt="Li"></span>', html)
        self.assertIn('<time datetime="2026-10-26T09:12">09:12</time>', html)
        self.assertIn('<span class="status-chip success">运行中</span>', html)
        self.assertIn('<div class="selection-bar" id="sel" role="status" aria-live="polite" hidden>', html)
        self.assertIn('<strong data-selection-count>0</strong>', html)
        self.assertIn('<button class="btn-ghost btn-small" type="button" data-selection-clear>取消选择</button>', html)
        self.assertIn('<details class="disclosure-panel danger-disclosure" open>', html)
        self.assertIn('<summary>高级<small>3 项</small></summary>', html)
        self.assertIn('<article class="notification-item" data-read="false" data-notification-id="n1">', html)
        self.assertIn('<span class="status-chip info">未读</span><span class="status-chip warning">仍需处理</span>', html)
        self.assertIn('<div class="notification-item-meta"><span>来源</span><span>时间</span></div>', html)
        self.assertIn('<div class="notification-item-actions"><button type="button">已读</button></div>', html)
        self.assertIn('<article class="notification-item" data-read="true">', html)

    def test_pagination_sizes_and_jump(self):
        app = self.make_app()

        @app.get("/items")
        def items():
            return ""

        with app.test_request_context("/items"):
            html = render_template_string('{% from "design_kit/macros.html" import pagination %}{{ pagination(2, 5, 48, "items", {"q": "a"}, 11, 20, sizes=[10, 20], size=10, size_param="per_page", jump=true) }}')
        self.assertIn('<select data-page-size-nav aria-label="每页条数">', html)
        self.assertIn('<option value="/items?page=1&amp;q=a&amp;per_page=10" selected>10</option>', html)
        self.assertIn('<option value="/items?page=1&amp;q=a&amp;per_page=20">20</option>', html)
        self.assertIn('<form class="list-pagination-jump" method="get" action="/items">', html)
        self.assertIn('<input type="hidden" name="q" value="a">', html)
        self.assertIn('<input name="page" type="text" inputmode="numeric" pattern="[0-9]+" value="2" aria-label="页码">', html)
        self.assertIn('<span class="list-pagination-count">/ 5 页</span>', html)
        self.assertNotIn('list-pagination-page', html)

    def test_page_header_loading_slot_and_dots(self):
        app = self.make_app()
        source = """{% from "design_kit/macros.html" import page_header, loading_dots %}
{{ page_header("列表", loading=true) }}{{ page_header("无槽位") }}{{ loading_dots("正在生成") }}{{ loading_dots(muted=true) }}"""
        with app.test_request_context("/"):
            html = render_template_string(source)
        self.assertIn('<h1>列表<span class="page-title-loading" data-page-title-loading hidden aria-hidden="true"><span class="page-list-loading-spinner"></span></span></h1>', html)
        self.assertIn("<h1>无槽位</h1>", html)
        self.assertIn('<span class="loading-dots" role="status" aria-label="正在生成"><span></span><span></span><span></span></span>', html)
        self.assertIn('<span class="loading-dots muted" role="status" aria-hidden="true">', html)

    def test_startup_splash_off_by_default(self):
        app = self.make_app()
        with app.test_request_context("/"):
            html = render_template_string('{% extends "design_kit/layout.html" %}{% block content %}x{% endblock %}')
        self.assertNotIn("startup-loading", html)
        self.assertNotIn("data-startup-style", html)
        self.assertNotIn("<noscript>", html)
        self.assertRegex(html, r'<link rel="stylesheet" href="/_design-kit/tokens\.css\?v=[0-9a-f]{12}">')

    def test_startup_splash_markup(self):
        app = self.make_app(DESIGN_KIT_STARTUP_SPLASH=True, DESIGN_KIT_BRAND_NAME="示例", DESIGN_KIT_EXTRA_CSS=["brand.css"])
        for layout in ("design_kit/layout.html", "design_kit/auth_layout.html"):
            with app.test_request_context("/"):
                html = render_template_string('{%% extends "%s" %%}{%% block content %%}x{%% endblock %%}' % layout)
            self.assertIn("window.KitStartup = {", html)
            self.assertIn('root.setAttribute("data-startup-pending", "")', html)
            self.assertIn("}, 4000);", html, "slow hint after 4s")
            self.assertIn("release(true), 15000);", html, "timeout releases the screen")
            self.assertRegex(html, r'<link rel="stylesheet" href="/_design-kit/tokens\.css\?v=[0-9a-f]{12}" media="print" data-startup-style onload="window\.KitStartup\.styleReady\(this\)" onerror="window\.KitStartup\.styleReady\(this, true\)">')
            self.assertIn('<link rel="stylesheet" href="/static/brand.css" media="print" data-startup-style', html)
            self.assertIn("<noscript>", html)
            self.assertIn('<div id="startupLoading" class="startup-loading" role="status" aria-live="polite" aria-atomic="true">', html)
            self.assertIn('<span class="startup-loading-mark" aria-hidden="true">示</span><span>示例</span>', html)
            self.assertIn('<p id="startupLoadingWarning" class="startup-loading-warning" role="status" hidden></p>', html)
            # The splash markup is the first thing in <body>, before the progress bar.
            self.assertLess(html.index('id="startupLoading"'), html.index("route-progress"))
            # The inline critical CSS comes after the theme bootstrap and before the first stylesheet.
            self.assertLess(html.index("root.dataset.theme ="), html.index("html[data-startup-pending]"))
            self.assertLess(html.index("html[data-startup-pending]"), html.index("tokens.css"))

    def test_empty_pagination_is_hidden(self):
        app = self.make_app()

        @app.get("/items")
        def items():
            return ""

        with app.test_request_context("/items"):
            html = render_template_string('{% from "design_kit/macros.html" import pagination %}{{ pagination(1, 1, 0, "items") }}')
        self.assertIn('data-empty="true"', html)


if __name__ == "__main__":
    unittest.main()
