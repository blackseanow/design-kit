// Run from design-kit/:  node --test tests/js/kit.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const STATIC = path.join(__dirname, "..", "..", "design_kit", "static");
const { createRouteProgress, createPageProgress } = require(path.join(STATIC, "route-progress.js"));
const core = require(path.join(STATIC, "core.js"));

function progressHarness(reduced = false) {
  let clock = 0, serial = 0;
  const jobs = new Map(), frames = [];
  const control = createRouteProgress({
    render: (state) => frames.push({ ...state }),
    reducedMotion: () => reduced,
    schedule: (fn, delay) => { const id = ++serial; jobs.set(id, { at: clock + delay, fn }); return id; },
    cancel: (id) => jobs.delete(id),
  });
  const tick = (delay) => {
    const end = clock + delay;
    for (;;) {
      const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      clock = next[1].at; jobs.delete(next[0]); next[1].fn();
    }
    clock = end;
  };
  return { control, tick, frames, jobs };
}

test("progress: pending never claims completion and only moves forward", () => {
  const { control, tick, frames } = progressHarness();
  control.start();
  tick(60000);
  assert.equal(control.snapshot().phase, "loading");
  assert.ok(control.snapshot().progress <= 0.94);
  assert.ok(frames.every((frame, i) => i === 0 || frame.progress >= frames[i - 1].progress));
});

test("progress: finish fills, fades after 200ms, then hides", () => {
  const { control, tick, jobs } = progressHarness();
  const token = control.start();
  tick(400);
  control.finish(token);
  assert.deepEqual(control.snapshot(), { phase: "settling", progress: 1 });
  tick(199); assert.equal(control.snapshot().phase, "settling");
  tick(1); assert.equal(control.snapshot().phase, "fading");
  tick(200); assert.deepEqual(control.snapshot(), { phase: "idle", progress: 0 });
  assert.equal(jobs.size, 0);
});

test("progress: a stale finish cannot end a newer load", () => {
  const { control, tick } = progressHarness();
  const first = control.start();
  tick(200);
  control.start();
  control.finish(first);
  assert.equal(control.snapshot().phase, "loading");
});

test("progress: reduced motion does not trickle", () => {
  const { control, tick } = progressHarness(true);
  control.start();
  tick(5000);
  assert.equal(control.snapshot().progress, 0.08);
});

test("page progress: bar stays until every request finishes", () => {
  const { control, tick } = progressHarness();
  const page = createPageProgress(control, { page: "a" });
  const one = page.begin();
  const two = page.begin();
  one.finish();
  tick(1000);
  assert.equal(control.snapshot().phase, "loading");
  two.finish();
  tick(1000);
  assert.equal(control.snapshot().phase, "idle");
});

test("page progress: navigating drops reads owned by the old page", () => {
  const { control, tick } = progressHarness();
  const page = createPageProgress(control, { page: "a" });
  page.begin();
  const next = page.navigate("b");
  next.finish();
  tick(1000);
  assert.equal(control.snapshot().phase, "idle");
});

test("menu bounds: opens below with a 12px edge and minimum width", () => {
  const bounds = core.selectMenuBounds({ left: 4, top: 100, bottom: 140, width: 120 }, { left: 0, top: 0, width: 1000, height: 800 });
  assert.equal(bounds.left, 12);
  assert.equal(bounds.width, 192);
  assert.equal(bounds.upwards, false);
  assert.equal(bounds.top, 150);
});

test("menu bounds: opens upwards near the bottom edge", () => {
  const bounds = core.selectMenuBounds({ left: 100, top: 700, bottom: 740, width: 300 }, { left: 0, top: 0, width: 1000, height: 800 });
  assert.equal(bounds.upwards, true);
  assert.ok(bounds.top + bounds.height <= 700 - bounds.gap);
});

test("menu bounds: never wider than the viewport minus edges", () => {
  const bounds = core.selectMenuBounds({ left: 0, top: 10, bottom: 50, width: 500 }, { left: 0, top: 0, width: 320, height: 600 });
  assert.equal(bounds.width, 296);
});

test("focus trap wraps from last to first", () => {
  const items = [{ focus() { this.focused = true; } }, { focus() { this.focused = true; } }];
  const container = { querySelectorAll: () => items, contains: (node) => items.includes(node) };
  let prevented = false;
  const event = { key: "Tab", shiftKey: false, preventDefault() { prevented = true; } };
  assert.equal(core.a11y.trapTabKey(event, container, items[1]), true);
  assert.equal(prevented, true);
  assert.equal(items[0].focused, true);
});

function loadTheme({ stored = null, prefersDark = false, key = "beta-theme" } = {}) {
  const listeners = [];
  const root = { dataset: { themeKey: key }, style: {} };
  const document = {
    readyState: "complete",
    documentElement: root,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const media = { matches: prefersDark, addEventListener: (type, listener) => listeners.push(listener) };
  const localStorage = {
    store: { [key]: stored },
    getItem(name) { return this.store[name] ?? null; },
    setItem(name, value) { this.store[name] = value; },
  };
  const window = { matchMedia: () => media, localStorage };
  vm.runInNewContext(fs.readFileSync(path.join(STATIC, "theme.js"), "utf8"), { window, document, console, setTimeout, clearTimeout });
  return { api: window.Kit.theme, root, localStorage, listeners, media };
}

test("theme: uses the key from <html data-theme-key>", () => {
  const state = loadTheme({ stored: "dark" });
  assert.equal(state.api.storageKey, "beta-theme");
  assert.equal(state.root.dataset.theme, "dark");
  state.api.setTheme("light");
  assert.equal(state.localStorage.store["beta-theme"], "light");
});

test("theme: invalid stored value follows the system", () => {
  const state = loadTheme({ stored: "purple", prefersDark: true });
  assert.equal(state.api.getTheme(), "system");
  assert.equal(state.root.dataset.theme, "dark");
});

test("theme: system preference tracks OS changes", () => {
  const state = loadTheme({ stored: "system" });
  assert.equal(state.root.dataset.theme, "light");
  state.media.matches = true;
  state.listeners.forEach((listener) => listener());
  assert.equal(state.root.dataset.theme, "dark");
});

test("theme: explicit choice ignores OS changes", () => {
  const state = loadTheme({ stored: "light" });
  state.media.matches = true;
  state.listeners.forEach((listener) => listener());
  assert.equal(state.root.dataset.theme, "light");
});
