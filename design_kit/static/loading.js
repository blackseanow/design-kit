/* Loading lifecycle and placement.
   The controller: 150ms delay before anything shows, at least 450ms visible,
   120ms completion, 100ms fade, one entry per scope, cancel / fail.
   Placement keeps the spinner and text inside the visible part of a tall list
   and shows a fixed fallback pill when the mask itself is scrolled out of view.
   Kit.loading.run(host, task) wires the controller to a mask built with
   Kit.ui.LoadingState, turns a failed task into an error overlay with a retry
   button (the content behind it is kept), and Kit.loading.title() drives the
   reserved spinner slot in page_header(loading=true). */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) root.Kit = Object.assign(root.Kit || {}, { loading: api.loading });
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  /* ---- Controller (pure; injectable clock for tests) ---- */
  function createLoadingController(options = {}) {
    const delayMs = Math.max(0, Number(options.delayMs ?? 150));
    const minVisibleMs = Math.max(0, Number(options.minVisibleMs ?? 450));
    const completionMs = Math.max(0, Number(options.completionMs ?? 120));
    const fadeMs = Math.max(0, Number(options.fadeMs ?? 100));
    const clock = options.clock || {
      now: () => Date.now(),
      setTimeout: (callback, delay) => setTimeout(callback, delay),
      clearTimeout: (id) => clearTimeout(id),
    };
    const scopes = new Map();
    let serial = 0;
    const isCurrent = (entry) => scopes.get(entry.scope) === entry;
    function call(entry, name, ...args) {
      const hook = entry.hooks?.[name];
      if (typeof hook !== "function") return;
      try { hook(...args); } catch (error) { if (typeof console !== "undefined") console.error(`Loading hook failed: ${name}`, error); }
    }
    function schedule(entry, callback, delay) {
      const id = clock.setTimeout(() => { entry.timers.delete(id); callback(); }, Math.max(0, Number(delay || 0)));
      entry.timers.add(id);
      return id;
    }
    function clearTimers(entry) { entry.timers.forEach((id) => clock.clearTimeout(id)); entry.timers.clear(); }
    function resolveCompletion(entry) { const resolve = entry.completionResolve; entry.completionResolve = null; if (resolve) resolve(); }
    function settle(entry) {
      clearTimers(entry);
      entry.settled = true;
      if (isCurrent(entry)) scopes.delete(entry.scope);
      resolveCompletion(entry);
    }
    function complete(entry) {
      if (entry.completionPromise) return entry.completionPromise;
      if (!isCurrent(entry) || entry.settled) return Promise.resolve();
      entry.completionPromise = new Promise((resolve) => { entry.completionResolve = resolve; });
      // Finished before the delay: nothing was shown, nothing to hide.
      if (entry.shownAt === null) { settle(entry); return entry.completionPromise; }
      const remainingVisible = Math.max(0, minVisibleMs - Math.max(0, clock.now() - entry.shownAt));
      schedule(entry, () => {
        if (!isCurrent(entry) || entry.settled) { settle(entry); return; }
        entry.state = "completing";
        call(entry, "onComplete", 1);
        schedule(entry, () => {
          if (!isCurrent(entry) || entry.settled) { settle(entry); return; }
          entry.state = "fading";
          call(entry, "onFade");
          schedule(entry, () => {
            if (!isCurrent(entry) || entry.settled) { settle(entry); return; }
            call(entry, "onHide");
            settle(entry);
          }, fadeMs);
        }, completionMs);
      }, remainingVisible);
      return entry.completionPromise;
    }
    function fail(entry, error) {
      if (!isCurrent(entry) || entry.settled) return Promise.resolve();
      clearTimers(entry);
      entry.state = "error";
      call(entry, "onError", error);
      settle(entry);
      return Promise.resolve();
    }
    function cancel(entry, notifyHide) {
      if (entry.settled) return;
      const wasCurrent = isCurrent(entry);
      clearTimers(entry);
      if (notifyHide && entry.shownAt !== null) call(entry, "onHide");
      entry.state = "cancelled";
      entry.settled = true;
      if (wasCurrent) scopes.delete(entry.scope);
      resolveCompletion(entry);
    }
    function begin(scope, hooks = {}) {
      const key = String(scope || "").trim();
      if (!key) throw new Error("Loading scope is required");
      const previous = scopes.get(key);
      if (previous) cancel(previous, true);
      const entry = { id: ++serial, scope: key, hooks, state: "delaying", shownAt: null, timers: new Set(), settled: false, completionPromise: null, completionResolve: null };
      scopes.set(key, entry);
      const show = () => {
        if (!isCurrent(entry) || entry.settled) return;
        entry.state = "loading";
        entry.shownAt = clock.now();
        call(entry, "onShow");
        call(entry, "onProgress", 0.86);
      };
      if (hooks.immediate) show();
      else schedule(entry, show, delayMs);
      return {
        id: entry.id,
        scope: key,
        isCurrent: () => isCurrent(entry) && !entry.settled,
        state: () => entry.state,
        complete: () => complete(entry),
        fail: (error) => fail(entry, error),
        cancel: () => cancel(entry, true),
      };
    }
    return { begin, isActive: (scope) => scopes.has(String(scope || "")), options: { delayMs, minVisibleMs, completionMs, fadeMs } };
  }

  /* ---- Placement helpers (pure) ---- */
  function intersect(area, clip, x = true, y = true) {
    return {
      left: x ? Math.max(area.left, clip.left) : area.left,
      right: x ? Math.min(area.right, clip.right) : area.right,
      top: y ? Math.max(area.top, clip.top) : area.top,
      bottom: y ? Math.min(area.bottom, clip.bottom) : area.bottom,
    };
  }
  function placement(area, height) {
    const width = area.right - area.left;
    if (width < 64 || area.bottom - area.top < height + 16) return null;
    return { x: (area.left + area.right) / 2, y: (area.top + area.bottom) / 2, width: width - 24 };
  }

  const document = root?.document;
  if (!document) return { createLoadingController, intersect, placement, loading: null };
  const Kit = root.Kit = root.Kit || {};

  /* ---- Mask lifecycle: Kit.loading.run(host, task, options) ---- */
  const controller = createLoadingController();
  const masks = new WeakMap();
  let autoScope = 0;
  const $ = (id) => (typeof id === "string" ? document.getElementById(id) : id);

  function mountMask(host, label) {
    let mask = masks.get(host);
    if (mask && (!mask.isConnected || mask.classList.contains("is-error"))) { mask.remove(); mask = null; }
    if (!mask) {
      mask = Kit.ui.LoadingState({ label });
      masks.set(host, mask);
    } else {
      mask.classList.remove("is-leaving");
      const text = mask.querySelector(".page-list-loading-text");
      if (text && text.textContent !== label) text.textContent = label;
    }
    if (!host.classList.contains("is-refresh-loading")) { host.classList.add("is-refresh-loading"); mask.dataset.addedHostClass = "true"; }
    host.setAttribute("aria-busy", "true");
    if (mask.parentElement !== host) host.append(mask);
    return mask;
  }
  function unmountMask(host) {
    const mask = masks.get(host);
    masks.delete(host);
    if (!mask) return;
    mask.remove();
    if (mask.dataset.addedHostClass) host.classList.remove("is-refresh-loading");
    host.removeAttribute("aria-busy");
  }
  function showError(host, error, options, retry) {
    unmountMask(host);
    const mask = document.createElement("div");
    mask.className = "page-list-loading is-error";
    mask.dataset.uiComponent = "ErrorState";
    mask.setAttribute("role", "alert");
    const title = document.createElement("strong");
    title.className = "page-list-loading-title";
    title.textContent = options.errorTitle || "读取失败";
    const text = document.createElement("span");
    text.className = "page-list-loading-text";
    text.textContent = options.errorDescription || (error && error.message) || "请稍后重试。";
    mask.append(title, text);
    if (retry) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn-secondary btn-small";
      button.textContent = options.retryLabel || "重试";
      button.addEventListener("click", () => { retry(); });
      mask.append(button);
    }
    masks.set(host, mask);
    if (!host.classList.contains("is-refresh-loading")) { host.classList.add("is-refresh-loading"); mask.dataset.addedHostClass = "true"; }
    host.removeAttribute("aria-busy");
    host.append(mask);
    return mask;
  }
  // Runs task() with the shared loading contract: nothing for 150ms, then a mask
  // over host for at least 450ms, then a 100ms fade. A rejected task leaves an
  // error overlay with a retry button; the promise rejects with the same error.
  function run(host, task, options = {}) {
    const node = $(host);
    if (!node) return Promise.resolve().then(task);
    const label = options.label || "正在加载数据";
    if (!node.dataset.loadingScope) node.dataset.loadingScope = options.scope || node.id || `kit-loading-${++autoScope}`;
    const scope = options.scope || node.dataset.loadingScope;
    const ticket = controller.begin(scope, {
      immediate: Boolean(options.immediate),
      onShow: () => mountMask(node, label),
      onFade: () => masks.get(node)?.classList.add("is-leaving"),
      onHide: () => unmountMask(node),
      onError: (error) => showError(node, error, options, options.retry === false ? null : () => run(node, task, options)),
    });
    node.dispatchEvent(new CustomEvent("kit:loading-start", { bubbles: true, detail: { scope } }));
    return Promise.resolve().then(task).then(
      async (result) => { await ticket.complete(); node.dispatchEvent(new CustomEvent("kit:loading-end", { bubbles: true, detail: { scope, ok: true } })); return result; },
      async (error) => { await ticket.fail(error); node.dispatchEvent(new CustomEvent("kit:loading-end", { bubbles: true, detail: { scope, ok: false, error } })); throw error; },
    );
  }
  function clear(host) {
    const node = $(host);
    if (!node) return;
    if (node.dataset.loadingScope && controller.isActive(node.dataset.loadingScope)) controller.begin(node.dataset.loadingScope).cancel();
    unmountMask(node);
  }
  function title(busy) {
    document.querySelectorAll("[data-page-title-loading]").forEach((slot) => { slot.hidden = !busy; });
  }
  const whenReady = (callback) => { if (root.KitStartup?.whenReady) root.KitStartup.whenReady(callback); else callback(); };

  /* ---- Viewport follow (port of loading-viewport.js) ---- */
  const records = new Map();
  const fallbacks = new Map();
  const clips = (value) => /^(auto|scroll|hidden|clip)$/.test(value);
  let frame = 0;
  function schedule() { if (!frame && (records.size || fallbacks.size)) frame = root.requestAnimationFrame(update); }
  function viewport() {
    const visual = root.visualViewport;
    const left = visual?.offsetLeft || 0, top = visual?.offsetTop || 0;
    return { left, top, right: left + (visual?.width || root.innerWidth), bottom: top + (visual?.height || root.innerHeight) };
  }
  function clientRect(element) {
    const rect = element.getBoundingClientRect();
    const left = rect.left + element.clientLeft, top = rect.top + element.clientTop;
    return { left, top, right: left + element.clientWidth, bottom: top + element.clientHeight };
  }
  function visibleArea(node, scope) {
    let area = intersect(node.getBoundingClientRect(), viewport());
    for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = root.getComputedStyle(parent);
      area = intersect(area, clientRect(parent), clips(style.overflowX), clips(style.overflowY));
    }
    if (!scope.matches(".modal-backdrop")) {
      const header = document.querySelector(".workspace-header");
      if (header) area.top = Math.max(area.top, header.getBoundingClientRect().bottom);
    }
    return area;
  }
  function writeStyle(node, property, value) { if (node.style.getPropertyValue(property) !== value) node.style.setProperty(property, value); }
  function track(node) {
    if (records.has(node) || !node.parentElement) return;
    // Server-rendered feedback keeps its spinner node: moving an animated node restarts it.
    let content = node.querySelector(":scope > .page-list-loading-content");
    if (!content) {
      content = document.createElement("span");
      content.className = "page-list-loading-content";
      content.append(...node.childNodes);
      node.append(content);
    }
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    if (observer) {
      observer.observe(content);
      for (let parent = node.parentElement; parent; parent = parent.parentElement) observer.observe(parent);
    }
    records.set(node, { content, observer });
    schedule();
  }
  function update() {
    frame = 0;
    const scopes = new Map();
    records.forEach((record, node) => {
      if (!node.isConnected) { record.observer?.disconnect(); records.delete(node); return; }
      const { content } = record;
      const host = node.parentElement;
      if (!node.getClientRects().length || node.closest("[inert], [hidden], .hidden")) return;
      const scope = node.closest(".modal-backdrop") || node.closest(".main") || host;
      // A mask inside a scroll container covers all of the scrollable content.
      if (!node.classList.contains("role-inline-loading")) {
        const style = root.getComputedStyle(host);
        writeStyle(node, "height", "");
        writeStyle(node, "width", "");
        if (clips(style.overflowY)) writeStyle(node, "height", `${Math.max(host.clientHeight, host.scrollHeight)}px`);
        if (clips(style.overflowX)) writeStyle(node, "width", `${Math.max(host.clientWidth, host.scrollWidth)}px`);
      }
      const area = visibleArea(node, scope);
      writeStyle(content, "max-width", `${Math.max(0, area.right - area.left - 24)}px`);
      const position = placement(area, content.offsetHeight);
      const pending = scopes.get(scope) || { visible: false, labels: [] };
      scopes.set(scope, pending);
      content.style.visibility = position ? "visible" : "hidden";
      if (position) {
        const bounds = node.getBoundingClientRect();
        writeStyle(content, "left", `${position.x - bounds.left}px`);
        writeStyle(content, "top", `${position.y - bounds.top}px`);
        pending.visible = true;
      } else if (!node.classList.contains("is-leaving") && !node.classList.contains("is-error")) {
        pending.labels.push(node.querySelector(".page-list-loading-text")?.textContent || "正在加载数据");
      }
    });
    const used = new Set();
    scopes.forEach((pending, scope) => {
      if (pending.visible || !pending.labels.length) return;
      const area = visibleArea(scope, scope);
      if (area.right - area.left < 80 || area.bottom - area.top < 64) return;
      let notice = fallbacks.get(scope);
      if (!notice) {
        notice = document.createElement("div");
        notice.className = "loading-viewport-fallback";
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        notice.innerHTML = '<span class="page-list-loading-spinner" aria-hidden="true"></span><span class="page-list-loading-text"></span>';
        // Modal feedback stays in the modal's focus scope; page feedback sits outside clipped lists.
        (scope.matches(".modal-backdrop") ? scope : document.body).append(notice);
        fallbacks.set(scope, notice);
      }
      const text = notice.querySelector(".page-list-loading-text");
      const label = pending.labels.length === 1 ? pending.labels[0] : `正在加载 ${pending.labels.length} 项数据`;
      if (text.textContent !== label) text.textContent = label;
      writeStyle(notice, "left", `${(area.left + area.right) / 2}px`);
      writeStyle(notice, "top", `${area.top + 12}px`);
      writeStyle(notice, "max-width", `${area.right - area.left - 24}px`);
      used.add(scope);
    });
    fallbacks.forEach((notice, scope) => { if (!used.has(scope)) { notice.remove(); fallbacks.delete(scope); } });
  }
  function discover(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(".page-list-loading")) track(node);
    node.querySelectorAll(".page-list-loading").forEach(track);
  }
  function init() {
    discover(document.body);
    Kit.mutations.subscribe(({ added }) => { added.forEach(discover); schedule(); });
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    root.addEventListener("resize", schedule);
    root.visualViewport?.addEventListener("resize", schedule);
    root.visualViewport?.addEventListener("scroll", schedule);
  }

  const loading = { controller, begin: controller.begin, run, clear, title, whenReady, reposition: schedule, createLoadingController };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
  return { createLoadingController, intersect, placement, loading };
});
