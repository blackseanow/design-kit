/* Date and time pickers: calendar and time menus with keyboard handling and
   viewport placement. The date picker builds its own wrapper from
   <input type="date">; no hand-written markup is needed.
   - input[type="date"]  -> calendar menu, value stays YYYY-MM-DD
   - input[type="time"]  -> 30-minute menu, value stays HH:mm
   - input[data-time-editable="true"] -> free text HH:mm plus the quick menu
   Opt out with data-native. The input keeps its name, value and change events;
   it becomes type="hidden" (or "text" for editable time), so browser
   validation such as required/min/max no longer applies; validate on the server. */
(function (root, document) {
  "use strict";
  if (!document) return;
  const Kit = root.Kit = root.Kit || {};
  const datePickers = new WeakMap();
  const timePickers = new WeakMap();
  let sequence = 0;

  function parseIsoDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
    return date;
  }
  const pad = (value) => String(value).padStart(2, "0");
  const formatIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  function formatDisplayDate(value) {
    const date = parseIsoDate(value);
    return date ? `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}` : "请选择日期";
  }
  function normalizeTimeValue(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "";
    const hour = Number(match[1]), minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
    return `${pad(hour)}:${pad(minute)}`;
  }
  function timeOptions() {
    const options = [];
    for (let hour = 0; hour < 24; hour += 1) for (const minute of [0, 30]) options.push(`${pad(hour)}:${pad(minute)}`);
    return options;
  }

  // Viewport-bound portal shared by the calendar and time options.
  function place(picker) {
    if (!picker?.wrapper.classList.contains("open")) return;
    const r = (picker.anchor || picker.button).getBoundingClientRect();
    const view = Kit.viewport();
    const menuWidth = Math.min(picker.kind === "date" ? 288 : Math.max(r.width, 192), view.width - 24);
    const below = view.top + view.height - r.bottom - 20, above = r.top - view.top - 20;
    const upwards = below < 240 && above > below;
    const available = Math.max(80, Math.min(360, upwards ? above : below));
    Object.assign(picker.menu.style, {
      width: `${menuWidth}px`, maxHeight: `${available}px`,
      left: `${Math.max(view.left + 12, Math.min(r.left, view.left + view.width - menuWidth - 12))}px`,
      top: `${upwards ? Math.max(view.top + 12, r.top - Math.min(picker.menu.scrollHeight, available) - 8) : Math.max(view.top + 12, r.bottom + 8)}px`,
    });
  }
  function openMenu(picker) {
    Kit.portalHost(picker.wrapper).append(picker.menu);
    picker.menu.hidden = false;
    picker.menu.dataset.open = "true";
    picker.wrapper.classList.add("open");
    picker.button.setAttribute("aria-expanded", "true");
    place(picker);
    Kit.popups?.opened(picker, () => closeMenu(picker));
  }
  function closeMenu(picker) {
    if (!picker.wrapper.classList.contains("open")) return;
    const restore = picker.menu.contains(document.activeElement);
    picker.wrapper.classList.remove("open");
    picker.button.setAttribute("aria-expanded", "false");
    picker.menu.hidden = true;
    picker.menu.dataset.open = "false";
    picker.wrapper.append(picker.menu);
    if (restore) picker.button.focus({ preventScroll: true });
    Kit.popups?.closed(picker);
  }
  function bindKeys(picker) {
    picker.menu.hidden = true;
    const keys = (event) => {
      if (!picker.wrapper.classList.contains("open")) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(picker); picker.button.focus({ preventScroll: true }); return; }
      if (event.key === "Tab") { closeMenu(picker); picker.button.focus({ preventScroll: true }); return; }
      const calendar = picker.kind === "date";
      const options = [...picker.menu.querySelectorAll(calendar ? "[data-date-value]" : "[data-time-value]")];
      const step = { ArrowDown: calendar ? 7 : 1, ArrowUp: calendar ? -7 : -1, ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (step === undefined && !["Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const active = options.indexOf(document.activeElement);
      const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
        : active < 0 ? Math.max(0, options.findIndex((item) => item.getAttribute("aria-selected") === "true"))
        : (active + step + options.length) % options.length;
      options[index]?.focus({ preventScroll: true });
      options[index]?.scrollIntoView({ block: "nearest" });
    };
    picker.button.addEventListener("keydown", keys);
    picker.menu.addEventListener("keydown", keys);
    picker.menu.addEventListener("focusout", (event) => {
      if (event.relatedTarget && !picker.wrapper.contains(event.relatedTarget) && !picker.menu.contains(event.relatedTarget)) closeMenu(picker);
    });
    picker.button.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "Enter", " "].includes(event.key) || (event.key === "ArrowDown" && picker.wrapper.classList.contains("open"))) return;
      event.preventDefault();
      picker.button.click();
    });
    picker.menu.addEventListener("click", (event) => event.stopPropagation());
    // Follow the disabled state of the input and of enclosing fieldsets.
    const syncDisabled = () => { picker.button.disabled = picker.input.matches(":disabled"); };
    const observer = new MutationObserver(syncDisabled);
    observer.observe(picker.input, { attributes: true, attributeFilter: ["disabled"] });
    picker.input.closest("fieldset") && observer.observe(picker.input.closest("fieldset"), { attributes: true, attributeFilter: ["disabled"] });
    syncDisabled();
  }

  /* Date */
  function setDate(picker, value, emit = true) {
    picker.input.value = value || "";
    syncDate(picker);
    if (emit) picker.input.dispatchEvent(new Event("change", { bubbles: true }));
    closeMenu(picker);
  }
  function renderCalendar(picker) {
    const selectedDate = parseIsoDate(picker.input.value);
    const today = new Date();
    const viewDate = picker.viewDate || selectedDate || today;
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const gridStart = new Date(year, month, 1 - new Date(year, month, 1).getDay());
    const selectedIso = selectedDate ? formatIsoDate(selectedDate) : "";
    const todayIso = formatIsoDate(today);
    const days = Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      const iso = formatIsoDate(day);
      return `<button class="custom-date-day${day.getMonth() !== month ? " muted" : ""}" type="button" data-date-value="${iso}" aria-label="${iso}" aria-selected="${iso === selectedIso}"${iso === todayIso ? ' data-today="true"' : ""}>${day.getDate()}</button>`;
    }).join("");
    picker.menu.innerHTML = `
      <div class="custom-date-head">
        <button class="custom-date-nav" type="button" data-date-nav="-1" aria-label="上个月">‹</button>
        <strong>${year}年${pad(month + 1)}月</strong>
        <button class="custom-date-nav" type="button" data-date-nav="1" aria-label="下个月">›</button>
      </div>
      <div class="custom-date-weekdays" aria-hidden="true"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
      <div class="custom-date-grid">${days}</div>
      <div class="custom-date-actions">
        <button class="custom-date-link" type="button" data-date-clear>清除</button>
        <button class="custom-date-link" type="button" data-date-today>今天</button>
      </div>`;
    picker.menu.querySelectorAll("[data-date-nav]").forEach((button) => button.addEventListener("click", () => {
      picker.viewDate = new Date(year, month + Number(button.dataset.dateNav), 1);
      renderCalendar(picker);
      place(picker);
    }));
    picker.menu.querySelectorAll("[data-date-value]").forEach((button) => button.addEventListener("click", () => setDate(picker, button.dataset.dateValue)));
    picker.menu.querySelector("[data-date-clear]").addEventListener("click", () => setDate(picker, ""));
    picker.menu.querySelector("[data-date-today]").addEventListener("click", () => setDate(picker, todayIso));
  }
  function syncDate(picker) {
    picker.value.textContent = formatDisplayDate(picker.input.value);
    picker.viewDate = parseIsoDate(picker.input.value) || picker.viewDate || new Date();
    if (picker.wrapper.classList.contains("open")) renderCalendar(picker);
  }
  function enhanceDate(input) {
    if (datePickers.has(input) || input.hasAttribute("data-native")) return;
    const id = input.id || `kitDate${++sequence}`;
    const wrapper = document.createElement("div");
    wrapper.className = "custom-date-picker";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "custom-date-button";
    button.id = `${id}Button`;
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    const label = input.getAttribute("aria-label") || input.labels?.[0]?.textContent?.trim() || "日期";
    button.setAttribute("aria-label", `选择${label}`);
    const value = document.createElement("span");
    value.className = "custom-date-value";
    const icon = document.createElement("span");
    icon.className = "custom-date-icon";
    icon.setAttribute("aria-hidden", "true");
    button.append(value, icon);
    const menu = document.createElement("div");
    menu.className = "custom-date-menu";
    menu.id = `${id}Menu`;
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", `选择${label}`);
    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input, button, menu);
    input.type = "hidden";
    const picker = { kind: "date", input, wrapper, button, menu, value, viewDate: parseIsoDate(input.value) || new Date() };
    datePickers.set(input, picker);
    input.addEventListener("change", () => syncDate(picker));
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (wrapper.classList.contains("open")) { closeMenu(picker); return; }
      renderCalendar(picker);
      openMenu(picker);
      (menu.querySelector('[aria-selected="true"]') || menu.querySelector('[data-today="true"]'))?.focus({ preventScroll: true });
    });
    bindKeys(picker);
    syncDate(picker);
  }

  /* Time */
  function setTime(picker, value) {
    picker.input.value = normalizeTimeValue(value) || value || "";
    syncTime(picker);
    picker.input.dispatchEvent(new Event("input", { bubbles: true }));
    picker.input.dispatchEvent(new Event("change", { bubbles: true }));
    closeMenu(picker);
  }
  function renderTimes(picker) {
    const selected = normalizeTimeValue(picker.input.value);
    const options = [...new Set([...timeOptions(), ...(selected ? [selected] : [])])].sort();
    picker.menu.innerHTML = options.map((value) => `<button class="custom-time-option" role="option" type="button" data-time-value="${value}" aria-selected="${value === selected}">${value}</button>`).join("");
    picker.menu.querySelectorAll("[data-time-value]").forEach((button) => button.addEventListener("click", () => setTime(picker, button.dataset.timeValue)));
  }
  function syncTime(picker) {
    picker.value.textContent = normalizeTimeValue(picker.input.value) || "请选择时间";
    if (picker.wrapper.classList.contains("open")) renderTimes(picker);
  }
  function enhanceTime(input) {
    if (timePickers.has(input) || input.hasAttribute("data-native")) return;
    const editable = input.dataset.timeEditable === "true";
    const wrapper = document.createElement("div");
    wrapper.className = "custom-time-picker" + (editable ? " custom-time-editable" : "");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "custom-time-button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    const label = input.getAttribute("aria-label") || input.labels?.[0]?.textContent?.trim() || "时间";
    button.setAttribute("aria-label", `选择${label}`);
    const value = document.createElement("span");
    value.className = "custom-time-value";
    const icon = document.createElement("span");
    icon.className = "custom-time-icon";
    icon.setAttribute("aria-hidden", "true");
    button.append(value, icon);
    const menu = document.createElement("div");
    menu.className = "custom-time-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", label);
    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input, button, menu);
    input.type = editable ? "text" : "hidden";
    const picker = { kind: "time", input, wrapper, button, menu, value, anchor: editable ? wrapper : button };
    if (editable) {
      input.placeholder = "HH:mm";
      input.maxLength = 5;
      input.autocomplete = "off";
      input.spellcheck = false;
      value.hidden = true;
      input.addEventListener("change", () => { const normalized = normalizeTimeValue(input.value); if (normalized) input.value = normalized; });
      input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); if (!wrapper.classList.contains("open")) button.click(); button.focus(); }
        if (event.key === "Escape" && wrapper.classList.contains("open")) { event.preventDefault(); event.stopPropagation(); closeMenu(picker); }
      });
      wrapper.addEventListener("focusout", (event) => {
        if (!wrapper.contains(event.relatedTarget) && !menu.contains(event.relatedTarget)) closeMenu(picker);
      });
    }
    timePickers.set(input, picker);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (wrapper.classList.contains("open")) { closeMenu(picker); return; }
      renderTimes(picker);
      openMenu(picker);
      const selected = menu.querySelector('[aria-selected="true"]');
      if (selected) menu.scrollTop = Math.max(0, selected.offsetTop - menu.clientHeight / 2);
    });
    input.addEventListener("input", () => syncTime(picker));
    input.addEventListener("change", () => syncTime(picker));
    bindKeys(picker);
    syncTime(picker);
  }

  function enhance(scope = document) {
    const all = (selector) => [...(scope.matches?.(selector) ? [scope] : []), ...(scope.querySelectorAll?.(selector) || [])];
    all('input[type="date"]').forEach(enhanceDate);
    all('input[type="time"], input[data-time-editable="true"]').forEach(enhanceTime);
  }

  function init() {
    enhance(document);
    const reposition = () => Kit.popups?.count() && document.querySelectorAll(".custom-date-picker.open input, .custom-time-picker.open input").forEach((input) => place(datePickers.get(input) || timePickers.get(input)));
    root.addEventListener("resize", reposition);
    root.visualViewport?.addEventListener("resize", reposition);
    document.addEventListener("scroll", (event) => { if (!event.target.closest?.(".custom-date-menu, .custom-time-menu")) reposition(); }, true);
    document.addEventListener("pointerdown", (event) => {
      document.querySelectorAll(".custom-date-picker.open, .custom-time-picker.open").forEach((wrapper) => {
        const input = wrapper.querySelector("input");
        const picker = datePickers.get(input) || timePickers.get(input);
        if (picker && !wrapper.contains(event.target) && !picker.menu.contains(event.target)) closeMenu(picker);
      });
    });
    new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === 1) enhance(node);
    }))).observe(document.body, { childList: true, subtree: true });
  }

  Kit.datetime = {
    enhance, parseIsoDate, formatIsoDate, normalizeTimeValue,
    sync(input) { const picker = datePickers.get(input) || timePickers.get(input); if (picker) (picker.kind === "date" ? syncDate : syncTime)(picker); },
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
