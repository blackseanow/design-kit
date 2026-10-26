/* Global notification. Behaviour follows showGlobalFeedback in the source
   project's admin.js: one live region, success/error/warning auto-hide,
   hover/focus pauses the timer, Escape closes, focus returns to its origin.
   Server-side flashes rendered by macros.flash_messages() are shown on load. */
(function (root, document) {
  "use strict";
  if (!document) return;
  const Kit = root.Kit = root.Kit || {};

  const titles = { info: "操作提示", loading: "正在处理", success: "操作成功", warning: "需要处理", error: "操作失败" };
  const paths = {
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    loading: '<path d="M12 3a9 9 0 1 1-9 9"/>',
    success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    warning: '<path d="m10.3 3.9-8.1 14a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3l-8.1-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
  };
  const defaultTimeout = { success: 3200, error: 7000, warning: 6000 };
  let node = null, timer = null, hideTimer = null, deadline = 0, remaining = 0, autoHide = false, returnFocus = null;
  const pauses = new Set();

  function ensureNode() {
    if (node) return node;
    node = document.createElement("div");
    node.id = "globalFeedback";
    node.className = "global-feedback hidden";
    node.setAttribute("aria-hidden", "true");
    node.innerHTML = `<span class="global-feedback-icon" aria-hidden="true"></span>
      <div class="global-feedback-copy"><strong></strong><div class="global-feedback-message" tabindex="-1"></div></div>
      <button class="global-feedback-close" type="button" aria-label="关闭提示">${Kit.iconMarkup ? Kit.iconMarkup("x") : "×"}</button>`;
    node.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") pause("hover"); });
    node.addEventListener("pointerleave", () => resume("hover"));
    node.addEventListener("focusin", () => pause("focus"));
    node.addEventListener("focusout", (event) => { if (!node.contains(event.relatedTarget)) resume("focus"); });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); hide(); }
    });
    node.querySelector(".global-feedback-close").addEventListener("click", (event) => { event.stopPropagation(); hide(); });
    document.body.append(node);
    return node;
  }

  // An open modal makes its siblings inert, so the notification lives inside it.
  function syncHost() {
    if (!node) return;
    const host = Kit.modal?.top?.() || document.body;
    if (node.parentElement !== host) host.append(node);
    node.inert = !node.classList.contains("visible");
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!autoHide || pauses.size || !node?.classList.contains("visible")) return;
    deadline = Date.now() + remaining;
    timer = setTimeout(hide, Math.max(0, remaining));
  }
  function pause(reason) {
    if (timer !== null) { remaining = Math.max(0, deadline - Date.now()); clearTimeout(timer); timer = null; }
    pauses.add(reason);
  }
  function resume(reason) { if (pauses.delete(reason)) schedule(); }

  function show(message, type = "info", options = {}) {
    const feedback = ensureNode();
    const tone = Object.hasOwn(titles, type) ? type : "info";
    if (!feedback.contains(document.activeElement)) returnFocus = document.activeElement;
    clearTimeout(timer); clearTimeout(hideTimer); timer = null; hideTimer = null;
    feedback.className = `global-feedback ${tone} visible`;
    feedback.setAttribute("aria-hidden", "false");
    feedback.setAttribute("role", tone === "error" ? "alert" : "status");
    feedback.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
    feedback.querySelector("strong").textContent = options.title || titles[tone];
    const body = feedback.querySelector(".global-feedback-message");
    body.textContent = String(message ?? "");
    body.scrollTop = 0;
    feedback.querySelector(".global-feedback-icon").innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[tone]}</svg>`;
    syncHost();
    pauses.clear();
    if (feedback.matches(":hover") && root.matchMedia?.("(hover: hover)").matches) pauses.add("hover");
    const timeout = Number(options.timeout ?? defaultTimeout[tone] ?? 0);
    remaining = Number.isFinite(timeout) ? Math.max(0, timeout) : 0;
    autoHide = remaining > 0;
    schedule();
  }

  function hide() {
    if (!node) return;
    clearTimeout(timer); clearTimeout(hideTimer); timer = null; autoHide = false; pauses.clear();
    if (node.contains(document.activeElement)) {
      const modal = Kit.modal?.top?.();
      const origin = returnFocus;
      const target = origin?.isConnected && !origin.closest("[inert],.hidden,[hidden]") && (!modal || modal.contains(origin))
        ? origin : modal?.querySelector(".modal-close-button");
      if (target) target.focus({ preventScroll: true });
      else document.activeElement?.blur?.();
    }
    node.classList.remove("visible");
    node.setAttribute("aria-hidden", "true");
    node.inert = true;
    const delay = root.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
    hideTimer = setTimeout(() => { node.classList.add("hidden"); hideTimer = null; }, delay);
  }

  function showFlashes() {
    const flashes = [...document.querySelectorAll("[data-kit-flash]")];
    if (!flashes.length) return;
    // Show the most important one; errors win over everything else.
    const order = ["error", "warning", "success", "info"];
    flashes.sort((a, b) => order.indexOf(a.dataset.kitFlash) - order.indexOf(b.dataset.kitFlash));
    const first = flashes[0];
    show(first.textContent.trim(), first.dataset.kitFlash);
  }

  Kit.feedback = {
    show, hide, syncHost,
    success: (message, options) => show(message, "success", options),
    error: (error, options) => show(error?.message || String(error || "请求失败"), "error", options),
    loading: (message, options) => show(message, "loading", options),
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showFlashes, { once: true });
  else showFlashes();
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
