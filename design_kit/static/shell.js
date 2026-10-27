/* Application shell behaviour. Sources in the source project: setMobileSidebarOpen
   in admin.js (drawer) and static/workspace-header.js (user menu).
   Drawer (<=1023px): menu button, backdrop, Escape and navigation all close it;
   while open the page behind is inert and scroll-locked; focus returns to the
   menu button after the 350ms slide-out. */
(function (root, document) {
  "use strict";
  if (!document) return;
  const Kit = root.Kit = root.Kit || {};
  const drawerQuery = root.matchMedia?.("(max-width: 1023px)");
  let closeTimer = null, transitionToken = 0;

  const shell = () => document.querySelector("[data-app-shell]");
  const toggle = () => document.getElementById("mobileMenuToggle");

  function setDrawerOpen(open) {
    const app = shell();
    if (!app) return;
    const sidebar = app.querySelector(".sidebar");
    const main = app.querySelector(".main");
    const backdrop = app.querySelector(".sidebar-backdrop");
    const button = toggle();
    const mobile = Boolean(drawerQuery?.matches);
    open = Boolean(open && mobile);
    const wasOpen = app.classList.contains("sidebar-mobile-open");
    const token = ++transitionToken;
    clearTimeout(closeTimer);
    closeTimer = null;
    if (sidebar) sidebar.inert = mobile && !open;
    if (open) {
      app.setAttribute("role", "dialog");
      app.setAttribute("aria-modal", "true");
      app.setAttribute("aria-label", "主菜单");
    } else {
      app.removeAttribute("role");
      app.removeAttribute("aria-modal");
      app.removeAttribute("aria-label");
    }
    // Everything in the header except the menu button is inert while open.
    app.querySelectorAll(".workspace-header > :not(#mobileMenuToggle)").forEach((node) => { node.inert = open; });
    if (main) main.inert = open || (mobile && wasOpen);
    app.classList.toggle("sidebar-mobile-open", open);
    if (button) {
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    }
    if (backdrop) { backdrop.hidden = false; backdrop.setAttribute("aria-hidden", String(!open)); }
    if (open) {
      if (sidebar) sidebar.scrollTop = 0;
      document.body.classList.add("sidebar-drawer-open");
      Kit.modal?.syncScrollLock();
      Kit.a11y.focusElement(button);
      return;
    }
    if (!mobile || !wasOpen) {
      if (main) main.inert = false;
      document.body.classList.remove("sidebar-drawer-open");
      Kit.modal?.syncScrollLock();
      return;
    }
    // Keep the drawer and scroll lock alive until the slide-out finishes.
    const returnFocus = sidebar?.contains(document.activeElement);
    let interacted = false;
    const note = () => { interacted = true; };
    document.addEventListener("pointerdown", note, { capture: true, once: true });
    document.addEventListener("keydown", note, { capture: true, once: true });
    const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--drawer-duration")) || 0;
    closeTimer = setTimeout(() => {
      document.removeEventListener("pointerdown", note, true);
      document.removeEventListener("keydown", note, true);
      if (token !== transitionToken || app.classList.contains("sidebar-mobile-open")) return;
      closeTimer = null;
      if (main) main.inert = false;
      document.body.classList.remove("sidebar-drawer-open");
      Kit.modal?.syncScrollLock();
      if ((returnFocus || !interacted) && !Kit.modal?.top?.()) Kit.a11y.focusElement(button);
    }, duration);
  }

  function initDrawer() {
    const app = shell();
    if (!app) return;
    setDrawerOpen(false);
    drawerQuery?.addEventListener?.("change", () => setDrawerOpen(false));
    toggle()?.addEventListener("click", () => setDrawerOpen(!app.classList.contains("sidebar-mobile-open")));
    app.querySelector(".sidebar-backdrop")?.addEventListener("click", () => setDrawerOpen(false));
    app.querySelector(".sidebar")?.addEventListener("click", (event) => {
      if (event.target.closest("a.nav-item")) setDrawerOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (!app.classList.contains("sidebar-mobile-open") || Kit.modal?.top?.()) return;
      if (event.key === "Escape") { event.preventDefault(); setDrawerOpen(false); return; }
      if (event.key !== "Tab") return;
      // Focus cycles between the menu button and the drawer.
      const items = [toggle(), ...Kit.a11y.focusableElements(app.querySelector(".sidebar"))].filter(Boolean);
      const index = items.indexOf(document.activeElement);
      event.preventDefault();
      Kit.a11y.focusElement(items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length]);
    });
  }

  function initUserMenu() {
    const menu = document.querySelector("[data-user-menu]");
    const trigger = menu?.querySelector(".user-menu-trigger");
    const popover = menu?.querySelector(".user-menu-popover");
    if (!menu || !trigger || !popover) return;
    const owner = { name: "user-menu" };
    const items = () => [...popover.querySelectorAll("button:not(:disabled), a[href]")].filter((node) => node.tabIndex >= 0 && node.getClientRects().length && !node.closest('[role="radiogroup"]'));
    function close(restoreFocus = false) {
      if (popover.hidden) return;
      popover.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      Kit.popups?.closed(owner);
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }
    function open() {
      Kit.ui?.hideHelp?.();
      Kit.popups?.opened(owner, () => close());
      popover.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    }
    trigger.addEventListener("click", () => (popover.hidden ? open() : close()));
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown") return;
      event.preventDefault();
      event.stopPropagation();
      open();
      items()[0]?.focus();
    });
    document.addEventListener("pointerdown", (event) => { if (!popover.hidden && !menu.contains(event.target)) close(); });
    document.addEventListener("focusin", (event) => { if (!popover.hidden && !menu.contains(event.target)) close(); });
    menu.addEventListener("keydown", (event) => {
      if (!popover.hidden && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && !event.target.closest('[role="radiogroup"]')) {
        event.preventDefault();
        const list = items();
        const index = list.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? list.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
        list[next]?.focus();
      }
      if (event.key === "Escape" && !popover.hidden) { event.preventDefault(); event.stopPropagation(); close(true); }
    });
    drawerQuery?.addEventListener?.("change", () => close());
  }

  /* Nested navigation (kit addition): button.nav-item-parent[aria-expanded]
     toggles its .nav-subitems; a group with the current page inside starts open. */
  function setNavGroupOpen(button, open) {
    const list = document.getElementById(button.getAttribute("aria-controls") || "");
    button.setAttribute("aria-expanded", String(open));
    if (list) list.hidden = !open;
  }
  function initNestedNav() {
    document.querySelectorAll(".nav-item-parent[aria-controls]").forEach((button) => {
      const list = document.getElementById(button.getAttribute("aria-controls") || "");
      const hasActive = Boolean(list?.querySelector('.nav-item.active, .nav-item[aria-current="page"]'));
      button.classList.toggle("has-active", hasActive);
      if (hasActive) setNavGroupOpen(button, true);
      else setNavGroupOpen(button, button.getAttribute("aria-expanded") === "true");
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.(".nav-item-parent[aria-controls]");
      if (!button || button.disabled) return;
      event.preventDefault();
      setNavGroupOpen(button, button.getAttribute("aria-expanded") !== "true");
    });
  }

  /* Header badge: Kit.badge.set("notificationBell", 12). The count caps at
     max ("99+"), hides at 0 and is read into the button's aria-label. */
  function formatBadge(count, max = 99) {
    const value = Math.max(0, Math.floor(Number(count) || 0));
    return value > max ? `${max}+` : String(value);
  }
  function setBadge(target, count, { max = 99, suffix = "条未读" } = {}) {
    const host = typeof target === "string" ? document.getElementById(target) : target;
    if (!host) return null;
    const wrapper = host.closest(".header-badge-host") || host;
    const badge = wrapper.querySelector(".header-badge, .count-badge");
    const button = wrapper.querySelector("button, a") || host;
    const value = Math.max(0, Math.floor(Number(count) || 0));
    if (badge) {
      badge.textContent = formatBadge(value, max);
      badge.hidden = value === 0;
    }
    if (button) {
      if (button.dataset.badgeLabel === undefined) button.dataset.badgeLabel = button.getAttribute("aria-label") || "";
      const base = button.dataset.badgeLabel;
      button.setAttribute("aria-label", value ? `${base}，${value} ${suffix}` : base);
    }
    return badge;
  }

  function init() {
    initDrawer();
    initUserMenu();
    initNestedNav();
  }

  Kit.shell = { setDrawerOpen, setNavGroupOpen };
  Kit.badge = { set: setBadge, format: formatBadge };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
