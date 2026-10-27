/* Anchored popovers, dropdown menus and table settings.
   Sources in the source project: static/ui/filters.js (the "筛选" popover: fixed
   placement aligned to the trigger's end edge, 12px viewport edge, outside click /
   Escape / focus-out close, child select menus stay open) and static/ui/tables.js
   (column visibility and row density stored per table). Kit changes: the business
   filter registry is gone; any element can be a popover (data-popover-open) or a
   menu (data-menu-open); the Popover API lifts panels to the top layer when the
   browser has it, with fixed positioning as the fallback.
   - Kit.popover.open(id, trigger) / close(restoreFocus) / toggle(id, trigger)
   - Kit.menu.open(id, trigger) / close(restoreFocus)
   - Kit.tableSettings.enhance(host) for .table-wrap[data-table-settings]
   Events: kit:popover-open, kit:popover-close (on the panel), kit:menu-select
   (on the menu, detail {item, value}). */
(function (root, document) {
  "use strict";
  if (!document) return;
  const Kit = root.Kit = root.Kit || {};
  const a11y = Kit.a11y;
  // Menus that other modules portal to the body or the modal; clicks inside them
  // belong to the popover that contains their field.
  const PORTALED = ".enhanced-select-menu,.custom-date-menu,.custom-time-menu,.help-tooltip-layer";
  const $ = (id) => (typeof id === "string" ? document.getElementById(id) : id);
  const inside = (event, node) => Boolean(node && (node.contains(event.target) || event.composedPath?.().includes(node)));
  const inPortaled = (event) => Boolean(event.target.closest?.(PORTALED));

  function isTopLayerOpen(node) {
    try { return node.matches(":popover-open"); } catch { return false; }
  }
  function show(node) {
    node.hidden = false;
    if (node.hasAttribute("popover") && typeof node.showPopover === "function" && !isTopLayerOpen(node)) {
      try { node.showPopover(); } catch { /* not connected or already open */ }
    }
  }
  function hide(node) {
    if (node.hasAttribute("popover") && typeof node.hidePopover === "function" && isTopLayerOpen(node)) {
      try { node.hidePopover(); } catch { /* already hidden */ }
    }
    node.hidden = true;
  }
  function layer(node) {
    const modalZ = Number(Kit.modal?.top?.()?.style.zIndex || 0);
    node.style.zIndex = String(Math.max(5000, modalZ + 1));
  }

  /* ---- Popover: an anchored dialog that keeps its place in the DOM ---- */
  let openPopover = null;

  function placePopover(panel, trigger) {
    if (!trigger.isConnected || !trigger.getClientRects().length) { closePopover(); return; }
    const view = Kit.viewport();
    const width = Number(panel.dataset.popoverWidth) || 360;
    panel.style.width = `${Math.min(width, Math.max(0, view.width - 24))}px`;
    panel.style.maxHeight = `${Math.max(80, view.height - 24)}px`;
    const height = Math.min(panel.scrollHeight || 240, Math.max(80, view.height - 24));
    const bounds = Kit.popoverBounds(trigger.getBoundingClientRect(), view, { width, height, align: panel.dataset.popoverAlign || "end" });
    panel.style.left = `${Math.round(bounds.left)}px`;
    panel.style.top = `${Math.round(bounds.top)}px`;
  }

  function closePopover(restoreFocus = false) {
    if (!openPopover) return;
    const { panel, trigger } = openPopover;
    openPopover = null;
    hide(panel);
    trigger.setAttribute("aria-expanded", "false");
    panel.dispatchEvent(new CustomEvent("kit:popover-close", { bubbles: true }));
    if (restoreFocus && trigger.isConnected && trigger.getClientRects().length) a11y.focusElement(trigger);
  }

  function openPopoverPanel(id, trigger, { focus = true } = {}) {
    const panel = $(id);
    if (!panel || !trigger) return null;
    if (openPopover?.panel === panel) return panel;
    closePopover();
    Kit.popups?.closeAll();
    Kit.ui?.hideHelp?.();
    if (!panel.hasAttribute("role")) panel.setAttribute("role", "dialog");
    layer(panel);
    show(panel);
    trigger.setAttribute("aria-expanded", "true");
    openPopover = { panel, trigger };
    placePopover(panel, trigger);
    panel.dispatchEvent(new CustomEvent("kit:popover-open", { bubbles: true }));
    if (focus) {
      // Touch users open the keyboard themselves; keyboard users land on the first field.
      const fields = a11y.focusableElements(panel).filter((node) => !node.closest(".popover-head"));
      let target = Kit.isTouchLayout() ? null : fields[0];
      if (!target) { panel.tabIndex = -1; target = panel; }
      a11y.focusElement(target);
    }
    return panel;
  }

  function togglePopover(id, trigger) {
    if (openPopover && openPopover.panel === $(id)) closePopover(true);
    else openPopoverPanel(id, trigger);
  }

  /* ---- Dropdown menu: a leaf popup registered with the single-open registry ---- */
  let openMenu = null;
  const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]';

  function menuItems(menu) {
    return [...menu.querySelectorAll(ITEM_SELECTOR)].filter((node) => a11y.elementIsFocusable(node));
  }
  function normalizeMenu(menu) {
    if (!menu.hasAttribute("role")) menu.setAttribute("role", "menu");
    menu.querySelectorAll(":scope > button, :scope > a[href], :scope > .dropdown-menu-footer > :is(button, a[href])").forEach((node) => {
      if (!node.hasAttribute("role")) node.setAttribute("role", "menuitem");
      if (!node.hasAttribute("tabindex")) node.tabIndex = -1;
    });
    menu.querySelectorAll(".dropdown-menu-separator").forEach((node) => node.setAttribute("role", "separator"));
  }
  function placeMenu(menu, trigger) {
    if (!trigger.isConnected || !trigger.getClientRects().length) { closeMenu(); return; }
    const view = Kit.viewport();
    const rect = trigger.getBoundingClientRect();
    menu.style.maxHeight = `${Math.max(80, view.height - 24)}px`;
    const align = menu.dataset.menuAlign || (rect.left + rect.width / 2 > view.left + view.width / 2 ? "end" : "start");
    const bounds = Kit.popoverBounds(rect, view, { width: menu.offsetWidth, height: menu.offsetHeight, align, gap: 4 });
    menu.style.left = `${Math.round(bounds.left)}px`;
    menu.style.top = `${Math.round(bounds.top)}px`;
  }
  function closeMenu(restoreFocus = false) {
    if (!openMenu) return;
    const { menu, trigger } = openMenu;
    Kit.popups?.closed(openMenu);
    openMenu = null;
    hide(menu);
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus && trigger.isConnected && trigger.getClientRects().length) a11y.focusElement(trigger);
  }
  function openMenuPanel(id, trigger, { keyboard = false } = {}) {
    const menu = $(id);
    if (!menu || !trigger) return null;
    if (openMenu?.menu === menu) return menu;
    closeMenu();
    closePopoverIfOutside(menu);
    Kit.ui?.hideHelp?.();
    normalizeMenu(menu);
    layer(menu);
    show(menu);
    trigger.setAttribute("aria-expanded", "true");
    openMenu = { menu, trigger };
    Kit.popups?.opened(openMenu, () => closeMenu());
    placeMenu(menu, trigger);
    if (keyboard) {
      const items = menuItems(menu);
      (items.find((item) => item.getAttribute("aria-checked") === "true") || items[0])?.focus({ preventScroll: true });
    }
    return menu;
  }
  // A menu opened from inside a popover keeps that popover; any other closes it.
  function closePopoverIfOutside(node) {
    if (openPopover && !openPopover.panel.contains(node)) closePopover();
  }
  function activateMenuItem(item, menu) {
    const role = item.getAttribute("role");
    if (role === "menuitemradio") {
      menu.querySelectorAll('[role="menuitemradio"]').forEach((node) => node.setAttribute("aria-checked", String(node === item)));
    } else if (role === "menuitemcheckbox") {
      item.setAttribute("aria-checked", String(item.getAttribute("aria-checked") !== "true"));
    }
    menu.dispatchEvent(new CustomEvent("kit:menu-select", { bubbles: true, detail: { item, value: item.dataset.value ?? item.textContent.trim() } }));
    if (role === "menuitemcheckbox" || item.dataset.menuKeep !== undefined) { placeMenu(menu, openMenu.trigger); return; }
    // Page handlers see the click first, then the menu closes.
    const current = openMenu;
    setTimeout(() => { if (openMenu === current) closeMenu(false); }, 0);
  }

  /* ---- Table settings: column visibility and row density, stored per table ---- */
  const settingsBound = new WeakSet();
  let settingsSequence = 0;
  const DENSITIES = [["compact", "紧凑"], ["regular", "标准"], ["expanded", "宽松"]];

  function headerName(cell) {
    const copy = cell.cloneNode(true);
    copy.querySelectorAll("button, input, svg, [aria-hidden='true'], .popover-panel").forEach((node) => node.remove());
    return copy.textContent.trim();
  }
  function ensureSettingsColumn(table, headers) {
    const last = headers.at(-1);
    const label = `${headerName(last)} ${last.getAttribute("aria-label") || ""}`.trim();
    const rows = [...table.querySelectorAll("tbody tr, tfoot tr")];
    const hasActions = last.classList.contains("table-actions-heading") || /操作|更多|设置|\bactions?\b/i.test(label)
      || rows.some((row) => row.lastElementChild?.querySelector(".list-row-actions, .row-overflow-trigger, button[aria-haspopup]"));
    if (hasActions) return;
    const count = headers.length;
    const heading = document.createElement("th");
    heading.scope = "col";
    heading.className = "table-actions-heading";
    heading.setAttribute("aria-label", "表格设置");
    heading.dataset.tableSettingsColumn = "true";
    last.after(heading);
    headers.push(heading);
    rows.forEach((row) => {
      const cells = [...row.children];
      if (cells.length === 1 && cells[0].colSpan >= count) { cells[0].colSpan = count + 1; return; }
      const cell = document.createElement("td");
      cell.dataset.tableSettingsColumn = "true";
      row.append(cell);
    });
  }
  function readPrefs(key) {
    try {
      const saved = JSON.parse(root.localStorage?.getItem(key) || "null");
      if (saved) return { density: DENSITIES.some(([value]) => value === saved.density) ? saved.density : "regular", hidden: Array.isArray(saved.hidden) ? saved.hidden.map(String) : [] };
    } catch { /* storage unavailable or corrupt */ }
    return { density: "regular", hidden: [] };
  }
  function writePrefs(key, prefs) {
    try { root.localStorage?.setItem(key, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  }

  function tableSettings(host, index = 0) {
    const table = host.matches("table") ? host : host.querySelector("table");
    if (!table || settingsBound.has(table) || table.closest(".popover-panel")) return;
    const wrap = table.closest(".table-wrap") || host;
    const headers = [...table.querySelectorAll("thead th")];
    if (headers.length < 2) return;
    settingsBound.add(table);
    table.classList.add("console-data-table");
    ensureSettingsColumn(table, headers);
    const columns = headers.map((cell, i) => ({ index: i, name: headerName(cell), locked: Boolean(cell.querySelector("input")) || i === headers.length - 1 }));
    const identity = columns.find((column) => column.name);
    if (identity) identity.locked = true;
    const key = `kit:table:${host.id || table.id || `${root.location?.pathname || ""}#${index}`}:${columns.map((column) => column.name).join("|")}`;
    let prefs = readPrefs(key);
    // 0 means the stylesheet lets this table fit its wrapper; keep it that way.
    const originalMinWidth = parseFloat(getComputedStyle(table).minWidth) || 0;

    function apply() {
      table.dataset.density = prefs.density;
      const hidden = new Set(columns.filter((column) => !column.locked && prefs.hidden.includes(column.name)).map((column) => column.index));
      if (originalMinWidth) table.style.minWidth = `${Math.max(320, Math.round(originalMinWidth * (headers.length - hidden.size) / headers.length))}px`;
      table.querySelectorAll("tr").forEach((row) => [...row.children].forEach((cell, i) => {
        if (cell.colSpan > 1) { cell.colSpan = headers.length - hidden.size; return; }
        cell.classList.toggle("table-column-hidden", hidden.has(i));
      }));
      writePrefs(key, prefs);
      if (wrap.matches(".table-wrap")) Kit.ui?.DataTable?.(wrap);
    }
    apply();
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; apply(); });
    }).observe(table, { childList: true, subtree: true });

    const id = `tableSettings${++settingsSequence}`;
    const trigger = document.createElement("button");
    trigger.className = "table-settings-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-label", "表格设置");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", id);
    trigger.dataset.popoverOpen = id;
    trigger.innerHTML = Kit.iconMarkup("settings");
    const heading = headers.at(-1);
    heading.classList.add("table-actions-heading");
    heading.append(trigger);

    const panel = document.createElement("div");
    panel.id = id;
    panel.className = "popover-panel table-settings-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "表格设置");
    panel.setAttribute("popover", "manual");
    panel.hidden = true;
    panel.dataset.popoverWidth = "288";
    panel.innerHTML = `<div class="popover-head"><strong>表格设置</strong><button type="button" class="text-button" data-table-reset>重置</button><button type="button" class="popover-close" data-popover-close aria-label="关闭表格设置"></button></div>
      <div class="popover-body">
        <div class="tabs" role="tablist" aria-label="表格设置分类">
          <button type="button" role="tab" id="${id}TabColumns" aria-selected="true" aria-controls="${id}Columns">显示列</button>
          <button type="button" role="tab" id="${id}TabDensity" aria-selected="false" aria-controls="${id}Density">行密度</button>
        </div>
        <div id="${id}Columns" role="tabpanel" aria-labelledby="${id}TabColumns"></div>
        <div id="${id}Density" role="tabpanel" aria-labelledby="${id}TabDensity" hidden></div>
      </div>`;
    const columnsPanel = panel.querySelector(`#${id}Columns`);
    const densityPanel = panel.querySelector(`#${id}Density`);
    columns.filter((column) => column.name).forEach((column) => {
      const label = document.createElement("label");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = column.locked || !prefs.hidden.includes(column.name);
      check.disabled = column.locked;
      check.dataset.column = column.name;
      label.append(check, document.createTextNode(column.name));
      columnsPanel.append(label);
      check.addEventListener("change", () => {
        prefs.hidden = prefs.hidden.filter((name) => name !== column.name);
        if (!check.checked) prefs.hidden.push(column.name);
        apply();
      });
    });
    DENSITIES.forEach(([value, name]) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `${id}-density`;
      input.value = value;
      input.checked = prefs.density === value;
      label.append(input, document.createTextNode(name));
      densityPanel.append(label);
      input.addEventListener("change", () => { prefs.density = value; apply(); });
    });
    panel.querySelector("[data-table-reset]").addEventListener("click", () => {
      prefs = { density: "regular", hidden: [] };
      apply();
      columnsPanel.querySelectorAll("input").forEach((input) => { input.checked = true; });
      densityPanel.querySelectorAll("input").forEach((input) => { input.checked = input.value === "regular"; });
    });
    panel.addEventListener("kit:popover-open", () => { Kit.ui?.Tabs?.(panel.querySelector('[role="tablist"]')); placePopover(panel, trigger); });
    panel.addEventListener("click", (event) => { if (event.target.closest('[role="tab"]')) requestAnimationFrame(() => { if (openPopover?.panel === panel) placePopover(panel, trigger); }); });
    heading.append(panel);
    host.dataset.uiComponent = host.dataset.uiComponent || "DataTable";
    table.dataset.tableSettingsBound = "true";
  }
  function enhanceTableSettings(scope = document) {
    if (!scope?.querySelectorAll) return;
    const hosts = [];
    if (scope.matches?.("[data-table-settings]")) hosts.push(scope);
    hosts.push(...scope.querySelectorAll("[data-table-settings]"));
    hosts.forEach((host, index) => { if (host.dataset.tableSettings !== "false") tableSettings(host, index); });
  }

  /* ---- Wiring ---- */
  function reposition() {
    if (openPopover) placePopover(openPopover.panel, openPopover.trigger);
    if (openMenu) placeMenu(openMenu.menu, openMenu.trigger);
  }

  function init() {
    document.addEventListener("click", (event) => {
      const closer = event.target.closest?.("[data-popover-close]");
      if (closer && openPopover?.panel.contains(closer)) { closePopover(true); return; }
      const popoverTrigger = event.target.closest?.("[data-popover-open]");
      if (popoverTrigger && !popoverTrigger.disabled) { event.preventDefault(); togglePopover(popoverTrigger.dataset.popoverOpen, popoverTrigger); return; }
      const menuTrigger = event.target.closest?.("[data-menu-open]");
      if (menuTrigger && !menuTrigger.disabled) {
        event.preventDefault();
        event.stopPropagation();
        if (openMenu?.trigger === menuTrigger) closeMenu(true);
        else openMenuPanel(menuTrigger.dataset.menuOpen, menuTrigger, { keyboard: event.detail === 0 });
        return;
      }
      if (openMenu && inside(event, openMenu.menu)) {
        const item = event.target.closest(ITEM_SELECTOR);
        if (item && openMenu.menu.contains(item) && !item.disabled) activateMenuItem(item, openMenu.menu);
      }
    });
    document.addEventListener("keydown", (event) => {
      const menuTrigger = event.target.closest?.("[data-menu-open]");
      if (menuTrigger && event.key === "ArrowDown") {
        event.preventDefault();
        openMenuPanel(menuTrigger.dataset.menuOpen, menuTrigger, { keyboard: true });
        return;
      }
      // A menu opened with the pointer leaves focus on its trigger; Escape still closes it.
      if (openMenu && (inside(event, openMenu.menu) || inside(event, openMenu.trigger))) {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(true); return; }
        if (event.key === "Tab") { closeMenu(false); return; }
        if (!inside(event, openMenu.menu)) return;
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        if (event.target.matches("input, textarea")) return;
        event.preventDefault();
        event.stopPropagation();
        const items = menuItems(openMenu.menu);
        const index = items.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus({ preventScroll: true });
      }
    });
    // Escape closes the popover only when no child menu (select, date, time) is open.
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !openPopover || event.defaultPrevented) return;
      if ((Kit.popups?.count?.() || 0) > 0 && !openMenu) return;
      if (openMenu && openPopover.panel.contains(openMenu.menu)) return;
      event.preventDefault();
      event.stopPropagation();
      closePopover(true);
    }, true);
    document.addEventListener("pointerdown", (event) => {
      if (openMenu && !inside(event, openMenu.menu) && !inside(event, openMenu.trigger)) closeMenu(false);
      if (openPopover && !inside(event, openPopover.panel) && !inside(event, openPopover.trigger) && !inPortaled(event) && !(openMenu && inside(event, openMenu.menu))) closePopover(false);
    });
    document.addEventListener("focusin", (event) => {
      if (openMenu && !inside(event, openMenu.menu) && !inside(event, openMenu.trigger)) closeMenu(false);
      if (openPopover && !inside(event, openPopover.panel) && !inside(event, openPopover.trigger) && !inPortaled(event) && !(openMenu && inside(event, openMenu.menu))) closePopover(false);
    });
    document.addEventListener("scroll", (event) => {
      if ((openPopover && inside(event, openPopover.panel)) || (openMenu && inside(event, openMenu.menu))) return;
      reposition();
    }, true);
    root.addEventListener("resize", reposition);
    root.visualViewport?.addEventListener("resize", reposition);
    root.visualViewport?.addEventListener("scroll", reposition);
    // A modal opening over a popover must not leave the popover in the top layer.
    document.addEventListener("kit:modal-open", (event) => { if (openPopover && !event.target.contains(openPopover.panel)) closePopover(); });
    document.addEventListener("kit:modal-close", (event) => {
      if (openPopover && event.target.contains(openPopover.panel)) closePopover();
      if (openMenu && event.target.contains(openMenu.menu)) closeMenu();
    });
    enhanceTableSettings(document);
    new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => { if (node.nodeType === 1) enhanceTableSettings(node); }));
      if (openPopover && !openPopover.trigger.isConnected) closePopover();
      if (openMenu && !openMenu.trigger.isConnected) closeMenu();
    }).observe(document.body, { childList: true, subtree: true });
  }

  Kit.popover = { open: openPopoverPanel, close: closePopover, toggle: togglePopover, current: () => openPopover?.panel || null, reposition };
  Kit.menu = { open: openMenuPanel, close: closeMenu, current: () => openMenu?.menu || null };
  Kit.tableSettings = { enhance: enhanceTableSettings };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
