/* Shared helpers for every kit module: focus management, icons, the
   single-open popup registry and viewport-bound menu placement.
   Focus helpers come from the source project's static/admin_accessibility.js;
   selectMenuBounds comes from its admin.js. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) root.Kit = Object.assign(root.Kit || {}, api);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  function elementIsFocusable(element) {
    if (!element || element.disabled || element.hidden || element.inert || element.closest?.("[inert]")) return false;
    if (element.getAttribute?.("aria-hidden") === "true") return false;
    if (element.getAttribute?.("aria-disabled") === "true") return false;
    if (typeof element.matches === "function" && !element.matches(FOCUSABLE_SELECTOR)) return false;
    if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) return false;
    return true;
  }

  function focusableElements(container) {
    if (!container?.querySelectorAll) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(elementIsFocusable);
  }

  function focusElement(element) {
    if (!element?.focus) return;
    try { element.focus({ preventScroll: true }); } catch { element.focus(); }
  }

  function trapTabKey(event, container, activeElement) {
    if (event?.key !== "Tab") return false;
    const focusable = focusableElements(container);
    if (!focusable.length) {
      event.preventDefault();
      focusElement(container);
      return true;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeInside = focusable.includes(activeElement) || Boolean(container.contains?.(activeElement));
    if (event.shiftKey && (activeElement === first || !activeInside)) {
      event.preventDefault();
      focusElement(last);
      return true;
    }
    if (!event.shiftKey && (activeElement === last || !activeInside)) {
      event.preventDefault();
      focusElement(first);
      return true;
    }
    return false;
  }

  function menuNavigationTarget(items, currentItem, key) {
    const enabledItems = Array.from(items || []).filter(elementIsFocusable);
    if (!enabledItems.length) return null;
    if (key === "Home") return enabledItems[0];
    if (key === "End") return enabledItems[enabledItems.length - 1];
    if (!["ArrowUp", "ArrowDown"].includes(key)) return null;
    const currentIndex = Math.max(0, enabledItems.indexOf(currentItem));
    const direction = key === "ArrowDown" ? 1 : -1;
    return enabledItems[(currentIndex + direction + enabledItems.length) % enabledItems.length];
  }

  // Makes every element except `activeElement` inert, remembering original state.
  function syncManagedInert(elements, activeElement, managedStates) {
    Array.from(elements || []).forEach((element) => {
      const shouldBeInert = Boolean(activeElement && element !== activeElement);
      if (shouldBeInert) {
        if (!managedStates.has(element)) {
          managedStates.set(element, { inert: Boolean(element.inert), hadAttribute: Boolean(element.hasAttribute?.("inert")) });
        }
        element.inert = true;
        element.setAttribute?.("inert", "");
        return;
      }
      const original = managedStates.get(element);
      if (!original) return;
      element.inert = original.inert;
      if (original.hadAttribute) element.setAttribute?.("inert", "");
      else element.removeAttribute?.("inert");
      managedStates.delete(element);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  // The sprite URL is rendered by templates/design_kit/head.html.
  function iconUrl(name) {
    const meta = root.document?.querySelector('meta[name="design-kit-icons"]');
    return `${meta?.content || "icons.svg"}#${name}`;
  }
  function iconMarkup(name, className = "") {
    return `<svg${className ? ` class="${escapeHtml(className)}"` : ""} aria-hidden="true"><use href="${escapeHtml(iconUrl(name))}"></use></svg>`;
  }

  const isTouchLayout = () => Boolean(root.matchMedia?.("(max-width: 768px), (pointer: coarse)").matches);
  const isDrawerLayout = () => Boolean(root.matchMedia?.("(max-width: 1023px)").matches);

  // Only one floating menu (select, date, time, row menu, user menu) is open at a time.
  const openPopups = new Map();
  const popups = {
    opened(owner, close) {
      popups.closeAll(owner);
      openPopups.set(owner, close);
    },
    closed(owner) { openPopups.delete(owner); },
    closeAll(except = null) {
      [...openPopups].forEach(([owner, close]) => {
        if (owner === except) return;
        openPopups.delete(owner);
        close();
      });
    },
    count: () => openPopups.size,
  };

  function viewport() {
    const visual = root.visualViewport;
    return {
      left: visual?.offsetLeft || 0,
      top: visual?.offsetTop || 0,
      width: visual?.width || root.innerWidth || 0,
      height: visual?.height || root.innerHeight || 0,
    };
  }

  // Shared by select, searchable and temporal menus: stay inside the visual
  // viewport with a 12px edge, open upwards when there is more room above.
  function selectMenuBounds(anchor, view, { minWidth = 192, maxHeight = 320, minHeight = 80 } = {}) {
    const edge = 12, gap = 10;
    const width = Math.max(0, Math.min(Math.max(anchor.width, minWidth), view.width - edge * 2));
    const left = Math.max(view.left + edge, Math.min(anchor.left, view.left + view.width - edge - width));
    const topEdge = view.top + edge;
    const bottomEdge = Math.max(topEdge, view.top + view.height - edge);
    const below = Math.max(0, bottomEdge - anchor.bottom - gap);
    const above = Math.max(0, anchor.top - gap - topEdge);
    const upwards = below < Math.min(Math.max(180, minHeight), maxHeight) && above > below;
    const floating = Math.max(below, above) < minHeight;
    const height = Math.max(0, Math.min(maxHeight, bottomEdge - topEdge, floating ? bottomEdge - topEdge : upwards ? above : below));
    const preferred = upwards && !floating ? anchor.top - gap - height : anchor.bottom + gap;
    return { left, width, height, upwards, floating, gap, topEdge, bottomEdge, top: Math.max(topEdge, Math.min(preferred, bottomEdge - height)) };
  }

  function positionMenu(anchor, menu, options = {}) {
    const rect = anchor.getBoundingClientRect();
    const bounds = selectMenuBounds(rect, viewport(), options);
    menu.style.width = `${bounds.width}px`;
    menu.style.maxHeight = `${bounds.height}px`;
    menu.style.left = `${bounds.left}px`;
    menu.style.bottom = "auto";
    const renderedHeight = Math.min(bounds.height, menu.getBoundingClientRect().height);
    const top = bounds.upwards && !bounds.floating ? rect.top - bounds.gap - renderedHeight : bounds.top;
    menu.style.top = `${Math.max(bounds.topEdge, Math.min(top, bounds.bottomEdge - renderedHeight))}px`;
  }

  // Anchored panels (popover, dropdown menu). From the source project's filter and
  // table-settings popups: align to the anchor's end edge, keep a 12px viewport edge,
  // open below unless the panel fits better above.
  function popoverBounds(anchor, view, { width = 360, height = 240, align = "end", gap = 6, edge = 12 } = {}) {
    const maxWidth = Math.max(0, view.width - edge * 2);
    const w = Math.min(width, maxWidth);
    const maxHeight = Math.max(80, view.height - edge * 2);
    const h = Math.min(height, maxHeight);
    const preferredLeft = align === "start" ? anchor.left : anchor.right - w;
    const left = Math.max(view.left + edge, Math.min(preferredLeft, view.left + view.width - w - edge));
    const below = anchor.bottom + gap;
    const spaceBelow = view.top + view.height - edge - below;
    const spaceAbove = anchor.top - gap - (view.top + edge);
    const upwards = spaceBelow < h && spaceAbove > spaceBelow;
    const top = upwards
      ? Math.max(view.top + edge, anchor.top - gap - h)
      : Math.max(view.top + edge, Math.min(below, view.top + view.height - h - edge));
    return { left, top, width: w, maxHeight, upwards };
  }

  // Floating menus are portaled into the open modal (siblings are inert) or body.
  const portalHost = (node) => node.closest?.(".modal-backdrop") || root.document.body;

  return {
    a11y: { FOCUSABLE_SELECTOR, elementIsFocusable, focusableElements, focusElement, trapTabKey, menuNavigationTarget, syncManagedInert },
    escapeHtml, iconUrl, iconMarkup, isTouchLayout, isDrawerLayout,
    popups, viewport, selectMenuBounds, positionMenu, popoverBounds, portalHost,
  };
});
