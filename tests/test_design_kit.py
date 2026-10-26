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
        self.assertEqual(css, list(STYLESHEETS))
        self.assertEqual(js, list(SCRIPTS))
        self.assertIn('data-theme-key="design-kit-demo-theme"', html)
        self.assertRegex(html, r'<meta name="design-kit-icons" content="/_design-kit/icons\.svg\?v=[0-9a-f]{12}">')
        # The theme bootstrap runs before the first stylesheet.
        self.assertLess(html.index("root.dataset.theme ="), html.index("tokens.css"))

    def test_demo_pages_render(self):
        from app import create_app
        client = create_app({"TESTING": True}).test_client()
        for path in ("/", "/records", "/records?q=zzz", "/records?error=1", "/records?status=failed&page=2", "/components", "/settings", "/login"):
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
