/* Enhanced single select. The native <select> stays in the form and owns
   value, name, validation and change events; this only replaces its picker.
   Every select:not([multiple]):not([data-native]) is enhanced automatically.
   Options: data-searchable="true", data-search-placeholder, data-empty-label,
   option[data-search-text] for extra search keywords. */
(function (root, document) {
  "use strict";
  if (!document) return;
  const Kit = root.Kit = root.Kit || {};
  const enhanced = new WeakMap();
  let sequence = 0;
  let current = null;

  const selectedText = (select) => select.selectedOptions?.[0]?.textContent?.trim() || select.options?.[0]?.textContent?.trim() || "请选择";
  const setIfChanged = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };

  // Text of a <label> without nested controls.
  function labelText(label) {
    if (!label) return "";
    let text = "";
    const collect = (node) => node.childNodes.forEach((child) => {
      if (child.nodeType === 3) text += child.textContent;
      else if (child.nodeType === 1 && !child.matches("select, input, button, .enhanced-select")) collect(child);
    });
    collect(label);
    return text.trim();
  }

  const optionKey = (select) => [...select.options].map((option) => [
    option.value, option.textContent, option.disabled ? 1 : 0, option.hidden ? 1 : 0, option.selected ? 1 : 0, option.dataset.searchText || "",
  ].join("\u001f")).join("\u001e");

  function close(select = current) {
    const state = select && enhanced.get(select);
    if (!state) return;
    const restoreFocus = state.menu.contains(document.activeElement);
    state.wrapper.classList.remove("open");
    state.menu.dataset.open = "false";
    state.menu.hidden = true;
    state.wrapper.appendChild(state.menu);
    state.button.setAttribute("aria-expanded", "false");
    if (restoreFocus) state.button.focus({ preventScroll: true });
    if (current === select) current = null;
    Kit.popups?.closed(select);
  }

  function position(select = current) {
    const state = select && enhanced.get(select);
    if (!state || !state.wrapper.classList.contains("open")) return;
    Kit.positionMenu(state.button, state.menu);
  }

  function render(select) {
    const state = enhanced.get(select);
    if (!state) return;
    const query = (state.search?.value || "").trim().toLowerCase();
    const options = [...select.options].filter((option) => !option.hidden);
    const matches = options.filter((option) => !query || `${option.textContent} ${option.dataset.searchText || ""}`.toLowerCase().includes(query));
    const focusedValue = state.list.contains(document.activeElement) ? document.activeElement.dataset.value : null;
    const scrollTop = state.list.scrollTop;
    state.list.replaceChildren();
    matches.forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "enhanced-select-option";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.selected));
      item.dataset.value = option.value;
      item.disabled = option.disabled;
      const label = document.createElement("span");
      label.className = "enhanced-select-option-label";
      label.textContent = option.textContent || option.value || "未命名选项";
      const mark = document.createElement("span");
      mark.className = "enhanced-select-check";
      mark.setAttribute("aria-hidden", "true");
      item.append(mark, label);
      state.list.appendChild(item);
    });
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "enhanced-select-empty";
      empty.setAttribute("role", "status");
      empty.textContent = options.length ? "没有匹配结果" : select.dataset.emptyLabel || "暂无选项";
      state.list.appendChild(empty);
    }
    state.list.scrollTop = scrollTop;
    if (focusedValue != null) [...state.list.querySelectorAll("[role=option]")].find((item) => item.dataset.value === focusedValue)?.focus({ preventScroll: true });
    state.renderedKey = optionKey(select);
    state.renderedQuery = query;
  }

  function open(select, { focusSearch = true } = {}) {
    const state = enhanced.get(select);
    if (!state || select.disabled) return;
    Kit.popups?.opened(select, () => close(select));
    if (state.search) state.search.value = "";
    Kit.portalHost(state.wrapper).appendChild(state.menu);
    state.menu.hidden = false;
    state.menu.dataset.open = "true";
    state.wrapper.classList.add("open");
    state.button.setAttribute("aria-expanded", "true");
    current = select;
    render(select);
    position(select);
    state.list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    // Touch layouts do not focus the search field, so the keyboard stays closed.
    if (focusSearch && !Kit.isTouchLayout()) {
      if (state.search) state.search.focus({ preventScroll: true });
      else state.list.querySelector('[aria-selected="true"]:not(:disabled), [role="option"]:not(:disabled)')?.focus({ preventScroll: true });
    }
  }

  function sync(select) {
    const state = enhanced.get(select);
    if (!state) return;
    // Only write what changed: every write is a DOM mutation observers react to.
    const text = selectedText(select);
    if (state.buttonText.textContent !== text) state.buttonText.textContent = text;
    if (state.button.disabled !== select.disabled) state.button.disabled = select.disabled;
    const labelledBy = (select.getAttribute("aria-labelledby") || "").split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
    const label = select.getAttribute("aria-label") || labelledBy || labelText(select.labels?.[0]) || "请选择";
    setIfChanged(state.button, "aria-label", label.includes(text) ? label : `${label}，当前：${text}`);
    setIfChanged(state.list, "aria-label", label);
    state.wrapper.classList.toggle("disabled", select.disabled);
    if (select.disabled) close(select);
    if (!state.wrapper.classList.contains("open")) return;
    if (optionKey(select) !== state.renderedKey || (state.search?.value || "").trim().toLowerCase() !== state.renderedQuery) render(select);
  }

  function enhanceOne(select) {
    if (!select || select.multiple || enhanced.has(select) || select.hasAttribute("data-native") || select.closest("[data-native]")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "enhanced-select";
    const id = select.id || `kitSelect${++sequence}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "enhanced-select-button";
    button.id = `${id}Trigger`;
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", `${id}List`);
    const buttonText = document.createElement("span");
    buttonText.className = "enhanced-select-value";
    const buttonIcon = document.createElement("span");
    buttonIcon.className = "enhanced-select-icon";
    buttonIcon.setAttribute("aria-hidden", "true");
    button.append(buttonText, buttonIcon);
    const menu = document.createElement("div");
    menu.className = "enhanced-select-menu";
    menu.hidden = true;
    const list = document.createElement("div");
    list.className = "enhanced-select-options";
    list.id = `${id}List`;
    list.setAttribute("role", "listbox");
    let search = null;
    if (select.dataset.searchable === "true") {
      wrapper.classList.add("enhanced-select-searchable");
      search = document.createElement("input");
      search.type = "search";
      search.className = "enhanced-select-search";
      search.placeholder = select.dataset.searchPlaceholder || "搜索选项";
      search.setAttribute("aria-label", search.placeholder);
      search.setAttribute("aria-controls", list.id);
      search.autocomplete = "off";
      search.addEventListener("input", () => render(select));
      menu.appendChild(search);
    }
    menu.appendChild(list);
    // One listener handles every option.
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = event.target.closest('[role="option"]');
      if (!item || select.disabled) return;
      const option = [...select.options].find((candidate) => candidate.value === item.dataset.value);
      if (!option || option.disabled) return;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      close(select);
      button.focus({ preventScroll: true });
    });

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, button, menu);
    select.classList.add("enhanced-select-native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const observer = new MutationObserver(() => sync(select));
    observer.observe(select, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["disabled", "label", "value", "selected", "hidden", "data-search-text", "aria-label", "aria-labelledby"] });
    select.addEventListener("invalid", (event) => { event.preventDefault(); button.setAttribute("aria-invalid", "true"); button.focus(); });
    select.addEventListener("change", () => { button.removeAttribute("aria-invalid"); sync(select); });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (select.disabled) return;
      if (wrapper.classList.contains("open")) close(select);
      else open(select);
    });
    const onKeydown = (event) => {
      if (event.key === "Tab" && wrapper.classList.contains("open")) { close(select); button.focus({ preventScroll: true }); return; }
      if (event.key === "Escape" && wrapper.classList.contains("open")) {
        event.preventDefault(); event.stopPropagation();
        close(select); button.focus({ preventScroll: true });
        return;
      }
      if (select.disabled || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (!wrapper.classList.contains("open")) open(select, { focusSearch: false });
      const options = [...list.querySelectorAll('[role="option"]:not(:disabled)')];
      const index = options.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : index < 0 ? (event.key === "ArrowDown" ? 0 : options.length - 1)
        : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[next]?.focus({ preventScroll: true });
      options[next]?.scrollIntoView({ block: "nearest" });
    };
    wrapper.addEventListener("keydown", onKeydown);
    menu.addEventListener("keydown", onKeydown);
    const onFocusout = (event) => {
      if (event.relatedTarget && !wrapper.contains(event.relatedTarget) && !menu.contains(event.relatedTarget)) close(select);
    };
    wrapper.addEventListener("focusout", onFocusout);
    menu.addEventListener("focusout", onFocusout);
    enhanced.set(select, { wrapper, button, buttonText, menu, list, search, observer });
    sync(select);
  }

  function enhance(root_ = document) {
    if (root_.matches?.("select")) enhanceOne(root_);
    root_.querySelectorAll?.("select:not([multiple])").forEach(enhanceOne);
  }

  function init() {
    enhance(document);
    root.addEventListener("resize", () => position());
    root.visualViewport?.addEventListener("resize", () => position());
    document.addEventListener("scroll", (event) => {
      const state = current && enhanced.get(current);
      if (state && !state.menu.contains(event.target)) position();
    }, true);
    document.addEventListener("pointerdown", (event) => {
      const state = current && enhanced.get(current);
      if (state && !state.wrapper.contains(event.target) && !state.menu.contains(event.target)) close();
    });
    Kit.mutations.subscribe(({ added }) => added.forEach(enhance));
  }

  Kit.select = { enhance, sync, open, close };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
