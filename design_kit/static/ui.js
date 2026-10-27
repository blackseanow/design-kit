/* Shared DOM components. They only own presentation and accessibility; page
   code keeps its own data, requests and IDs: empty / error / loading states,
   DataTable, Tabs, RowActions, help tooltips, button loading, password
   toggles, captcha refresh, selection bars and the small controls. */
(function (root, document) {
  "use strict";
  if (!document) return;
  const Kit = root.Kit = root.Kit || {};

  const identify = (node, name) => { if (node) node.dataset.uiComponent = name; return node; };
  function textElement(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }

  /* EmptyState / ErrorState / LoadingState */
  function stateBlock(name, { title = "", description = "", action = null, className = "", compact = false, borderless = false } = {}) {
    const node = identify(document.createElement("div"), name);
    node.className = ["ui-state", compact && "ui-state-compact", borderless && "ui-state-borderless", className].filter(Boolean).join(" ");
    node.setAttribute("role", name === "ErrorState" ? "alert" : "status");
    if (title) node.append(textElement("strong", title, "ui-state-title"));
    if (description) node.append(textElement("p", description, "ui-state-description"));
    if (action) {
      const button = textElement("button", action.label, "btn-secondary btn-small");
      button.type = "button";
      Object.entries(action.data || {}).forEach(([key, value]) => { button.dataset[key] = value; });
      if (action.onClick) button.addEventListener("click", action.onClick);
      node.append(button);
    }
    return node;
  }
  const EmptyState = (options) => stateBlock("EmptyState", options);
  const ErrorState = (options = {}) => stateBlock("ErrorState", { ...options, className: `ui-state-error ${options.className || ""}`.trim() });
  const emptyMarkup = (options) => EmptyState(options).outerHTML;
  function renderEmpty(host, options) {
    if (!host) return null;
    const node = EmptyState(options);
    host.replaceChildren(node);
    return node;
  }
  function renderError(host, options) {
    if (!host) return null;
    const node = ErrorState(options);
    host.replaceChildren(node);
    return node;
  }
  function LoadingState({ label = "正在加载数据", inline = false } = {}) {
    const node = identify(document.createElement("div"), "LoadingState");
    node.className = `page-list-loading${inline ? " role-inline-loading" : ""}`;
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.setAttribute("aria-busy", "true");
    const spinner = document.createElement("span");
    spinner.className = "page-list-loading-spinner";
    spinner.setAttribute("aria-hidden", "true");
    node.append(spinner, textElement("span", label, "page-list-loading-text"));
    return node;
  }

  /* Button loading: keeps the button's width-giving content until restored. */
  function setButtonLoading(button, isLoading, loadingText = "") {
    if (!button) return;
    if (isLoading) {
      if (button.dataset.loadingHtml === undefined) button.dataset.loadingHtml = button.innerHTML;
      button.classList.add("is-loading");
      button.setAttribute("aria-busy", "true");
      button.disabled = true;
      button.innerHTML = `<span class="loading-inline-spinner" aria-hidden="true"></span><span class="button-loading-label">${Kit.escapeHtml(loadingText)}</span>`;
      return;
    }
    button.classList.remove("is-loading");
    button.setAttribute("aria-busy", "false");
    if (button.dataset.loadingHtml !== undefined) {
      button.innerHTML = button.dataset.loadingHtml;
      delete button.dataset.loadingHtml;
    }
    button.disabled = false;
  }
  async function runButtonAction(button, loadingText, action) {
    setButtonLoading(button, true, loadingText);
    try { return await action(); }
    finally { setButtonLoading(button, false); }
  }

  /* DataTable: keyboard-reachable horizontal scroll and cell labels. */
  const tableBindings = new WeakMap();
  function DataTable(host) {
    identify(host, "DataTable");
    const table = host.querySelector("table");
    let binding = tableBindings.get(host);
    if (!binding) {
      binding = { table: null, originalTabindex: host.getAttribute("tabindex"), managed: false };
      binding.sync = () => {
        const overflowing = Boolean(host.querySelector("table")) && host.clientWidth > 0 && host.scrollWidth > host.clientWidth + 1;
        host.classList.toggle("ui-table-overflow", overflowing);
        // .is-scroll-end: nothing is hidden under the pinned last column any more.
        host.classList.toggle("is-scroll-end", !overflowing || host.scrollLeft + host.clientWidth >= host.scrollWidth - 1);
        if (overflowing && !binding.managed) {
          binding.managed = true;
          host.setAttribute("tabindex", "0");
          if (!host.hasAttribute("aria-label")) { host.setAttribute("aria-label", "数据表，可使用方向键横向滚动查看全部列"); binding.managedLabel = true; }
        } else if (!overflowing && binding.managed) {
          if (binding.originalTabindex === null) host.removeAttribute("tabindex");
          else host.setAttribute("tabindex", binding.originalTabindex);
          if (binding.managedLabel) host.removeAttribute("aria-label");
          binding.managedLabel = false;
          binding.managed = false;
        }
      };
      if (typeof ResizeObserver === "function") {
        binding.resize = new ResizeObserver(binding.sync);
        binding.resize.observe(host);
      }
      host.addEventListener("scroll", binding.sync, { passive: true });
      tableBindings.set(host, binding);
    }
    if (binding.table !== table) {
      if (binding.table) binding.resize?.unobserve(binding.table);
      if (table) binding.resize?.observe(table);
      binding.table = table;
    }
    binding.sync();
    if (!table) return;
    const headers = [...table.querySelectorAll("thead th")];
    const headerLabel = (cell) => {
      if (!cell) return "";
      const copy = cell.cloneNode(true);
      copy.querySelectorAll("button, svg, [aria-hidden='true']").forEach((node) => node.remove());
      return copy.textContent.trim();
    };
    headers.forEach((cell) => { cell.scope = "col"; });
    table.querySelectorAll("tbody tr").forEach((row) => {
      [...row.children].forEach((cell, index) => { if (!cell.dataset.label) cell.dataset.label = headerLabel(headers[index]) || ""; });
    });
  }

  /* Tabs: roving tabindex, arrow/Home/End keys, optional panel switching.
     .tabs hosts also get a sliding underline (motion-tabs) and a 160ms panel fade. */
  const tabBindings = new WeakSet();
  const reducedMotion = () => Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  function TabMotion(host) {
    if (!host.matches?.(".tabs") || host.dataset.motionBound) return;
    host.dataset.motionBound = "true";
    host.classList.add("motion-tabs");
    const indicator = document.createElement("span");
    indicator.className = "tab-selection-indicator";
    indicator.setAttribute("aria-hidden", "true");
    indicator.style.transition = "none";
    host.append(indicator);
    let selected = null;
    // The observer also sees the host's own class attribute; only write it when it changes.
    const setIndicator = (shown) => { if (host.classList.contains("has-indicator") !== shown) host.classList.toggle("has-indicator", shown); };
    const update = () => {
      const active = host.querySelector(':scope > [aria-selected="true"], :scope > [aria-current="page"], :scope > .active');
      if (!active || !host.getClientRects().length) { setIndicator(false); return; }
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.transform = `translateX(${active.offsetLeft}px)`;
      setIndicator(true);
      if (selected && selected !== active) {
        const panel = active.getAttribute("aria-controls") && document.getElementById(active.getAttribute("aria-controls"));
        if (panel?.animate && !reducedMotion()) panel.animate([{ opacity: 0.65 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      }
      selected = active;
      if (indicator.style.transition) requestAnimationFrame(() => { indicator.style.transition = ""; });
    };
    new MutationObserver(update).observe(host, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "aria-current", "class"] });
    if (typeof ResizeObserver === "function") new ResizeObserver(update).observe(host);
    update();
  }
  function Tabs(host) {
    identify(host, "Tabs");
    TabMotion(host);
    const tabs = () => [...host.querySelectorAll('[role="tab"]')];
    const sync = () => tabs().forEach((tab) => {
      const selected = tab.getAttribute("aria-selected") === "true";
      tab.tabIndex = selected ? 0 : -1;
      const panel = tab.getAttribute("aria-controls") && document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    });
    sync();
    if (tabBindings.has(host)) return;
    tabBindings.add(host);
    new MutationObserver(sync).observe(host, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    host.addEventListener("click", (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (!tab || tab.disabled || !tab.hasAttribute("aria-controls")) return;
      tabs().forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
    });
    host.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const tab = event.target.closest('[role="tab"]');
      const enabled = tabs().filter((item) => !item.disabled && item.getClientRects().length);
      if (!tab || !enabled.length) return;
      const index = enabled.indexOf(tab);
      const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length;
      event.preventDefault();
      enabled[next].focus();
      enabled[next].click();
    });
  }

  /* RowActions: every button (and row switch label) in .list-row-actions moves
     into one overflow menu. data-primary-visible="true" keeps the first button
     visible when there are 3+ buttons. data-icon on a button sets its menu icon. */
  let openRowMenu = null, rowMenuPointerActive = false, rowMenuSequence = 0;
  const iconFor = (button) => {
    if (button.dataset.icon) return button.dataset.icon;
    const value = (button.textContent || "").toLowerCase();
    if (/删除|作废|退出|移除|移出|撤销|delete|remove|revoke/.test(value)) return "x";
    if (/编辑|修改|edit/.test(value)) return "sliders-horizontal";
    if (/日志|记录|log/.test(value)) return "activity";
    if (/查看|详情|view|detail/.test(value)) return "eye";
    if (/停用|暂停|结束|停止|关闭|disable|stop/.test(value)) return "pause";
    if (/启用|开始|运行|open|start|enable/.test(value)) return "play";
    if (/复制|copy/.test(value)) return "copy";
    return "arrow-up-right";
  };
  function decorateActionButton(button) {
    if (button.dataset.rowActionDecorated || button.tagName !== "BUTTON") return;
    button.dataset.rowActionDecorated = "true";
    const icon = document.createElement("span");
    icon.className = "row-action-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = Kit.iconMarkup(iconFor(button));
    const text = document.createElement("span");
    text.className = "row-action-label";
    while (button.firstChild) text.append(button.firstChild);
    button.append(icon, text);
  }
  function closeRowMenu(restore = false) {
    if (!openRowMenu) return;
    const { popup, trigger } = openRowMenu;
    if (popup.matches(":popover-open")) popup.hidePopover();
    popup.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    Kit.popups?.closed(openRowMenu);
    openRowMenu = null;
    rowMenuPointerActive = false;
    if (restore && trigger.isConnected) trigger.focus({ preventScroll: true });
  }
  function RowActions(group) {
    if (group.dataset.rowMenuBound || !group.closest('tr, [role="row"], [data-row]')) return;
    const buttons = [...group.children].filter((node) => node.tagName === "BUTTON");
    const allInOverflow = group.dataset.primaryVisible !== "true";
    if (buttons.length < (allInOverflow ? 1 : 3)) return;
    group.dataset.rowMenuBound = "true";
    const trigger = document.createElement("button");
    trigger.className = "row-overflow-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-label", "更多操作");
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = Kit.iconMarkup("ellipsis");
    const popup = document.createElement("div");
    popup.className = "row-overflow-menu";
    popup.id = `row-overflow-${++rowMenuSequence}`;
    popup.setAttribute("popover", "manual");
    popup.setAttribute("role", "menu");
    popup.setAttribute("aria-label", "更多操作");
    popup.hidden = true;
    trigger.setAttribute("aria-controls", popup.id);
    const primary = allInOverflow ? null : buttons[0];
    buttons.filter((button) => button !== primary).forEach((button) => {
      decorateActionButton(button);
      button.setAttribute("role", "menuitem");
      popup.append(button);
    });
    if (allInOverflow) {
      // A row on/off switch moves into the menu; a short status stays in the row.
      [...group.children].filter((node) => node.matches?.('label:has(input.toggle-switch-input), label:has(input[role="switch"])')).forEach((label) => {
        const input = label.querySelector("input");
        if (!input) return;
        const status = document.createElement("span");
        status.className = "row-action-status";
        const sync = () => { status.textContent = input.disabled ? "保存中…" : input.checked ? "已启用" : "已暂停"; };
        sync();
        input.addEventListener("change", sync);
        group.append(status);
        label.classList.add("row-action-switch");
        label.setAttribute("role", "menuitem");
        popup.append(label);
      });
    }
    group.append(trigger, popup);
    function position() {
      if (!trigger.isConnected) { closeRowMenu(); return; }
      const r = trigger.getBoundingClientRect();
      popup.style.maxHeight = `${root.innerHeight - 24}px`;
      popup.style.left = `${Math.max(12, Math.min(r.right - popup.offsetWidth, root.innerWidth - popup.offsetWidth - 12))}px`;
      popup.style.top = `${Math.max(12, r.bottom + popup.offsetHeight + 16 < root.innerHeight ? r.bottom + 4 : r.top - popup.offsetHeight - 4)}px`;
    }
    function open(keyboard = false) {
      closeRowMenu();
      popup.hidden = false;
      popup.showPopover?.();
      position();
      trigger.setAttribute("aria-expanded", "true");
      openRowMenu = { popup, trigger, position };
      Kit.popups?.opened(openRowMenu, () => closeRowMenu());
      if (keyboard) popup.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    }
    trigger.addEventListener("click", (event) => { event.stopPropagation(); openRowMenu?.trigger === trigger ? closeRowMenu(true) : open(event.detail === 0); });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && openRowMenu?.trigger === trigger) { event.preventDefault(); event.stopPropagation(); closeRowMenu(true); return; }
      if (event.key === "ArrowDown") { event.preventDefault(); open(true); }
    });
    popup.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRowMenu(true); return; }
      if (event.key === "Tab") { closeRowMenu(true); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const items = [...popup.querySelectorAll("button:not(:disabled)")];
      const index = items.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    });
    popup.addEventListener("click", (event) => {
      rowMenuPointerActive = false;
      if (!event.target.closest("button, label.row-action-switch")) return;
      // Let page handlers see the click first, then close.
      const activated = openRowMenu;
      setTimeout(() => { if (openRowMenu === activated) closeRowMenu(false); }, 0);
    });
    // Popovers render in the top layer; keep touch gestures inside the menu.
    popup.addEventListener("pointerdown", (event) => { rowMenuPointerActive = true; event.stopPropagation(); });
    popup.addEventListener("pointerup", (event) => event.stopPropagation());
    popup.addEventListener("pointercancel", () => { rowMenuPointerActive = false; openRowMenu?.position(); });
  }

  /* Help tooltips: .title-help-button[data-help]. Hover/focus shows, click pins. */
  let helpLayer = null, activeHelp = null, helpPinned = false, helpHideTimer = null, helpFrame = null;
  function normalizeHelpButton(button) {
    if (!(button instanceof HTMLElement) || !button.matches(".title-help-button[data-help]")) return;
    if (button.parentElement?.matches("h1, h2, h3, h4, strong, span")) button.parentElement.classList.add("help-title-inline");
    if (button.hasAttribute("title")) button.removeAttribute("title");
    if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "helpTooltipLayer");
  }
  function getHelpLayer() {
    if (helpLayer) return helpLayer;
    helpLayer = document.createElement("div");
    helpLayer.id = "helpTooltipLayer";
    helpLayer.className = "help-tooltip-layer";
    helpLayer.setAttribute("role", "tooltip");
    helpLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(helpLayer);
    return helpLayer;
  }
  function hideHelp() {
    clearTimeout(helpHideTimer);
    helpHideTimer = null;
    if (helpFrame !== null) cancelAnimationFrame(helpFrame);
    helpFrame = null;
    if (activeHelp) {
      activeHelp.setAttribute("aria-expanded", "false");
      const rest = (activeHelp.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== "helpTooltipLayer");
      if (rest.length) activeHelp.setAttribute("aria-describedby", rest.join(" "));
      else activeHelp.removeAttribute("aria-describedby");
    }
    activeHelp = null;
    helpPinned = false;
    if (!helpLayer) return;
    helpLayer.classList.remove("visible");
    helpLayer.setAttribute("aria-hidden", "true");
  }
  function updateHelpPosition() {
    const button = activeHelp;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    if (!button.isConnected || !rect.width || !rect.height || rect.bottom <= 0 || rect.top >= root.innerHeight || rect.right <= 0 || rect.left >= root.innerWidth) { hideHelp(); return; }
    // Hide when the anchor scrolls behind a clipping parent (e.g. dialog header/footer).
    for (let parent = button.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = root.getComputedStyle(parent);
      const clipsY = /(auto|scroll|hidden|clip)/.test(style.overflowY);
      const clipsX = /(auto|scroll|hidden|clip)/.test(style.overflowX);
      if (!clipsY && !clipsX) continue;
      const bounds = parent.getBoundingClientRect();
      if ((clipsY && (rect.bottom <= bounds.top || rect.top >= bounds.bottom)) || (clipsX && (rect.right <= bounds.left || rect.left >= bounds.right))) { hideHelp(); return; }
    }
    const layer = getHelpLayer();
    const modalZ = Number(Kit.modal?.top?.()?.style.zIndex || 0);
    layer.style.zIndex = String(Math.max(5000, modalZ + 1));
    const view = Kit.viewport();
    const margin = 12;
    layer.style.maxWidth = `${Math.min(340, view.width - margin * 2)}px`;
    layer.style.maxHeight = `${Math.max(60, view.height - margin * 2)}px`;
    const box = layer.getBoundingClientRect();
    const left = Math.max(view.left + margin, Math.min(rect.left + rect.width / 2 - box.width / 2, view.left + view.width - box.width - margin));
    const below = rect.bottom + 8;
    const above = rect.top - box.height - 8;
    const top = below + box.height <= view.top + view.height - margin ? below : Math.max(view.top + margin, Math.min(above, view.top + view.height - box.height - margin));
    layer.style.left = `${Math.round(left)}px`;
    layer.style.top = `${Math.round(top)}px`;
  }
  function showHelp(button, { pinned = false } = {}) {
    const message = button.getAttribute("data-help") || "";
    if (!message.trim()) return;
    if (activeHelp !== button) hideHelp();
    clearTimeout(helpHideTimer);
    normalizeHelpButton(button);
    activeHelp = button;
    helpPinned = pinned || helpPinned;
    button.setAttribute("aria-expanded", "true");
    const ids = new Set((button.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    ids.add("helpTooltipLayer");
    button.setAttribute("aria-describedby", [...ids].join(" "));
    const layer = getHelpLayer();
    // Background siblings of a modal are inert; keep its help inside the modal.
    const host = button.closest(".modal-backdrop") || document.body;
    if (layer.parentElement !== host) host.appendChild(layer);
    layer.inert = false;
    layer.replaceChildren(textElement("div", message, "help-tooltip-copy"));
    layer.setAttribute("role", helpPinned ? "dialog" : "tooltip");
    if (helpPinned) {
      layer.setAttribute("aria-label", "说明");
      const close = document.createElement("button");
      close.type = "button";
      close.className = "help-tooltip-close btn-icon";
      close.setAttribute("aria-label", "关闭说明");
      close.addEventListener("click", () => { const anchor = activeHelp; hideHelp(); anchor?.focus({ preventScroll: true }); });
      layer.appendChild(close);
    } else layer.removeAttribute("aria-label");
    layer.classList.add("visible");
    layer.setAttribute("aria-hidden", "false");
    updateHelpPosition();
  }
  function initHelp() {
    const helpButtonFor = (target) => target?.closest?.(".title-help-button[data-help]");
    const insideHelp = (target) => target instanceof Node && (activeHelp?.contains(target) || helpLayer?.contains(target));
    const scheduleHide = () => { if (helpPinned) return; clearTimeout(helpHideTimer); helpHideTimer = setTimeout(hideHelp, 160); };
    document.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      if (insideHelp(event.target)) clearTimeout(helpHideTimer);
      const button = helpButtonFor(event.target);
      if (button && !helpPinned) showHelp(button);
    }, true);
    document.addEventListener("pointerout", (event) => {
      if (event.pointerType !== "mouse" || !insideHelp(event.target) || insideHelp(event.relatedTarget)) return;
      scheduleHide();
    }, true);
    document.addEventListener("focusin", (event) => {
      if (!event.target.matches?.(":focus-visible")) return;
      const button = helpButtonFor(event.target);
      if (button) showHelp(button);
      else if (!insideHelp(event.target)) hideHelp();
    }, true);
    document.addEventListener("focusout", (event) => { if (!helpPinned && insideHelp(event.target) && !insideHelp(event.relatedTarget)) scheduleHide(); }, true);
    document.addEventListener("pointerdown", (event) => { if (!insideHelp(event.target) && !helpButtonFor(event.target)) hideHelp(); }, true);
    document.addEventListener("click", (event) => {
      const button = helpButtonFor(event.target);
      if (!button) { if (!insideHelp(event.target)) hideHelp(); return; }
      event.preventDefault();
      event.stopPropagation();
      if (activeHelp === button && helpPinned) hideHelp();
      else showHelp(button, { pinned: true });
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !activeHelp) return;
      event.preventDefault();
      hideHelp();
      // Let the mobile drawer still close on the same Escape.
      if (!document.querySelector(".app-shell.sidebar-mobile-open")) event.stopPropagation();
    }, true);
    root.addEventListener("scroll", (event) => {
      if (!activeHelp || (event.target instanceof Node && helpLayer?.contains(event.target)) || helpFrame !== null) return;
      helpFrame = requestAnimationFrame(() => { helpFrame = null; updateHelpPosition(); });
    }, true);
    root.addEventListener("resize", updateHelpPosition);
    root.visualViewport?.addEventListener("resize", updateHelpPosition);
    root.visualViewport?.addEventListener("scroll", updateHelpPosition);
  }

  /* Selection bar: [data-selection-bar="barId"] on a list; checkboxes with
     data-select-row count, data-select-all toggles them. The bar shows while
     something is selected and its [data-selection-count] holds the number. */
  const selectionBound = new WeakSet();
  function Selection(container) {
    if (selectionBound.has(container)) return;
    selectionBound.add(container);
    const bar = document.getElementById(container.dataset.selectionBar || "");
    const rows = () => [...container.querySelectorAll("input[type='checkbox'][data-select-row]")].filter((input) => !input.disabled);
    const all = () => container.querySelector("input[type='checkbox'][data-select-all]");
    const sync = () => {
      const selected = rows().filter((input) => input.checked);
      rows().forEach((input) => input.closest("tr")?.classList.toggle("selected-table-row", input.checked));
      const master = all();
      if (master) { master.checked = Boolean(rows().length) && selected.length === rows().length; master.indeterminate = selected.length > 0 && selected.length < rows().length; }
      if (bar) {
        bar.hidden = selected.length === 0;
        bar.querySelectorAll("[data-selection-count]").forEach((node) => { node.textContent = String(selected.length); });
      }
      container.dispatchEvent(new CustomEvent("kit:selection-change", { bubbles: true, detail: { selected: selected.map((input) => input.value) } }));
    };
    container.addEventListener("change", (event) => {
      const input = event.target;
      if (input.matches("input[type='checkbox'][data-select-all]")) rows().forEach((row) => { row.checked = input.checked; });
      if (input.matches("input[type='checkbox'][data-select-row], input[type='checkbox'][data-select-all]")) sync();
    });
    bar?.querySelector("[data-selection-clear]")?.addEventListener("click", () => { rows().forEach((row) => { row.checked = false; }); sync(); });
    sync();
  }
  /* Segmented radios: .is-checked on the selected label, for browsers without :has(). */
  function Segmented(group) {
    group.querySelectorAll(":scope > label").forEach((label) => label.classList.toggle("is-checked", Boolean(label.querySelector("input:checked"))));
  }
  function bindSmallControls() {
    document.addEventListener("change", (event) => {
      const group = event.target.closest?.(".segmented");
      if (group && event.target.matches("input[type='radio']")) Segmented(group);
    });
    document.addEventListener("click", (event) => {
      // Segmented buttons: one pressed at a time.
      const segment = event.target.closest?.(".segmented > button[aria-pressed]");
      if (segment && !segment.disabled && segment.dataset.manual === undefined) {
        segment.parentElement.querySelectorAll(":scope > button[aria-pressed]").forEach((button) => button.setAttribute("aria-pressed", String(button === segment)));
      }
      // Notice banner dismiss.
      const close = event.target.closest?.("[data-notice-close]");
      if (close) {
        const notice = close.closest(".notice");
        notice?.dispatchEvent(new CustomEvent("kit:notice-close", { bubbles: true }));
        notice?.remove();
      }
    });
    // Pagination page-size select: option values are page URLs.
    document.addEventListener("change", (event) => {
      const select = event.target.closest?.("select[data-page-size-nav]");
      if (select && select.value) {
        Kit.pageProgress?.begin?.();
        root.location.assign(select.value);
      }
    });
  }

  /* Password visibility: button.password-visibility-toggle[aria-controls=inputId] */
  function bindPasswordToggles() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.(".password-visibility-toggle");
      if (!button || button.disabled) return;
      const input = document.getElementById(button.getAttribute("aria-controls"));
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
    });
  }

  /* Image captcha: button[data-captcha-refresh=inputId] reloads img[data-captcha-image=inputId]
     with a cache-busting query, clears the input and focuses it. Emits kit:captcha-refresh. */
  function captchaUrl(src, stamp) {
    const base = String(src || "").replace(/([?&])_cb=\d+(&|$)/, (match, lead, tail) => (tail ? lead : ""));
    return `${base}${base.includes("?") ? "&" : "?"}_cb=${stamp}`;
  }
  function bindCaptchaRefresh() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-captcha-refresh]");
      if (!button || button.disabled) return;
      const id = button.getAttribute("data-captcha-refresh");
      const input = document.getElementById(id);
      const image = [...document.querySelectorAll("img[data-captcha-image]")].find((node) => node.getAttribute("data-captcha-image") === id);
      if (image) image.src = captchaUrl(image.getAttribute("src"), Date.now());
      if (input) { input.value = ""; input.focus(); }
      button.dispatchEvent(new CustomEvent("kit:captcha-refresh", { bubbles: true, detail: { input, image } }));
    });
  }

  const selectors = {
    Panel: ".panel", Toolbar: ".toolbar", FilterBar: ".filter-bar", MetricCard: ".metric-card",
    DataTable: ".table-wrap", Tabs: '[role="tablist"]', TabMotion: ".tabs", Selection: "[data-selection-bar]", Segmented: ".segmented",
  };
  const components = {
    Panel: (node) => identify(node, "Panel"), Toolbar: (node) => identify(node, "Toolbar"),
    FilterBar: (node) => identify(node, "FilterBar"), MetricCard: (node) => identify(node, "MetricCard"),
    DataTable, Tabs, TabMotion, Selection, Segmented,
  };
  function enhance(scope = document) {
    if (!scope?.querySelectorAll) return;
    Object.entries(selectors).forEach(([name, selector]) => {
      if (scope.matches?.(selector)) components[name](scope);
      scope.querySelectorAll(selector).forEach(components[name]);
    });
    if (scope.matches?.(".list-row-actions")) RowActions(scope);
    scope.querySelectorAll(".list-row-actions").forEach(RowActions);
    if (scope instanceof HTMLElement) normalizeHelpButton(scope);
    scope.querySelectorAll(".title-help-button[data-help]").forEach(normalizeHelpButton);
  }

  function init() {
    // [data-ui-activate="id"]: a visible proxy that clicks another control.
    document.addEventListener("click", (event) => {
      const action = event.target.closest?.("[data-ui-activate]");
      if (!action || action.disabled) return;
      const control = document.getElementById(action.dataset.uiActivate);
      if (control && control !== action && !control.disabled) control.click();
    });
    enhance(document);
    initHelp();
    bindPasswordToggles();
    bindCaptchaRefresh();
    bindSmallControls();
    const inside = (event, node) => Boolean(node && (node.contains(event.target) || event.composedPath?.().includes(node)));
    document.addEventListener("pointerdown", (event) => {
      if (openRowMenu && !inside(event, openRowMenu.popup) && !inside(event, openRowMenu.trigger)) closeRowMenu();
    });
    document.addEventListener("focusin", (event) => {
      if (openRowMenu && !rowMenuPointerActive && !inside(event, openRowMenu.popup) && !inside(event, openRowMenu.trigger)) closeRowMenu();
    });
    document.addEventListener("scroll", (event) => {
      if (openRowMenu && !rowMenuPointerActive && !inside(event, openRowMenu.popup)) openRowMenu.position();
    }, true);
    root.addEventListener("resize", () => { if (!rowMenuPointerActive) openRowMenu?.position(); });
    // Enhance added subtrees and re-check tables whose content changed.
    Kit.mutations.subscribe(({ added, records }) => {
      added.forEach(enhance);
      const tables = new Set();
      records.forEach((record) => {
        if (record.type === "attributes") return;
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const host = target?.closest?.('[data-ui-component="DataTable"]');
        if (host) tables.add(host);
      });
      tables.forEach(DataTable);
      if (activeHelp && (!activeHelp.isConnected || !activeHelp.getClientRects().length)) hideHelp();
    });
  }

  Kit.ui = {
    EmptyState, ErrorState, LoadingState, emptyMarkup, renderEmpty, renderError,
    DataTable, Tabs, TabMotion, RowActions, Selection, enhance, setButtonLoading, runButtonAction,
    showHelp, hideHelp,
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
