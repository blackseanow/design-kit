/* Light / dark / follow-system appearance. The inline bootstrap script in
   head.html applies the saved choice before CSS paints; this module keeps the
   controls in sync. The storage key comes from <html data-theme-key>. */
(function (root, document) {
  "use strict";
  if (!document) return;

  const STORAGE_KEY = document.documentElement.dataset.themeKey || "app-theme";
  const THEMES = ["light", "dark", "system"];
  const labels = { light: "日间", dark: "夜间", system: "跟随系统" };
  const mediaQuery = root.matchMedia ? root.matchMedia("(prefers-color-scheme: dark)") : null;

  const normalize = (value) => (THEMES.includes(value) ? value : "system");
  const systemIsDark = () => Boolean(mediaQuery?.matches);

  function applyTheme(preference) {
    const normalized = normalize(preference);
    const dark = normalized === "dark" || (normalized === "system" && systemIsDark());
    const html = document.documentElement;
    html.dataset.themePreference = normalized;
    html.dataset.theme = dark ? "dark" : "light";
    html.style.colorScheme = dark ? "dark" : "light";
    // Optional favicon pair: <link data-day-src data-night-src>.
    document.querySelectorAll("link[data-day-src][data-night-src]").forEach((link) => {
      const source = dark ? link.dataset.nightSrc : link.dataset.daySrc;
      if (source) link.href = source;
    });
    document.querySelectorAll("[data-theme-label]").forEach((node) => {
      node.textContent = dark ? labels.dark : labels.light;
    });
    document.querySelectorAll("[data-theme-cycle]").forEach((button) => {
      const nextLabel = dark ? labels.light : labels.dark;
      button.setAttribute("aria-label", `当前为${labels[normalized]}模式，点击切换到${nextLabel}模式`);
      button.title = `当前为${labels[normalized]}模式，点击切换到${nextLabel}模式`;
    });
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      const selected = button.dataset.themeChoice === normalized;
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    return normalized;
  }

  function readPreference() {
    try { return normalize(root.localStorage.getItem(STORAGE_KEY)); } catch { return "system"; }
  }

  function savePreference(preference) {
    // Private browsing can deny localStorage; the active page still updates.
    try { root.localStorage.setItem(STORAGE_KEY, preference); } catch {}
  }

  function setTheme(preference) {
    const normalized = applyTheme(preference);
    savePreference(normalized);
    return normalized;
  }

  function cycleTheme() {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    return setTheme(current === "dark" ? "light" : "dark");
  }

  function bind() {
    applyTheme(readPreference());
    // Every scroll surface shows its thin thumb only while scrolling.
    const scrollTimers = new WeakMap();
    document.addEventListener("scroll", (event) => {
      const target = event.target === document ? document.documentElement : event.target;
      if (!target.classList) return;
      target.classList.add("is-scrolling");
      clearTimeout(scrollTimers.get(target));
      scrollTimers.set(target, setTimeout(() => target.classList.remove("is-scrolling"), 900));
    }, { capture: true, passive: true });
    mediaQuery?.addEventListener?.("change", () => {
      if (document.documentElement.dataset.themePreference === "system") applyTheme("system");
    });
    const choices = Array.from(document.querySelectorAll("[data-theme-choice]"));
    choices.forEach((button, index) => {
      button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const next = event.key === "Home" ? 0 : event.key === "End" ? choices.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + choices.length) % choices.length;
        setTheme(choices[next].dataset.themeChoice);
        choices[next].focus({ preventScroll: true });
      });
    });
    document.querySelectorAll("[data-theme-cycle]").forEach((button) => {
      if (button.dataset.themeBound === "true") return;
      button.dataset.themeBound = "true";
      button.addEventListener("click", cycleTheme);
    });
  }

  const api = { applyTheme, cycleTheme, setTheme, getTheme: () => normalize(document.documentElement.dataset.themePreference), storageKey: STORAGE_KEY };
  root.Kit = root.Kit || {};
  root.Kit.theme = api;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
