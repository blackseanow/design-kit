"""Console design kit for Flask + Jinja.

Register once::

    from design_kit import DesignKit
    DesignKit(app)            # or kit = DesignKit(); kit.init_app(app)

Then extend ``design_kit/layout.html`` (app pages) or
``design_kit/auth_layout.html`` (sign-in pages) and import macros from
``design_kit/macros.html``. Settings (all optional) live in ``app.config``:

DESIGN_KIT_BRAND_NAME      product name shown in the header       ("Console")
DESIGN_KIT_BRAND_TAGLINE   short line under the name on sign-in    ("")
DESIGN_KIT_BRAND_MARK      one or two letters when no logo is set  (first letter of name)
DESIGN_KIT_LOGO_LIGHT      logo for light theme: app static path or URL (None)
DESIGN_KIT_LOGO_DARK       logo for dark theme (falls back to light)   (None)
DESIGN_KIT_THEME_KEY       localStorage key for the appearance choice ("app-theme")
DESIGN_KIT_LANG            <html lang>                              ("zh-CN")
DESIGN_KIT_HOME_URL        target of the brand link                 ("/")
DESIGN_KIT_EXTRA_CSS       app static paths loaded after the kit CSS, e.g. brand tokens ([])
DESIGN_KIT_STARTUP_SPLASH  show the brand and three dots until every stylesheet
                           has loaded (inline critical CSS; see docs/components.md)  (False)
"""
from __future__ import annotations

import hashlib
from functools import lru_cache
from pathlib import Path

from flask import Blueprint, Flask, url_for

__all__ = ["DesignKit", "STYLESHEETS", "SCRIPTS"]
__version__ = "1.1.0"

STATIC_DIR = Path(__file__).resolve().parent / "static"

# Load order is part of the contract: tokens first, page/auth layouts last.
STYLESHEETS = (
    "tokens.css",
    "base.css",
    "shell.css",
    "components.css",
    "overlays.css",
    "page.css",
    "auth.css",
    "buttons.css",
)
# core.js must load first; every other module reads window.Kit.
SCRIPTS = (
    "core.js",
    "theme.js",
    "route-progress.js",
    "feedback.js",
    "modal.js",
    "select.js",
    "datetime.js",
    "ui.js",
    "loading.js",
    "popover.js",
    "shell.js",
)


@lru_cache(maxsize=None)
def _file_version(filename: str) -> str:
    """Short content hash used as a cache-busting query string."""
    path = (STATIC_DIR / filename).resolve()
    if STATIC_DIR not in path.parents or not path.is_file():
        raise FileNotFoundError(f"design kit asset not found: {filename}")
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def _app_url(value):
    """Accept an app static path ('brand/logo.svg') or an absolute URL."""
    if not value:
        return None
    if value.startswith(("/", "http://", "https://", "data:")):
        return value
    return url_for("static", filename=value)


class DesignKit:
    def __init__(self, app: Flask | None = None):
        self.blueprint = Blueprint(
            "design_kit",
            __name__,
            static_folder="static",
            static_url_path="/_design-kit",
            template_folder="templates",
        )
        if app is not None:
            self.init_app(app)

    def init_app(self, app: Flask) -> None:
        config = app.config
        config.setdefault("DESIGN_KIT_BRAND_NAME", "Console")
        config.setdefault("DESIGN_KIT_BRAND_TAGLINE", "")
        config.setdefault("DESIGN_KIT_BRAND_MARK", None)
        config.setdefault("DESIGN_KIT_LOGO_LIGHT", None)
        config.setdefault("DESIGN_KIT_LOGO_DARK", None)
        config.setdefault("DESIGN_KIT_LOGO_FULL_LIGHT", None)
        config.setdefault("DESIGN_KIT_LOGO_FULL_DARK", None)
        config.setdefault("DESIGN_KIT_THEME_KEY", "app-theme")
        config.setdefault("DESIGN_KIT_LANG", "zh-CN")
        config.setdefault("DESIGN_KIT_HOME_URL", "/")
        config.setdefault("DESIGN_KIT_EXTRA_CSS", [])
        config.setdefault("DESIGN_KIT_STARTUP_SPLASH", False)
        app.register_blueprint(self.blueprint)
        # Debug reloads pick up edited assets; production hashes are cached.
        if app.debug:
            _file_version.cache_clear()

        # A Jinja global (not a context processor) so imported macros can use
        # it without "with context".
        app.jinja_env.globals["kit"] = _KitContext(config)


class _KitContext:
    """Values and helpers available as ``kit`` in every template."""

    stylesheets = STYLESHEETS
    scripts = SCRIPTS

    def __init__(self, config):
        self._config = config

    def __getattr__(self, name):
        key = f"DESIGN_KIT_{name.upper()}"
        if key in self._config:
            return self._config[key]
        raise AttributeError(name)

    @staticmethod
    def asset(filename: str) -> str:
        return url_for("design_kit.static", filename=filename, v=_file_version(filename))

    @property
    def icons(self) -> str:
        return self.asset("icons.svg")

    def icon_href(self, name: str) -> str:
        return f"{self.icons}#{name}"

    @property
    def brand_mark(self) -> str:
        mark = self._config.get("DESIGN_KIT_BRAND_MARK")
        name = self._config.get("DESIGN_KIT_BRAND_NAME") or "?"
        return mark or name[:1].upper()

    @property
    def logo_light(self):
        return _app_url(self._config.get("DESIGN_KIT_LOGO_LIGHT"))

    @property
    def logo_dark(self):
        return _app_url(self._config.get("DESIGN_KIT_LOGO_DARK")) or self.logo_light

    @property
    def logo_full_light(self):
        return _app_url(self._config.get("DESIGN_KIT_LOGO_FULL_LIGHT"))

    @property
    def logo_full_dark(self):
        return _app_url(self._config.get("DESIGN_KIT_LOGO_FULL_DARK")) or self.logo_full_light

    @property
    def extra_css(self):
        return [_app_url(path) for path in self._config.get("DESIGN_KIT_EXTRA_CSS") or []]

    @property
    def stylesheet_urls(self):
        """Kit stylesheets in contract order, then the app's own."""
        return [self.asset(sheet) for sheet in STYLESHEETS] + self.extra_css
