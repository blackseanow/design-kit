"""Design kit demo. Fictional, read-only data; nothing is stored or sent.

Run from the design-kit directory:
    pip install Flask==3.1.2
    python demo/app.py            # http://127.0.0.1:5058/
Optional: DEMO_BRAND_CSS=1 loads demo/static/brand-example.css (token override example).
"""
from __future__ import annotations

import math
import os
import random
import sys
from pathlib import Path

from flask import Flask, flash, redirect, render_template, request, url_for

KIT_ROOT = Path(__file__).resolve().parents[1]
if str(KIT_ROOT) not in sys.path:
    sys.path.insert(0, str(KIT_ROOT))

from design_kit import DesignKit  # noqa: E402

STATUSES = {
    "running": ("运行中", "success"),
    "paused": ("已暂停", ""),
    "warning": ("需要处理", "warning"),
    "failed": ("执行失败", "error"),
}
OWNERS = ["示例成员 A", "示例成员 B", "示例成员 C"]


def fictional_records(count: int = 57):
    """Deterministic sample rows; no real accounts or data."""
    keys = list(STATUSES)
    rows = []
    for index in range(1, count + 1):
        status = keys[(index * 7) % len(keys)]
        rows.append({
            "id": index,
            "name": f"示例任务 {index:02d}",
            "owner": OWNERS[index % len(OWNERS)],
            "status": status,
            "runs": (index * 37) % 400,
            "updated": f"2026-10-{(index % 26) + 1:02d} {(index * 5) % 24:02d}:{(index * 13) % 60:02d}",
        })
    return rows


RECORDS = fictional_records()
NAV = [
    {"title": "工作台", "items": [
        {"label": "总览", "href": "/", "icon": "layout-dashboard", "endpoint": "overview"},
        {"label": "任务列表", "href": "/records", "icon": "activity", "endpoint": "records"},
        {"label": "组件", "href": "/components", "icon": "sliders-horizontal", "endpoint": "components"},
    ]},
    {"title": "系统", "items": [
        {"label": "设置", "href": "/settings", "icon": "shield-check", "endpoint": "settings"},
        {"label": "登录页", "href": "/login", "icon": "log-out", "endpoint": "login"},
    ]},
]


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY="demo-only-not-secret",
        DESIGN_KIT_BRAND_NAME="示例控制台",
        DESIGN_KIT_BRAND_TAGLINE="Design kit demo",
        DESIGN_KIT_THEME_KEY="design-kit-demo-theme",
    )
    if os.environ.get("DEMO_BRAND_CSS") == "1":
        app.config["DESIGN_KIT_EXTRA_CSS"] = ["brand-example.css"]
    app.config.update(config or {})
    DesignKit(app)

    @app.context_processor
    def shell_context():
        return {
            "nav_groups": NAV,
            "user_menu": {
                "name": "示例用户",
                "subtitle": "演示账号",
                "items": [{"label": "设置", "href": url_for("settings"), "icon": "shield-check"}],
                "logout_url": url_for("logout"),
            },
            "statuses": STATUSES,
        }

    @app.get("/")
    def overview():
        counts = {key: sum(1 for row in RECORDS if row["status"] == key) for key in STATUSES}
        return render_template("demo/overview.html", counts=counts, recent=RECORDS[:5], total=len(RECORDS))

    @app.get("/records")
    def records():
        query = request.args.get("q", "").strip()
        status = request.args.get("status", "")
        if request.args.get("error") == "1":
            return render_template("demo/records.html", failed=True, rows=[], query=query, status=status,
                                   page=1, pages=1, total=0, start=0, end=0, filters=[], args={})
        rows = [row for row in RECORDS
                if (not query or query in row["name"] or query in row["owner"])
                and (not status or row["status"] == status)]
        page_size = 10
        pages = max(1, math.ceil(len(rows) / page_size))
        page = min(max(1, request.args.get("page", 1, type=int)), pages)
        start = (page - 1) * page_size
        args = {key: value for key, value in {"q": query, "status": status}.items() if value}
        filters = []
        if query:
            filters.append({"name": "关键词", "value": query, "remove_url": url_for("records", **{k: v for k, v in args.items() if k != "q"})})
        if status:
            filters.append({"name": "状态", "value": STATUSES[status][0], "remove_url": url_for("records", **{k: v for k, v in args.items() if k != "status"})})
        return render_template("demo/records.html", failed=False, rows=rows[start:start + page_size], query=query,
                               status=status, page=page, pages=pages, total=len(rows), start=start + 1 if rows else 0,
                               end=min(len(rows), start + page_size), filters=filters, args=args)

    @app.get("/components")
    def components():
        return render_template("demo/components.html", rows=RECORDS[:4])

    @app.route("/settings", methods=["GET", "POST"])
    def settings():
        if request.method == "POST":
            # Demo only: nothing is saved.
            if not request.form.get("project_name", "").strip():
                flash("项目名称不能为空", "error")
                return redirect(url_for("settings"))
            flash("设置已保存（演示环境，未写入任何数据）", "success")
            return redirect(url_for("settings"))
        return render_template("demo/settings.html")

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            flash("演示登录成功（未校验任何凭证）", "success")
            return redirect(url_for("overview"))
        return render_template("demo/login.html")

    @app.get("/demo-captcha.svg")
    def demo_captcha():
        """Fictional captcha image for the login demo: random characters, never checked or stored."""
        text = "".join(random.choice("ABCDEFGHJKMNPQRSTUVWXYZ23456789") for _ in range(4))
        glyphs = "".join(
            f'<text x="{14 + i * 25}" y="{28 + random.randint(-3, 3)}" transform="rotate({random.randint(-12, 12)} {20 + i * 25} 22)">{ch}</text>'
            for i, ch in enumerate(text))
        lines = "".join(
            f'<line x1="{random.randint(0, 40)}" y1="{random.randint(4, 36)}" x2="{random.randint(80, 120)}" y2="{random.randint(4, 36)}"/>'
            for _ in range(3))
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">'
               '<rect width="120" height="40" fill="#f2f2f5"/>'
               f'<g stroke="#9a9aa6" stroke-width="1">{lines}</g>'
               f'<g font-family="monospace" font-size="22" font-weight="700" fill="#3c3c46">{glyphs}</g></svg>')
        return svg, 200, {"Content-Type": "image/svg+xml", "Cache-Control": "no-store"}

    @app.post("/logout")
    def logout():
        flash("已退出（演示）", "info")
        return redirect(url_for("login"))

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "5058")), debug=True)
