// Browser regression for the design kit demo. Uses fictional demo data only.
// Run from design-kit/:  PYTHON=python3 node tests/browser_check.js
//   BROWSER=webkit or BROWSER=firefox runs the same checks in another engine
//   (the engine must be installed: npx playwright install webkit firefox).
// Needs Flask importable by $PYTHON and the playwright npm package.
const { spawn } = require("node:child_process");
const path = require("node:path");
const assert = require("node:assert/strict");
const playwright = require("playwright");

let AxeBuilder = null;
try { ({ default: AxeBuilder } = require("@axe-core/playwright")); } catch { /* npm install adds it; without it the scan is skipped */ }

const BROWSER = process.env.BROWSER || "chromium";
if (!["chromium", "webkit", "firefox"].includes(BROWSER)) throw new Error(`BROWSER must be chromium, webkit or firefox, not ${BROWSER}`);

const PORT = process.env.PORT || "5071";
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`ok   ${name}`); }
  catch (error) { results.push(`FAIL ${name}: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
};

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try { const response = await fetch(BASE + "/login"); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("demo server did not start");
}

(async () => {
  const server = spawn(process.env.PYTHON || "python3", [path.join(__dirname, "..", "demo", "app.py")], {
    env: { ...process.env, PORT }, stdio: "ignore",
  });
  const browser = await playwright[BROWSER].launch();
  try {
    await waitForServer();
    const consoleErrors = [];
    const watch = (page) => {
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("pageerror", (error) => consoleErrors.push(error.message));
    };

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    watch(desktop);
    await desktop.goto(BASE + "/components");

    await check("select opens with ArrowDown, Escape closes and returns focus", async () => {
      const trigger = desktop.locator(".enhanced-select-button").first();
      await trigger.focus();
      await desktop.keyboard.press("ArrowDown");
      await desktop.locator('.enhanced-select-menu[data-open="true"]').waitFor();
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      await desktop.keyboard.press("Escape");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      assert.equal(await desktop.evaluate(() => document.activeElement.classList.contains("enhanced-select-button")), true);
    });

    await check("select choice updates the native select and fires change", async () => {
      const select = desktop.locator('select[name="plain"]');
      await desktop.evaluate(() => { window.__changed = 0; document.querySelector('select[name="plain"]').addEventListener("change", () => { window.__changed += 1; }); });
      await desktop.locator(".enhanced-select-button").first().click();
      await desktop.locator('.enhanced-select-menu[data-open="true"] [role="option"]', { hasText: "选项一" }).click();
      assert.equal(await select.inputValue(), "选项一");
      assert.equal(await desktop.evaluate(() => window.__changed), 1);
    });

    await check("searchable select filters options and shows empty result", async () => {
      await desktop.locator('select[name="search"]').locator("xpath=..").locator(".enhanced-select-button").click();
      await desktop.keyboard.type("城市 C");
      assert.equal(await desktop.locator('.enhanced-select-menu[data-open="true"] [role="option"]').count(), 1);
      await desktop.keyboard.press("Control+A");
      await desktop.keyboard.type("不存在");
      assert.equal(await desktop.locator('.enhanced-select-menu[data-open="true"] .enhanced-select-empty').innerText(), "没有匹配结果");
      await desktop.keyboard.press("Escape");
    });

    await check("date picker writes YYYY-MM-DD into the original input", async () => {
      await desktop.locator(".custom-date-button").first().click();
      await desktop.locator('.custom-date-menu[data-open="true"] [data-date-value="2026-10-15"]').click();
      assert.equal(await desktop.locator('input[name="date"]').inputValue(), "2026-10-15");
      assert.match(await desktop.locator(".custom-date-button").first().innerText(), /2026\/10\/15/);
    });

    await check("time picker selects a 30-minute slot", async () => {
      await desktop.locator(".custom-time-picker:not(.custom-time-editable) .custom-time-button").first().click();
      await desktop.locator('.custom-time-menu[data-open="true"] [data-time-value="16:30"]').click();
      assert.equal(await desktop.locator('input[name="time"]').inputValue(), "16:30");
    });

    await check("only one floating menu is open at a time", async () => {
      await desktop.locator(".custom-date-button").first().click();
      await desktop.locator('.custom-date-menu[data-open="true"]').waitFor();
      // The date menu opens above or below its button depending on the room left in the
      // viewport and can cover the neighbouring trigger. Pick a second trigger whose centre
      // it does not cover, so the click lands on the trigger in every engine.
      const second = await desktop.evaluate(() => {
        const selectors = [".enhanced-select-button", ".custom-time-picker:not(.custom-time-editable) .custom-time-button"];
        for (const selector of selectors) {
          for (const [index, button] of [...document.querySelectorAll(selector)].entries()) {
            const rect = button.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > innerHeight) continue;
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            if (hit && button.contains(hit)) return { selector, index };
          }
        }
        return null;
      });
      assert.ok(second, "a second trigger the date menu does not cover");
      await desktop.locator(second.selector).nth(second.index).click();
      assert.equal(await desktop.locator('.custom-date-menu[data-open="true"]').count(), 0);
      assert.equal(await desktop.locator('[data-open="true"]').count(), 1);
      await desktop.keyboard.press("Escape");
    });

    await check("help tooltip shows on focus and Escape hides it", async () => {
      await desktop.locator('.title-help-button[data-help]').first().focus();
      await desktop.keyboard.press("Shift+Tab");
      await desktop.keyboard.press("Tab");
      await desktop.locator(".help-tooltip-layer.visible").waitFor();
      await desktop.keyboard.press("Escape");
      assert.equal(await desktop.locator(".help-tooltip-layer.visible").count(), 0);
    });

    await check("tabs switch panels with arrow keys", async () => {
      await desktop.locator("#tabA").focus();
      await desktop.keyboard.press("ArrowRight");
      assert.equal(await desktop.locator("#tabB").getAttribute("aria-selected"), "true");
      assert.equal(await desktop.locator("#tabPanelB").isVisible(), true);
      assert.equal(await desktop.locator("#tabPanelA").isVisible(), false);
    });

    await check("row actions move into the overflow menu", async () => {
      const row = desktop.locator("#table tbody tr").first();
      assert.equal(await row.locator(".list-row-actions > button:not(.row-overflow-trigger)").count(), 0);
      await row.locator(".row-overflow-trigger").click();
      const menu = desktop.locator(".row-overflow-menu:not([hidden])");
      await menu.waitFor();
      assert.equal(await menu.locator('[role="menuitem"]').count(), 4);
      await desktop.keyboard.press("Escape");
      assert.equal(await desktop.locator(".row-overflow-menu:not([hidden])").count(), 0);
    });

    await check("modal traps focus, Escape closes, focus returns to the opener", async () => {
      const opener = desktop.locator('[data-modal-open="formModal"]');
      await opener.click();
      const modal = desktop.locator("#formModal");
      await desktop.waitForFunction(() => document.getElementById("formModal").contains(document.activeElement));
      assert.equal(await modal.getAttribute("role"), "dialog");
      assert.equal(await desktop.evaluate(() => document.querySelector(".app-shell").inert), true);
      for (let i = 0; i < 12; i += 1) await desktop.keyboard.press("Tab");
      assert.equal(await desktop.evaluate(() => document.getElementById("formModal").contains(document.activeElement)), true);
      await desktop.keyboard.press("Escape");
      await desktop.waitForFunction(() => document.getElementById("formModal").classList.contains("hidden"));
      await desktop.waitForFunction(() => document.activeElement?.dataset.modalOpen === "formModal");
      assert.equal(await desktop.evaluate(() => document.querySelector(".app-shell").inert), false);
    });

    await check("select menu inside a modal is portaled into the modal", async () => {
      await desktop.locator('[data-modal-open="formModal"]').click();
      await desktop.locator("#formModal .enhanced-select-button").click();
      assert.equal(await desktop.evaluate(() => Boolean(document.querySelector('#formModal .enhanced-select-menu[data-open="true"]'))), true);
      await desktop.keyboard.press("Escape");
      assert.equal(await desktop.locator("#formModal").isVisible(), true, "first Escape only closes the menu");
      await desktop.keyboard.press("Escape");
      await desktop.waitForFunction(() => document.getElementById("formModal").classList.contains("hidden"));
    });

    await check("danger confirm starts on cancel and resolves false", async () => {
      await desktop.locator("#confirmDemo").click();
      await desktop.waitForFunction(() => document.activeElement?.hasAttribute("data-kit-cancel"));
      await desktop.keyboard.press("Enter");
      await desktop.locator(".global-feedback.visible").waitFor();
      assert.match(await desktop.locator(".global-feedback-message").innerText(), /已取消/);
    });

    await check("button loading state disables and restores", async () => {
      const button = desktop.locator("#loadingDemo");
      await button.click();
      assert.equal(await button.isDisabled(), true);
      assert.equal(await button.getAttribute("aria-busy"), "true");
      await desktop.waitForFunction(() => !document.getElementById("loadingDemo").disabled, null, { timeout: 4000 });
      assert.equal(await button.innerText(), "点击看加载态");
    });

    await check("loading run: nothing for a fast task, a mask with aria-busy for a slow one, then removed", async () => {
      await desktop.locator("#loadingFastDemo").click();
      await desktop.waitForTimeout(120);
      assert.equal(await desktop.locator("#loadingDemoTable .page-list-loading").count(), 0, "50ms tasks never show a mask");
      await desktop.locator("#loadingRunDemo").click();
      await desktop.locator("#loadingDemoTable .page-list-loading").waitFor();
      assert.equal(await desktop.locator("#loadingDemoTable").getAttribute("aria-busy"), "true");
      assert.equal(await desktop.locator("#loadingDemoTable tbody tr").count(), 4, "rows stay underneath the mask");
      assert.equal(await desktop.locator("#loadingDemoTable .page-list-loading-content").count(), 1, "content is wrapped for viewport placement");
      await desktop.waitForFunction(() => !document.querySelector("#loadingDemoTable .page-list-loading"), null, { timeout: 4000 });
      assert.equal(await desktop.locator("#loadingDemoTable").getAttribute("aria-busy"), null);
    });

    await check("loading run: a failed task shows an error overlay whose retry runs the task again", async () => {
      await desktop.locator("#loadingFailDemo").click();
      const error = desktop.locator("#loadingDemoTable .page-list-loading.is-error");
      await error.waitFor();
      assert.equal(await error.getAttribute("role"), "alert");
      assert.match(await error.locator(".page-list-loading-text").innerText(), /服务暂时不可用/);
      await error.locator("button").click();
      await desktop.waitForFunction(() => !document.querySelector("#loadingDemoTable .page-list-loading"), null, { timeout: 4000 });
    });

    await check("title loading slot keeps its width and the header refresh icon spins while busy", async () => {
      const slot = desktop.locator("[data-page-title-loading]");
      const before = await slot.boundingBox();
      assert.equal(Math.round(before.width), 20, "the hidden slot still reserves 20px");
      await desktop.locator("#titleLoadingDemo").click();
      assert.equal(await desktop.evaluate(() => document.querySelector("[data-page-title-loading]").hidden), false);
      await desktop.locator("#headerRefreshDemo").click();
      assert.equal(await desktop.locator("#headerRefreshDemo").getAttribute("aria-busy"), "true");
      await desktop.waitForFunction(() => document.querySelector("[data-page-title-loading]").hidden, null, { timeout: 4000 });
    });

    await check("startup splash is released once the stylesheets are in, and whenReady runs", async () => {
      assert.equal(await desktop.evaluate(() => document.documentElement.hasAttribute("data-startup-pending")), false);
      assert.equal(await desktop.evaluate(() => document.getElementById("startupLoading") && getComputedStyle(document.getElementById("startupLoading")).display), "none");
      assert.equal(await desktop.evaluate(() => [...document.querySelectorAll("[data-startup-style]")].every((link) => link.media === "all")), true);
      assert.equal(await desktop.evaluate(() => new Promise((resolve) => window.KitStartup.whenReady(() => resolve("ready")))), "ready");
      assert.equal(await desktop.evaluate(() => document.getElementById("startupLoadingWarning").hidden), true);
    });

    await check("theme choice in the user menu persists under the configured key", async () => {
      await desktop.locator(".user-menu-trigger").click();
      await desktop.locator('[data-theme-choice="dark"]').click();
      assert.equal(await desktop.evaluate(() => document.documentElement.dataset.theme), "dark");
      assert.equal(await desktop.evaluate(() => localStorage.getItem("design-kit-demo-theme")), "dark");
      await desktop.reload();
      assert.equal(await desktop.evaluate(() => document.documentElement.dataset.theme), "dark");
      await desktop.evaluate(() => localStorage.removeItem("design-kit-demo-theme"));
    });

    await check("captcha refresh reloads the image, clears and focuses the input", async () => {
      await desktop.goto(BASE + "/login");
      const image = desktop.locator("img[data-captcha-image='captcha']");
      await desktop.waitForFunction(() => document.querySelector("img[data-captcha-image]").complete);
      const first = await image.getAttribute("src");
      await desktop.fill("#captcha", "ABCD");
      await desktop.evaluate(() => { window.__captchaEvents = 0; document.addEventListener("kit:captcha-refresh", () => { window.__captchaEvents += 1; }); });
      await desktop.click("[data-captcha-refresh='captcha']");
      const second = await image.getAttribute("src");
      assert.notEqual(second, first);
      assert.match(second, /\?_cb=\d+$/);
      assert.equal(await desktop.inputValue("#captcha"), "");
      assert.equal(await desktop.evaluate(() => document.activeElement.id), "captcha");
      assert.equal(await desktop.evaluate(() => window.__captchaEvents), 1);
      await desktop.waitForTimeout(5);
      await desktop.click("[data-captcha-refresh='captcha']");
      const third = await image.getAttribute("src");
      assert.equal((third.match(/_cb=/g) || []).length, 1, "the cache-busting query is replaced, not appended");
      const box = await image.boundingBox();
      assert.equal(Math.round(box.width), 120);
      assert.equal(Math.round(box.height), 40);
    });

    await check("server flash becomes a global notification", async () => {
      await desktop.goto(BASE + "/settings");
      await desktop.locator('input[name="project_name"]').fill("");
      await desktop.locator('form.panel button[type="submit"]').click();
      await desktop.locator(".global-feedback.error.visible").waitFor();
      assert.match(await desktop.locator(".global-feedback-message").innerText(), /项目名称不能为空/);
    });

    await check("progress bar settles after the page loads", async () => {
      await desktop.goto(BASE + "/");
      await desktop.waitForFunction(() => document.querySelector("[data-route-progress]").hidden, null, { timeout: 3000 });
    });

    await desktop.goto(BASE + "/overlays");

    await check("nested navigation: the group with the current page starts open and toggles", async () => {
      const parent = desktop.locator(".nav-item-parent");
      assert.equal(await parent.getAttribute("aria-expanded"), "true");
      assert.equal(await desktop.locator("#navComponents .nav-subitem[aria-current='page']").count(), 1);
      await parent.click();
      assert.equal(await parent.getAttribute("aria-expanded"), "false");
      assert.equal(await desktop.evaluate(() => document.getElementById("navComponents").hidden), true);
      await parent.click();
      assert.equal(await desktop.evaluate(() => document.getElementById("navComponents").hidden), false);
    });

    await check("header badge: Kit.badge.set caps at 99+, hides at 0 and updates the label", async () => {
      assert.equal(await desktop.locator("#notificationBellBadge").innerText(), "2");
      await desktop.evaluate(() => Kit.badge.set("notificationBell", 120));
      assert.equal(await desktop.locator("#notificationBellBadge").innerText(), "99+");
      assert.equal(await desktop.locator("#notificationBell").getAttribute("aria-label"), "消息中心，120 条未读");
      await desktop.evaluate(() => Kit.badge.set("notificationBell", 0));
      assert.equal(await desktop.evaluate(() => document.getElementById("notificationBellBadge").hidden), true);
      assert.equal(await desktop.locator("#notificationBell").getAttribute("aria-label"), "消息中心");
    });

    await check("drawer opens from the side, traps focus, Escape closes and focus returns", async () => {
      await desktop.locator('[data-modal-open="detailDrawer"]').first().click();
      await desktop.waitForFunction(() => document.getElementById("detailDrawer").contains(document.activeElement));
      assert.equal(await desktop.locator("#detailDrawer").getAttribute("data-ui-component"), "DrawerShell");
      // Measure after the 180ms slide-in has finished.
      await desktop.locator("#detailDrawer .drawer-panel").evaluate((panel) => Promise.all(panel.getAnimations().map((animation) => animation.finished)));
      const box = await desktop.locator("#detailDrawer .drawer-panel").boundingBox();
      const viewportWidth = await desktop.evaluate(() => document.documentElement.clientWidth);
      assert.equal(Math.round(box.x + box.width), viewportWidth, "the panel sits on the right edge");
      assert.equal(Math.round(box.width), 480);
      await desktop.locator("#detailDrawer .enhanced-select-button").click();
      assert.equal(await desktop.evaluate(() => Boolean(document.querySelector('#detailDrawer .enhanced-select-menu[data-open="true"]'))), true, "menus stay inside the drawer");
      await desktop.keyboard.press("Escape");
      await desktop.keyboard.press("Escape");
      await desktop.waitForFunction(() => document.getElementById("detailDrawer").classList.contains("hidden"));
      await desktop.waitForFunction(() => document.activeElement?.dataset.modalOpen === "detailDrawer");
    });

    await check("popover keeps its fields, child select closes first, outside click closes", async () => {
      await desktop.locator('[data-popover-open="settingsPopover"]').click();
      await desktop.waitForFunction(() => !document.getElementById("settingsPopover").hidden);
      assert.equal(await desktop.evaluate(() => document.activeElement.classList.contains("enhanced-select-button")), true, "first field focused");
      await desktop.locator("#settingsPopover .enhanced-select-button").first().click();
      assert.equal(await desktop.locator('.enhanced-select-menu[data-open="true"]').count(), 1);
      await desktop.keyboard.press("Escape");
      assert.equal(await desktop.evaluate(() => document.getElementById("settingsPopover").hidden), false, "first Escape only closes the select");
      await desktop.keyboard.press("Escape");
      assert.equal(await desktop.evaluate(() => document.getElementById("settingsPopover").hidden), true);
      assert.equal(await desktop.evaluate(() => document.activeElement.dataset.popoverOpen), "settingsPopover");
      await desktop.locator('[data-popover-open="settingsPopover"]').click();
      await desktop.mouse.click(700, 60);
      assert.equal(await desktop.evaluate(() => document.getElementById("settingsPopover").hidden), true);
    });

    await check("dropdown menu: ArrowDown opens and focuses, Enter picks a radio item, Escape returns focus", async () => {
      await desktop.locator('[data-menu-open="sortMenu"]').focus();
      await desktop.keyboard.press("ArrowDown");
      await desktop.waitForFunction(() => !document.getElementById("sortMenu").hidden);
      assert.equal(await desktop.evaluate(() => document.activeElement.textContent.trim()), "更新时间");
      await desktop.keyboard.press("ArrowDown");
      await desktop.keyboard.press("Enter");
      await desktop.waitForFunction(() => document.getElementById("sortMenu").hidden);
      assert.deepEqual(await desktop.evaluate(() => [...document.querySelectorAll('#sortMenu [role="menuitemradio"]')].map((n) => n.getAttribute("aria-checked"))), ["false", "true", "false"]);
      assert.match(await desktop.locator('[data-menu-open="sortMenu"] > span').innerText(), /名称/);
      await desktop.locator('[data-menu-open="pageMenu"]').click();
      await desktop.waitForFunction(() => !document.getElementById("pageMenu").hidden);
      await desktop.keyboard.press("Escape");
      assert.equal(await desktop.evaluate(() => document.getElementById("pageMenu").hidden), true);
      assert.equal(await desktop.evaluate(() => document.activeElement.dataset.menuOpen), "pageMenu");
    });

    await check("tabs show a sliding underline; segmented buttons press one at a time", async () => {
      await desktop.locator("#notificationBell").click();
      await desktop.waitForFunction(() => !document.getElementById("notificationPopover").hidden);
      const width = await desktop.evaluate(() => parseFloat(document.querySelector("#notificationPopover .tab-selection-indicator").style.width));
      assert.ok(width > 0, "indicator has the width of the selected tab");
      await desktop.keyboard.press("Escape");
      await desktop.locator(".segmented > button").nth(1).click();
      assert.deepEqual(await desktop.evaluate(() => [...document.querySelectorAll(".segmented > button")].map((b) => b.getAttribute("aria-pressed"))), ["false", "true", "false"]);
      // Radio version: the checked label also carries .is-checked (the :has()-free fallback).
      assert.deepEqual(await desktop.evaluate(() => [...document.querySelectorAll('.segmented[role="radiogroup"] > label')].map((l) => l.classList.contains("is-checked"))), [true, false, false]);
      await desktop.locator('.segmented[role="radiogroup"] > label').nth(2).click();
      assert.deepEqual(await desktop.evaluate(() => [...document.querySelectorAll('.segmented[role="radiogroup"] > label')].map((l) => l.classList.contains("is-checked"))), [false, false, true]);
    });

    await check("table settings hide a column and remember it after reload", async () => {
      await desktop.locator("#selectableTable .table-settings-trigger").click();
      await desktop.waitForFunction(() => Boolean(document.querySelector(".table-settings-panel:not([hidden])")));
      assert.equal(await desktop.evaluate(() => document.activeElement.getAttribute("role")), "tab");
      await desktop.locator('.table-settings-panel:not([hidden]) input[data-column="负责人"]').click();
      assert.equal(await desktop.locator("#selectableTable .table-column-hidden").count(), 6);
      await desktop.keyboard.press("Escape");
      await desktop.reload();
      await desktop.waitForFunction(() => document.querySelectorAll("#selectableTable .table-column-hidden").length === 6, null, { timeout: 3000 });
      await desktop.evaluate(() => { Object.keys(localStorage).filter((key) => key.startsWith("kit:table:")).forEach((key) => localStorage.removeItem(key)); });
    });

    await check("selection bar counts checked rows and clears them", async () => {
      await desktop.locator("#selectableTable [data-select-row]").nth(0).check();
      await desktop.locator("#selectableTable [data-select-row]").nth(1).check();
      assert.equal(await desktop.evaluate(() => document.getElementById("rowSelection").hidden), false);
      assert.equal(await desktop.locator("#rowSelection [data-selection-count]").innerText(), "2");
      await desktop.locator("#rowSelection [data-selection-clear]").click();
      assert.equal(await desktop.evaluate(() => document.getElementById("rowSelection").hidden), true);
      assert.equal(await desktop.locator("#selectableTable [data-select-row]:checked").count(), 0);
    });

    await check("controls added later are enhanced through the one shared body observer", async () => {
      await desktop.goto(BASE + "/overlays");
      const result = await desktop.evaluate(async () => {
        const host = document.createElement("section");
        host.className = "panel";
        host.innerHTML = `<label><span>动态下拉</span><select name="dyn"><option>甲</option><option>乙</option></select></label>
          <label><span>动态日期</span><input type="date" name="dynDate" value="2026-10-27"></label>
          <span class="field-label">动态说明<button class="title-help-button" type="button" aria-label="说明" data-help="动态加入的帮助"></button></span>
          <div class="table-wrap" id="dynTable" data-table-settings><table class="console-data-table"><thead><tr><th>名称</th><th>状态</th><th>负责人</th><th>时间</th><th class="table-actions-heading" aria-label="更多操作"></th></tr></thead>
          <tbody><tr><td>行</td><td>运行中</td><td>甲</td><td>09:00</td><td><div class="list-row-actions"><button type="button">查看</button><button type="button">编辑</button></div></td></tr></tbody></table></div>`;
        document.querySelector(".page-content").append(host);
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          select: Boolean(host.querySelector(".enhanced-select .enhanced-select-button")),
          date: Boolean(host.querySelector(".custom-date-picker .custom-date-button")),
          help: host.querySelector(".title-help-button").getAttribute("aria-controls"),
          rowMenu: Boolean(host.querySelector(".row-overflow-trigger")),
          settings: Boolean(host.querySelector(".table-settings-trigger")),
          subscribers: Kit.mutations.count(),
        };
      });
      assert.equal(result.select, true, "select enhanced");
      assert.equal(result.date, true, "date input enhanced");
      assert.equal(result.help, "helpTooltipLayer", "help button normalised");
      assert.equal(result.rowMenu, true, "row actions collapsed into a menu");
      assert.equal(result.settings, true, "table settings attached");
      assert.equal(result.subscribers, 5, "select, datetime, ui, loading and popover share one observer");
    });

    await check("filter popover submits its fields with the toolbar form", async () => {
      await desktop.goto(BASE + "/records");
      await desktop.locator(".list-filter-trigger").click();
      await desktop.waitForFunction(() => !document.getElementById("recordsFilters").hidden);
      await desktop.selectOption('#recordsFilters select[name="status"]', "failed");
      await Promise.all([desktop.waitForURL(/status=failed/), desktop.locator('#recordsFilters button[type="submit"]').click()]);
      assert.match(await desktop.locator(".list-filter-trigger").innerText(), /筛选 · 1/);
      await Promise.all([desktop.waitForURL(/per_page=50/), desktop.selectOption("select[data-page-size-nav]", { label: "50" })]);
    });

    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    watch(phone);
    await phone.goto(BASE + "/records");

    await check("mobile drawer opens, makes the page inert, closes on Escape", async () => {
      const toggle = phone.locator("#mobileMenuToggle");
      await toggle.click();
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      assert.equal(await phone.evaluate(() => document.querySelector(".main").inert), true);
      assert.equal(await phone.evaluate(() => document.documentElement.classList.contains("overlay-scroll-locked")), true);
      await phone.keyboard.press("Escape");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      await phone.waitForFunction(() => !document.querySelector(".main").inert, null, { timeout: 2000 });
      assert.equal(await phone.evaluate(() => document.documentElement.classList.contains("overlay-scroll-locked")), false);
    });

    await check("phone: nested group toggles without closing the drawer; side drawer fills the width", async () => {
      await phone.goto(BASE + "/overlays");
      await phone.locator("#mobileMenuToggle").click();
      await phone.locator(".nav-item-parent").click();
      assert.equal(await phone.evaluate(() => document.querySelector(".app-shell").classList.contains("sidebar-mobile-open")), true);
      assert.equal(await phone.locator(".nav-item-parent").getAttribute("aria-expanded"), "false");
      await phone.keyboard.press("Escape");
      await phone.waitForFunction(() => !document.querySelector(".main").inert, null, { timeout: 2000 });
      await phone.locator('[data-modal-open="detailDrawer"]').first().click();
      await phone.waitForFunction(() => document.getElementById("detailDrawer").contains(document.activeElement));
      const box = await phone.locator("#detailDrawer .drawer-panel").boundingBox();
      assert.equal(Math.round(box.width), 390);
      await phone.keyboard.press("Escape");
    });

    await check("phone: a 3-column table fits its wrapper, a 6-column table scrolls inside it", async () => {
      await phone.goto(BASE + "/");
      const widths = await phone.evaluate(() => {
        const make = (columns) => {
          const wrap = document.createElement("div");
          wrap.className = "table-wrap";
          wrap.innerHTML = `<table class="console-data-table"><thead><tr>${"<th>列</th>".repeat(columns)}</tr></thead><tbody><tr>${"<td>值</td>".repeat(columns)}</tr></tbody></table>`;
          document.querySelector(".page-content").append(wrap);
          return wrap.scrollWidth - wrap.clientWidth;
        };
        return { three: make(3), six: make(6) };
      });
      assert.equal(widths.three, 0, "a 3-column table has no inner scroll");
      assert.ok(widths.six > 0, "a 6-column table keeps its 680px floor and scrolls");
    });

    await check("no horizontal page overflow at 320, 768 and 1024px", async () => {
      for (const width of [320, 768, 1024]) {
        for (const route of ["/", "/records", "/components", "/overlays", "/settings", "/login"]) {
          await phone.setViewportSize({ width, height: 640 });
          await phone.goto(BASE + route);
          const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          assert.equal(overflow, 0, `${route} at ${width}px overflows by ${overflow}px`);
        }
      }
    });

    await check("axe: no serious or critical accessibility violations on any page", async () => {
      if (!AxeBuilder) { results.push("skip axe scan (@axe-core/playwright is not installed; run npm install)"); return; }
      // @axe-core/playwright needs a page from an explicit context.
      const scanContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const scan = await scanContext.newPage();
      const problems = [];
      for (const route of ["/", "/records", "/components", "/overlays", "/settings", "/login"]) {
        await scan.goto(BASE + route);
        await scan.waitForFunction(() => document.querySelector("[data-route-progress]")?.hidden, null, { timeout: 5000 }).catch(() => {});
        const report = await new AxeBuilder({ page: scan }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "best-practice"]).analyze();
        report.violations.forEach((violation) => {
          const targets = violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(" | ");
          problems.push(`${route} [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes.length}) -> ${targets}`);
        });
      }
      await scanContext.close();
      const blocking = problems.filter((line) => /\[(serious|critical)\]/.test(line));
      problems.filter((line) => !/\[(serious|critical)\]/.test(line)).forEach((line) => results.push(`note ${line}`));
      assert.deepEqual(blocking, []);
    });

    await check("no console errors", async () => assert.deepEqual(consoleErrors, []));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`[${BROWSER}]`);
  console.log(results.join("\n"));
})();
