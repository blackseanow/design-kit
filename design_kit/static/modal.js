/* ModalShell. Behaviour follows showModal/hideModal in the source project's
   admin.js and ModalShell in static/ui-system.js, without business hooks:
   - stacked dialogs, only the top one is interactive (siblings inert);
   - focus moves in on open (touch layouts focus the close button so the
     keyboard does not pop up), stays trapped, and returns to the opener;
   - Escape / backdrop close only when data-modal-dismissible="true";
   - page scroll is locked without layout shift.
   Markup: macros.modal(). Triggers: [data-modal-open="id"], [data-modal-close].
   Events on the modal element: kit:modal-open, kit:modal-close. */
(function (root, document) {
  "use strict";
  if (!document) return;
  const Kit = root.Kit = root.Kit || {};
  const a11y = Kit.a11y;
  const STACK_BASE = 1000;
  let stackSeed = STACK_BASE;
  const returnFocus = new WeakMap();
  const managedInert = new Map();
  const closeHandlers = new Map();
  const $ = (id) => (typeof id === "string" ? document.getElementById(id) : id);

  const openModals = () => [...document.querySelectorAll(".modal-backdrop:not(.hidden)")]
    .sort((a, b) => Number(a.dataset.modalStack || 0) - Number(b.dataset.modalStack || 0));
  const top = () => openModals().pop() || null;

  function describe(modal) {
    modal.dataset.uiComponent = "ModalShell";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const heading = modal.querySelector(".modal-head h2");
    if (heading && !modal.hasAttribute("aria-labelledby")) {
      heading.id ||= `${modal.id}-title`;
      modal.setAttribute("aria-labelledby", heading.id);
    }
    const description = modal.querySelector(".modal-head p, [data-modal-description]");
    if (description && !modal.hasAttribute("aria-describedby")) {
      description.id ||= `${modal.id}-description`;
      modal.setAttribute("aria-describedby", description.id);
    }
    const head = modal.querySelector(".modal-head");
    if (head && !modal.querySelector(".modal-close-button") && modal.dataset.modalCloseButton !== "false") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "modal-close-button";
      button.setAttribute("aria-label", "关闭弹窗");
      button.dataset.modalClose = "";
      head.append(button);
    }
  }

  function focusTarget(modal) {
    const focusable = a11y.focusableElements(modal);
    // Touch users choose when to bring up the keyboard; keep the dialog announced.
    if (Kit.isTouchLayout()) {
      const close = focusable.find((node) => node.matches(".modal-close-button"));
      if (close) return close;
      const panel = modal.querySelector(".modal-panel") || modal;
      panel.tabIndex = -1;
      return panel;
    }
    if (focusable.length) return focusable.find((node) => node.matches("[autofocus], input, textarea")) || focusable.find((node) => node.matches(".modal-close-button")) || focusable[0];
    modal.tabIndex = -1;
    return modal;
  }

  function focusAfterPaint(target) {
    const run = () => {
      if (!target || target.disabled || !target.isConnected) return;
      const modal = target.closest?.(".modal-backdrop");
      if (modal && (modal.classList.contains("hidden") || top() !== modal)) return;
      a11y.focusElement(target);
    };
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(run);
    else setTimeout(run, 0);
  }

  function syncStacking() {
    const current = top();
    document.querySelectorAll(".modal-backdrop").forEach((modal) => {
      const active = modal === current;
      modal.classList.toggle("active-modal", active);
      const inactive = modal.classList.contains("hidden") || !active;
      modal.setAttribute("aria-hidden", String(inactive));
    });
    Kit.feedback?.syncHost?.();
    a11y.syncManagedInert([...document.body.children], current, managedInert);
  }

  // Shared with shell.js: lock when a modal or the mobile drawer is open.
  function syncScrollLock() {
    const html = document.documentElement;
    const modalOpen = Boolean(document.querySelector(".modal-backdrop:not(.hidden)"));
    const drawerOpen = document.body.classList.contains("sidebar-drawer-open") && Kit.isDrawerLayout();
    const lock = modalOpen || drawerOpen;
    // Styled scrollbar tracks disappear under overflow:hidden; reserve their width.
    if (lock && !html.classList.contains("overlay-scroll-locked")) {
      html.style.setProperty("--overlay-scrollbar-width", `${Math.max(0, root.innerWidth - html.getBoundingClientRect().width)}px`);
    }
    html.classList.toggle("overlay-scroll-locked", lock);
    document.body.classList.toggle("overlay-scroll-locked", lock);
    document.body.classList.toggle("modal-open", modalOpen);
    if (!lock) html.style.removeProperty("--overlay-scrollbar-width");
  }

  function open(id) {
    const modal = $(id);
    if (!modal) return;
    Kit.ui?.hideHelp?.();
    Kit.popups?.closeAll();
    describe(modal);
    const wasHidden = modal.classList.contains("hidden");
    if (wasHidden) {
      const active = document.activeElement;
      if (active && active !== document.body && !modal.contains(active)) returnFocus.set(modal, active);
      modal.querySelectorAll(".modal-body").forEach((body) => { body.scrollTop = 0; body.scrollLeft = 0; });
    }
    if (modal.parentElement !== document.body) document.body.append(modal);
    modal.classList.remove("hidden");
    modal.dataset.modalStack = String(++stackSeed);
    modal.style.zIndex = String(stackSeed);
    syncStacking();
    syncScrollLock();
    if (!modal.contains(document.activeElement)) focusAfterPaint(focusTarget(modal));
    if (wasHidden) modal.dispatchEvent(new CustomEvent("kit:modal-open", { bubbles: true }));
  }

  function hide(id) {
    const modal = $(id);
    if (!modal || modal.classList.contains("hidden")) return;
    Kit.popups?.closeAll();
    if (modal.contains(document.activeElement)) Kit.ui?.hideHelp?.();
    const wasTop = top() === modal;
    const origin = returnFocus.get(modal) || null;
    modal.classList.add("hidden");
    delete modal.dataset.modalStack;
    modal.style.zIndex = "";
    modal.classList.remove("active-modal");
    syncStacking();
    if (!document.querySelector(".modal-backdrop:not(.hidden)")) stackSeed = STACK_BASE;
    syncScrollLock();
    returnFocus.delete(modal);
    modal.dispatchEvent(new CustomEvent("kit:modal-close", { bubbles: true }));
    if (!wasTop) return;
    const next = top();
    let target = origin;
    if (next && (!target || !next.contains(target))) target = focusTarget(next);
    if (!next && target && (!document.contains(target) || target.inert)) target = null;
    if (target) focusAfterPaint(target);
  }

  // reason: "button" | "escape" | "backdrop" | "programmatic"
  function close(id, reason = "programmatic") {
    const modal = $(id);
    if (!modal || modal.classList.contains("hidden")) return false;
    if ((reason === "backdrop" || reason === "escape") && modal.dataset.modalDismissible !== "true") return false;
    const handler = closeHandlers.get(modal.id);
    if (handler) {
      // A handler can refuse (e.g. while a request is in flight) by returning false.
      if (handler(reason) === false) return false;
    }
    hide(modal);
    return true;
  }

  const closeTop = (reason = "escape") => { const modal = top(); return modal ? close(modal, reason) : false; };

  // Promise-based confirmation; replaces window.confirm with the shared surface.
  let confirmSeq = 0;
  function confirm({ title = "确认操作", message = "", confirmLabel = "确认", cancelLabel = "取消", danger = false } = {}) {
    return new Promise((resolve) => {
      const id = `kitConfirm${++confirmSeq}`;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `<div id="${id}" class="modal-backdrop hidden" data-modal-dismissible="true">
        <div class="modal-panel modal-size-sm">
          <div class="modal-head"><div><h2></h2></div></div>
          <div class="modal-body"><p></p></div>
          <div class="modal-actions"><button type="button" class="btn-secondary" data-kit-cancel></button><button type="button" class="${danger ? "btn-danger" : "btn-primary"}" data-kit-confirm></button></div>
        </div></div>`;
      const modal = wrapper.firstElementChild;
      modal.querySelector("h2").textContent = title;
      modal.querySelector(".modal-body p").textContent = message;
      modal.querySelector("[data-kit-cancel]").textContent = cancelLabel;
      modal.querySelector("[data-kit-confirm]").textContent = confirmLabel;
      let result = false;
      modal.querySelector("[data-kit-confirm]").addEventListener("click", () => { result = true; hide(modal); });
      modal.querySelector("[data-kit-cancel]").addEventListener("click", () => hide(modal));
      modal.addEventListener("kit:modal-close", () => { resolve(result); setTimeout(() => modal.remove(), 0); }, { once: true });
      document.body.append(modal);
      open(modal);
      // Destructive confirmations start on the safe choice.
      if (danger) focusAfterPaint(modal.querySelector("[data-kit-cancel]"));
    });
  }

  // Keep CSS viewport variables in step with the visual viewport (mobile keyboards).
  function syncViewport() {
    const view = Kit.viewport();
    document.documentElement.style.setProperty("--ui-viewport-height", `${view.height}px`);
    document.documentElement.style.setProperty("--ui-viewport-top", `${view.top}px`);
  }

  function init() {
    document.querySelectorAll(".modal-backdrop").forEach(describe);
    syncStacking();
    syncViewport();
    root.visualViewport?.addEventListener("resize", syncViewport);
    root.visualViewport?.addEventListener("scroll", syncViewport);
    root.addEventListener("resize", syncViewport);
    document.addEventListener("click", (event) => {
      const opener = event.target.closest?.("[data-modal-open]");
      if (opener && !opener.disabled) { event.preventDefault(); open(opener.dataset.modalOpen); return; }
      const closer = event.target.closest?.("[data-modal-close]");
      if (closer) { const modal = closer.closest(".modal-backdrop"); if (modal) close(modal, "button"); }
    });
    // Backdrop: the press must start and end on the scrim itself.
    let pressedBackdrop = null;
    document.addEventListener("pointerdown", (event) => {
      pressedBackdrop = event.target.matches?.(".modal-backdrop") ? event.target : null;
    }, true);
    document.addEventListener("click", (event) => {
      if (pressedBackdrop && event.target === pressedBackdrop) close(pressedBackdrop, "backdrop");
      pressedBackdrop = null;
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        const current = top();
        if (current) a11y.trapTabKey(event, current, document.activeElement);
        return;
      }
      if (event.key === "Escape" && !event.defaultPrevented && top()) {
        event.preventDefault();
        closeTop("escape");
      }
    });
    document.addEventListener("focusin", (event) => {
      const current = top();
      if (current && !current.contains(event.target)) a11y.focusElement(focusTarget(current));
    }, true);
    root.addEventListener("pageshow", (event) => { if (event.persisted) openModals().forEach((modal) => hide(modal)); });
  }

  Kit.modal = {
    open, close, hide, closeTop, top, confirm, syncScrollLock,
    onClose: (id, handler) => closeHandlers.set(id, handler),
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
