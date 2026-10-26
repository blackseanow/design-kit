// Browser regression for the design kit demo. Uses fictional demo data only.
// Run from design-kit/:  PYTHON=python3 node tests/browser_check.js
// Needs Flask importable by $PYTHON and the playwright npm package.
const { spawn } = require("node:child_process");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

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
  const browser = await chromium.launch();
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
      await desktop.locator(".enhanced-select-button").first().click();
      assert.equal(await desktop.locator('.custom-date-menu[data-open="true"]').count(), 0);
      assert.equal(await desktop.locator('.enhanced-select-menu[data-open="true"]').count(), 1);
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

    await check("theme choice in the user menu persists under the configured key", async () => {
      await desktop.locator(".user-menu-trigger").click();
      await desktop.locator('[data-theme-choice="dark"]').click();
      assert.equal(await desktop.evaluate(() => document.documentElement.dataset.theme), "dark");
      assert.equal(await desktop.evaluate(() => localStorage.getItem("design-kit-demo-theme")), "dark");
      await desktop.reload();
      assert.equal(await desktop.evaluate(() => document.documentElement.dataset.theme), "dark");
      await desktop.evaluate(() => localStorage.removeItem("design-kit-demo-theme"));
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

    await check("no horizontal page overflow at 320px", async () => {
      for (const route of ["/", "/records", "/components", "/settings", "/login"]) {
        await phone.setViewportSize({ width: 320, height: 640 });
        await phone.goto(BASE + route);
        const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.equal(overflow, 0, `${route} overflows by ${overflow}px`);
      }
    });

    await check("no console errors", async () => assert.deepEqual(consoleErrors, []));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(results.join("\n"));
})();
